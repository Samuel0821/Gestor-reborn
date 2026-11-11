const path = require('node:path');
const { spawnSync } = require('node:child_process');
for (const file of ['test-bakery.cjs', 'test-service-items.cjs', 'test-quote-draft.cjs', 'test-dashboard.cjs']) {
  const result = spawnSync(require('electron'), [path.join(__dirname, file)], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', timeout: 60000, windowsHide: true
  });
  process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
  if (result.error) console.error(result.error);
  if (result.status !== 0) { process.exitCode = 1; break; }
}
