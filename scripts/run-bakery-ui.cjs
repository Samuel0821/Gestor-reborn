const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../.tools');
fs.mkdirSync(root, { recursive: true });
const directory = fs.mkdtempSync(path.join(root, 'test-bakery-ui-'));
const env = { ...process.env, BAKERY_UI_TEST_DIRECTORY: directory };
delete env.ELECTRON_RUN_AS_NODE;
try {
  const result = spawnSync(require('electron'), [path.join(__dirname, 'test-bakery-ui.cjs')], { env, encoding: 'utf8', timeout: 90000, windowsHide: true });
  process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
  if (result.error) console.error(result.error);
  process.exitCode = result.status === 0 ? 0 : 1;
} finally {
  if (path.dirname(directory) !== root || !path.basename(directory).startsWith('test-bakery-ui-')) throw new Error('Unexpected test directory');
  fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
