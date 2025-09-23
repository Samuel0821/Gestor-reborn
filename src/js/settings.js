document.addEventListener('DOMContentLoaded', () => { 
  const form = document.getElementById('settings-form');
  const nameInput = document.getElementById('company-name');
  const idInput = document.getElementById('company-id-card-or-nit');
  const addressInput = document.getElementById('company-address');
  const emailInput = document.getElementById('company-email');
  const phoneInput = document.getElementById('company-phone');
  const logoInput = document.getElementById('company-logo');
  const logoPreview = document.getElementById('logo-preview');
  const status = document.getElementById('save-status');

  // NUEVAS VARIABLES para la configuración de impresión
    const printSettingsForm = document.getElementById('print-settings-form');
    const printerSelect = document.getElementById('printer-select');
    const paperSizeSelect = document.getElementById('paper-size');

  async function loadSettings() {
    try {
      const s = await window.api.getCompanySettings();
      if (!s) return;
      nameInput.value = s.company_name || '';
      idInput.value = s.company_id_card_or_nit || '';
      addressInput.value = s.company_address || '';
      emailInput.value = s.company_email || '';
      phoneInput.value = s.company_phone || '';
      if (s.logo_path) {
        logoPreview.src = s.logo_path;
        logoPreview.style.display = 'block';
      } else {
        logoPreview.style.display = 'none';
      }
    } catch (err) {
      console.error(err);
    }
  }

  logoInput.addEventListener('change', () => {
    const f = logoInput.files[0];
    if (!f) { logoPreview.style.display = 'none'; return; }
    logoPreview.src = f.path;
    logoPreview.style.display = 'block';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const logoPath = logoInput.files && logoInput.files[0] ? logoInput.files[0].path : (logoPreview.src || null);
    const payload = {
      company_name: nameInput.value.trim(),
      company_id_card_or_nit: idInput.value.trim(),
      company_address: addressInput.value.trim(),
      company_email: emailInput.value.trim(),
      company_phone: phoneInput.value.trim(),
      logo_path: logoPath
    };
    const res = await window.api.updateCompanySettings(payload);
    status.textContent = res.message || (res.success ? 'Guardado' : 'Error');
    status.className = res.success ? 'text-success' : 'text-danger';
    setTimeout(() => { status.textContent=''; status.className=''; }, 3000);
    await loadSettings();
  });

  async function loadPrintSettings() {
    try {
        const printers = await window.api.getPrinters(); // Llamada a la API de Electron
        
        printerSelect.innerHTML = printers
            .map(p => `<option value="${p.name}" ${p.isDefault ? "selected" : ""}>${p.name}${p.isDefault ? " (Predeterminada)" : ""}</option>`)
            .join('');
        
        // Cargar la configuración guardada del localStorage
        const savedPrinter = localStorage.getItem('printer');
        const savedPaperSize = localStorage.getItem('paperSize');

        if (savedPrinter) {
            printerSelect.value = savedPrinter;
        }
        if (savedPaperSize) {
            paperSizeSelect.value = savedPaperSize;
        }
    } catch (err) {
        console.error("Error al cargar la configuración de impresión:", err);
    }
}

  loadSettings();
  loadPrintSettings();
});
