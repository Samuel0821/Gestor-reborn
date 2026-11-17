const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const crypto = require('node:crypto');

// Uses a generated test signing key; no production key, license or database is used.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gestorfx-license-test-'));
const file = path.join(directory, 'license.json');
const keys = crypto.generateKeyPairSync('ed25519');
const machine = crypto.createHash('sha256').update('test-machine').digest('hex');
const signed = (id, kind = 'standalone') => {
  const bytes = Buffer.from(JSON.stringify({ v: 1, aid: id, machine, kind }));
  return `${bytes.toString('base64url')}.${crypto.sign(null, bytes, keys.privateKey).toString('base64url')}`;
};
const write = (id = 'activation-one', kind = 'standalone') => fs.writeFileSync(file, JSON.stringify({
  activationId: id, activationToken: 'test-token', license: signed(id, kind), customerRegistered: false,
}));
const stored = () => JSON.parse(fs.readFileSync(file, 'utf8'));
let request;
const load = () => {
  const module = { exports: {} };
  const context = {
    require: name => name === 'node:crypto' ? { ...crypto, createPublicKey: () => keys.publicKey }
      : name === 'node:child_process' ? { execFileSync: () => 'MachineGuid REG_SZ test-machine' } : require(name),
    module, Buffer, AbortSignal, fetch: (...args) => request(...args),
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/licensing.js'), 'utf8'), context);
  return module.exports;
};
const response = (data, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => data });
(async () => {
 try {
  let licensing = load();
  write();
  let resolveRequest;
  request = async () => new Promise(resolve => { resolveRequest = resolve; });
  const registration = licensing.registerCustomer(directory, { business_name: 'Cliente de prueba', nit: '123' });
  assert.equal(stored().pendingCustomer.business_name, 'Cliente de prueba', 'Persist before network finishes');
  resolveRequest(response({ error: 'unavailable' }, false)); await registration;
  assert.equal(stored().customerRegistered, false);
  licensing = load();
  let calls = 0;
  request = async (url, options) => { calls++; assert.ok(url.endsWith('/register-customer'));
    assert.equal(JSON.parse(options.body).customer.business_name, 'Cliente de prueba');
    return response({ customerId: 'customer-one' }); };
  await licensing.registerCustomer(directory);
  assert.equal(stored().customerId, 'customer-one'); assert.equal(stored().pendingCustomer, null);
  await licensing.registerCustomer(directory); assert.equal(calls, 1, 'Do not register twice');

  request = async () => response({ status: 'active', customerId: 'customer-one' });
  await licensing.checkStatus(directory); assert.equal(licensing.getLicenseState(directory).valid, true);
  request = async () => { throw Error('offline'); };
  await licensing.checkStatus(directory); assert.equal(licensing.getLicenseState(directory).valid, true);
  request = async () => response({ status: 'released' }, false);
  await licensing.checkStatus(directory); assert.equal(licensing.getLicenseState(directory).valid, true, 'Errors never deactivate');
  request = async () => response({ status: 'released' });
  await licensing.checkStatus(directory); assert.equal(licensing.getLicenseState(directory).valid, false);
  request = async () => { throw Error('offline'); };
  await licensing.checkStatus(directory); assert.equal(licensing.getLicenseState(directory).valid, false);
  request = async () => response({ status: 'active' });
  await licensing.checkStatus(directory); assert.equal(licensing.getLicenseState(directory).valid, false, 'Do not undo confirmed revocation');
  request = async () => response({ activationId: 'activation-two', activationToken: 'new-token', kind: 'standalone', license: signed('activation-two') });
  assert.equal((await licensing.activate(directory, 'GFX-AAAA-BBBB-CCCC-DDDD', '1.0.11')).success, true);
  assert.equal(licensing.getLicenseState(directory).valid, true);
  assert.equal(stored().activationId, 'activation-two');
  request = async () => new Promise(resolve => { resolveRequest = resolve; });
  const oldCheck = licensing.checkStatus(directory);
  write('activation-three'); resolveRequest(response({ status: 'released' })); await oldCheck;
  assert.equal(licensing.getLicenseState(directory).valid, true, 'An old request cannot revoke a new activation');
  write('station-test', 'station'); calls = 0; request = async () => { calls++; return response({}); };
  await licensing.registerCustomer(directory, { business_name: 'Should not duplicate' }); assert.equal(calls, 0);
  console.log('OK licencias: registro persistente, reintento, sin duplicados, estados remoto/offline, desactivación y reactivación sin sobrescrituras.');
 } finally {
  assert.equal(path.dirname(directory), os.tmpdir());
  assert.ok(path.basename(directory).startsWith('gestorfx-license-test-'));
  fs.rmSync(directory, { recursive: true, force: true });
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
