const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../.tools');
fs.mkdirSync(root, { recursive: true });
const directory = fs.mkdtempSync(path.join(root, 'test-installation-'));
const env = { ...process.env, GESTORFX_INSTALL_TEST_DIRECTORY: directory };
delete env.ELECTRON_RUN_AS_NODE;
try {
  const result = spawnSync(require('electron'), [path.join(__dirname, 'test-station-flow.cjs'), ...process.argv.slice(2)], {
    env, encoding: 'utf8', timeout: 60000, windowsHide: true,
  });
  process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
  if (result.error) console.error(result.error);
  process.exitCode = result.status === 0 ? 0 : 1;
} finally {
  const report = path.join(directory, 'fresh-path.txt');
  if (fs.existsSync(report)) {
    const fresh = path.resolve(fs.readFileSync(report, 'utf8'));
    if (path.dirname(fresh) !== path.resolve(os.tmpdir()) || !path.basename(fresh).startsWith('gestorfx-dev-install-')) throw Error('Unexpected fresh profile path');
    fs.rmSync(fresh, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  if (path.dirname(directory) !== root || !path.basename(directory).startsWith('test-installation-')) throw Error('Unexpected test directory');
  fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
