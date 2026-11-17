const path = require('node:path');
const { spawn } = require('node:child_process');
const env = { ...process.env, GESTORFX_FRESH_INSTALL: '1' };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(process.execPath, [
  require.resolve('@electron-forge/cli/dist/electron-forge.js'),
  'start', ...process.argv.slice(2),
], { cwd: path.resolve(__dirname, '..'), env, stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
