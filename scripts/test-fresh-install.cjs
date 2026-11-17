const electron = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const directory = process.env.GESTORFX_INSTALL_TEST_DIRECTORY;
if (!directory || !path.basename(directory).startsWith('test-installation-')) throw Error('Missing isolated test directory');
const existing = path.join(directory, 'existing');
fs.mkdirSync(path.join(existing, 'profile'), { recursive: true });
const license = path.join(existing, 'license.json');
fs.writeFileSync(license, '{"existing":"do not replace"}');
const oldDb = path.join(existing, 'database.sqlite');
fs.writeFileSync(oldDb, 'do not open this database');
electron.app.setPath('userData', path.join(existing, 'profile'));
electron.app.disableHardwareAcceleration();
process.env.GESTORFX_FRESH_INSTALL = '1';
process.env.GESTORFX_DATABASE_PATH = oldDb;
process.env.GESTORFX_SERVER_MODE = '1';
process.env.GESTORFX_API_URL = 'https://invalid.example';
let win;
class HiddenWindow extends electron.BrowserWindow {
  constructor(options) {
    super({ ...options, show: false, webPreferences: { ...options.webPreferences, offscreen: true, backgroundThrottling: false } });
    win = this;
  }
}
const load = Module._load;
Module._load = function(name, ...args) { return name === 'electron' ? { ...electron, BrowserWindow: HiddenWindow } : load.call(this, name, ...args); };
require('../src/index.js');
// Report the new directory so the parent can remove it after Electron exits.
fs.writeFileSync(path.join(directory, 'fresh-path.txt'), path.dirname(process.env.GESTORFX_DATABASE_PATH));
electron.app.whenReady().then(async () => {
  try {
    for (let i = 0; i < 150; i++) {
      if (win && !win.webContents.isLoading() && await win.webContents.executeJavaScript('Boolean(window.api && document.getElementById("installation-kind"))')) break;
      await new Promise(r => setTimeout(r, 30));
    }
    const js = code => win.webContents.executeJavaScript(code);
    assert.ok(win.webContents.getURL().endsWith('/setup.html'));
    assert.notEqual(process.env.GESTORFX_DATABASE_PATH, oldDb);
    assert.equal(process.env.GESTORFX_SERVER_MODE, undefined);
    assert.equal(process.env.GESTORFX_API_URL, undefined);
    assert.equal((await js('window.api.getLicenseState()')).activated, false);
    assert.equal((await js('window.api.getInstallationState()')).completed, false);
    assert.equal(await js('document.getElementById("installation-kind").disabled'), false);
    assert.equal(await js('document.getElementById("installation-kind").value'), 'standalone');
    assert.equal(await js('document.getElementById("license-block").classList.contains("d-none")'), false);
    await js('document.getElementById("installation-kind").value="server"');
    assert.equal(await js('document.getElementById("installation-kind").value'), 'server');
    await js('document.getElementById("installation-kind").value="standalone";document.getElementById("activation-code").focus()');
    await win.webContents.insertText('GFX-AAAA-BBBB-CCCC-DDDD');
    assert.equal(await js('document.getElementById("activation-code").value'), 'GFX-AAAA-BBBB-CCCC-DDDD');
    assert.equal(fs.readFileSync(license, 'utf8'), '{"existing":"do not replace"}');
    assert.equal(fs.readFileSync(oldDb, 'utf8'), 'do not open this database');
    console.log('OK: inicio nuevo aislado, selector habilitado, entrada de código editable y datos/licencia anteriores intactos.');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally {
    try { require('../src/database').db.close(); } catch {}
    if (win) win.destroy();
    electron.app.exit(process.exitCode || 0);
  }
});
