// Keep confirmations in the renderer: native confirm/alert dialogs in Electron
// on Windows can leave Blink's text input focus disconnected after dismissal.
window.GestorDialogs = Object.freeze({
  async confirm(message) {
    const result = await Swal.fire({
      titleText: 'Confirmar',
      text: String(message),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
      returnFocus: true,
    });
    return result.isConfirmed === true;
  },
  async prompt(message) {
    const result = await Swal.fire({
      titleText: String(message),
      input: 'text',
      inputLabel: 'Motivo',
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      returnFocus: true,
      inputValidator: value => !String(value || '').trim() ? 'Escriba el motivo para continuar.' : undefined,
    });
    return result.isConfirmed ? String(result.value || '').trim() : null;
  },
});
