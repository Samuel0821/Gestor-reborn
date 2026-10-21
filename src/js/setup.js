document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('setup-form');
  const steps = [...document.querySelectorAll('.setup-step')];
  const progress = document.getElementById('setup-progress');
  const backButton = document.getElementById('setup-back');
  const nextButton = document.getElementById('setup-next');
  const businessTypeSelect = document.getElementById('business-type');
  const summary = document.getElementById('setup-summary');
  const alertBox = document.getElementById('setup-alert');
  let currentStep = 1;
  let licenseActivated = false;
  const licenseBlock = document.getElementById('license-block');
  const licenseAlert = document.getElementById('license-alert');

  const value = id => document.getElementById(id).value.trim();

  try {
    const state = await window.api.getInstallationState();
    if (state.completed) {
      window.location.href = 'login.html';
      return;
    }

    licenseActivated = Boolean((await window.api.getLicenseState()).activated);
    licenseBlock.classList.toggle('d-none', licenseActivated);

    const businessTypes = await window.api.getBusinessTypes();
    businessTypeSelect.replaceChildren(...businessTypes.map(type => {
      const option = document.createElement('option');
      option.value = type.id;
      option.textContent = type.name;
      return option;
    }));
    renderStep();
  } catch (error) {
    showError(error.message || 'No se pudo cargar la configuración inicial.');
  }

  function renderStep() {
    steps.forEach(step => step.classList.toggle('d-none', Number(step.dataset.step) !== currentStep));
    progress.style.width = `${Math.round((currentStep / steps.length) * 100)}%`;
    progress.textContent = `Paso ${currentStep} de ${steps.length}`;
    backButton.disabled = currentStep === 1 || currentStep === 7;
    nextButton.textContent = currentStep === 6 ? 'Guardar configuración' : currentStep === 7 ? 'Ir al login' : 'Continuar';
    if (currentStep === 6) renderSummary();
  }

  function renderSummary() {
    const businessType = businessTypeSelect.options[businessTypeSelect.selectedIndex]?.text || '-';
    summary.replaceChildren();
    addSummaryRow('Tipo de negocio', businessType);
    addSummaryRow('Empresa', value('company-name') || '-');
    addSummaryRow('Administrador', value('admin-name') || value('admin-username') || '-');
    addSummaryRow('Moneda', document.getElementById('currency-code').value);
    alertBox.classList.add('d-none');
  }

  function addSummaryRow(label, text) {
    const term = document.createElement('dt');
    term.className = 'col-sm-4';
    term.textContent = label;
    const description = document.createElement('dd');
    description.className = 'col-sm-8';
    description.textContent = text;
    summary.append(term, description);
  }

  function showError(message) {
    alertBox.textContent = message;
    alertBox.classList.remove('d-none');
  }

  function validateCurrentStep() {
    const fields = steps[currentStep - 1].querySelectorAll('input[required], select[required]');
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  }

  function collectSetup() {
    return {
      business_type_id: Number(businessTypeSelect.value),
      company_name: value('company-name'),
      company_id_card_or_nit: value('company-id'),
      company_address: value('company-address'),
      company_phone: value('company-phone'),
      company_email: value('company-email'),
      country_code: document.getElementById('country-code').value,
      currency_code: document.getElementById('currency-code').value,
      inventory_config: { enabled: document.getElementById('inventory-enabled').checked },
      sales_config: { enabled: true },
      services_config: { enabled: document.getElementById('services-enabled').checked },
      printing_config: {},
      admin_name: value('admin-name'),
      username: value('admin-username'),
      password: document.getElementById('admin-password').value,
    };
  }

  backButton.addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep -= 1;
      renderStep();
    }
  });

  nextButton.addEventListener('click', async () => {
    if (currentStep === 7) {
      window.location.href = 'login.html';
      return;
    }
    if (!validateCurrentStep()) return;
    if (currentStep === 1 && !licenseActivated) {
      const code = value('activation-code');
      if (!code) {
        licenseAlert.textContent = 'Ingrese el código de activación para continuar.';
        licenseAlert.classList.remove('d-none');
        return;
      }
      nextButton.disabled = true;
      licenseAlert.classList.add('d-none');
      try {
        const activation = await window.api.activateLicense({ code });
        if (!activation.success) {
          licenseAlert.textContent = activation.message || 'No se pudo activar.';
          licenseAlert.classList.remove('d-none');
          return;
        }
        licenseActivated = true;
        licenseBlock.classList.add('d-none');
      } catch (error) {
        licenseAlert.textContent = error.message || 'No se pudo activar.';
        licenseAlert.classList.remove('d-none');
        return;
      } finally {
        nextButton.disabled = false;
      }
    }
    if (currentStep < 6) {
      currentStep += 1;
      renderStep();
      return;
    }

    nextButton.disabled = true;
    const result = await window.api.saveInitialSetup(collectSetup());
    nextButton.disabled = false;
    if (!result.success) {
      showError(result.message || 'No se pudo guardar la configuración.');
      return;
    }
    currentStep = 7;
    renderStep();
  });

  form.addEventListener('submit', event => event.preventDefault());
});
