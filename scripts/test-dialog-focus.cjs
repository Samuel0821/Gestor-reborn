const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const directory = process.env.GESTORFX_UI_FOCUS_DIRECTORY;
if (!directory || !path.basename(directory).startsWith('test-ui-focus-')) throw Error('Missing isolated profile');
app.setPath('userData', directory);
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  let win;
  try {
    win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
    win.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => callback({ cancel: true }));
    const js = code => win.webContents.executeJavaScript(code);
    const until = async check => { for (let i = 0; i < 200; i++) { if (await check()) return; await new Promise(r => setTimeout(r, 20)); } throw Error('Dialog/UI condition timed out'); };
    const closed = () => until(() => js('!document.querySelector(".swal2-container")'));
    const type = async selector => {
      await js(`document.querySelector(${JSON.stringify(selector)}).value=''; document.querySelector(${JSON.stringify(selector)}).focus()`);
      await win.webContents.insertText('Sigue funcionando');
      assert.equal(await js(`document.querySelector(${JSON.stringify(selector)}).value`), 'Sigue funcionando');
    };
    const views = path.join(__dirname, '../src/views');
    const pages = fs.readdirSync(views).filter(name => fs.readFileSync(path.join(views, name), 'utf8').includes('sweetalert2'));
    assert.ok(pages.length >= 14);
    for (const name of ['production.js', 'bakeryModules.js', 'bakeryPurchases.js']) {
      assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../src/js', name), 'utf8'), /(?<![\w.])(?:window\.)?(?:alert|confirm|prompt)\s*\(/, 'Do not reintroduce native blocking dialogs');
    }
    for (const page of pages) {
      let html = fs.readFileSync(path.join(views, page), 'utf8');
      assert.ok(html.includes('../../node_modules/sweetalert2/dist/sweetalert2.all.min.js'));
      html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, tag => /src="[^"]*(?:bootstrap\.bundle\.min\.js|sweetalert2\.all\.min\.js|\/dialogs\.js)"/.test(tag) ? tag : '');
      html = html.replace(/<link\b[^>]*https:[^>]*>/gi, '');
      // Some views have no Bootstrap dialog of their own. Load the local
      // bundle for the synthetic nested-form regression used below.
      if (!html.includes('bootstrap.bundle.min.js')) html = html.replace('<head>', '<head><script src="../../node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"></script>');
      html = html.replace('<head>', `<head><base href="${pathToFileURL(views + path.sep).href}">`);
      html = html.replace('</body>', '<input id="focus-probe" aria-label="Campo de prueba"><div class="modal fade" id="focus-modal" tabindex="-1"><div class="modal-dialog"><div class="modal-content"><input id="focus-modal-input" aria-label="Campo de prueba modal"></div></div></div></body>');
      const file = path.join(directory, page); fs.writeFileSync(file, html);
      await win.loadFile(file);
      await until(() => js('Boolean(window.GestorDialogs && window.Swal && window.bootstrap)'));
      await type('#focus-probe');
      for (const accept of [true, false]) {
        await js('window.pendingDialog=GestorDialogs.confirm("Confirmación de prueba");true');
        await until(() => js('Swal.isVisible()'));
        await js(accept ? 'Swal.clickConfirm()' : 'Swal.clickCancel()');
        assert.equal(await js('window.pendingDialog'), accept);
        await closed(); await type('#focus-probe');
      }
      await js('window.pendingDialog=GestorDialogs.prompt("Motivo de prueba");true');
      await until(() => js('Swal.isVisible()'));
      await type('.swal2-input'); await js('Swal.clickConfirm()');
      assert.equal(await js('window.pendingDialog'), 'Sigue funcionando');
      await closed(); await type('#focus-probe');
      await js('window.pendingDialog=GestorDialogs.prompt("Cancelar motivo");true');
      await until(() => js('Swal.isVisible()')); await js('Swal.clickCancel()');
      assert.equal(await js('window.pendingDialog'), null); await closed();
      await js('bootstrap.Modal.getOrCreateInstance(document.getElementById("focus-modal")).show()');
      await until(() => js('document.getElementById("focus-modal").classList.contains("show") && !bootstrap.Modal.getInstance(document.getElementById("focus-modal"))._isTransitioning'));
      await type('#focus-modal-input');
      await js('window.pendingDialog=GestorDialogs.prompt("Motivo dentro de un formulario");true');
      await until(() => js('Swal.isVisible()')); await type('.swal2-input'); await js('Swal.clickConfirm()');
      assert.equal(await js('window.pendingDialog'), 'Sigue funcionando'); await closed(); await type('#focus-modal-input');
      await js('bootstrap.Modal.getInstance(document.getElementById("focus-modal")).hide()');
      await until(() => js('!document.querySelector(".modal-backdrop")'));
      await type('#focus-probe');
      assert.equal(await js('document.body.classList.contains("modal-open")'), false);
    }
    console.log(`OK: ${pages.length} vistas, diálogos reales sin Internet, confirmar/cancelar, motivos, formularios Bootstrap y escritura posterior sin reiniciar.`);
  } catch (error) {
    console.error(error);
    if (win) console.error(await win.webContents.executeJavaScript('JSON.stringify({url:location.href,dialogs:typeof GestorDialogs,swal:typeof Swal,bootstrap:typeof bootstrap,scripts:[...document.scripts].map(s=>s.src)})'));
    process.exitCode = 1;
  }
  finally { if (win) win.destroy(); app.exit(process.exitCode || 0); }
});
