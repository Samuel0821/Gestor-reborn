document.addEventListener('DOMContentLoaded', () => {
  document.getElementById("exportExcelBtn")?.addEventListener("click", async () => {
      const res = await window.api.exportSuppliersExcel();
      showAlert(res.success ? "success" : "danger", res.message);
  });

  document.getElementById("exportPdfBtn")?.addEventListener("click", async () => {
      const res = await window.api.exportSuppliersPDF();
      showAlert(res.success ? "success" : "danger", res.message);
  });

  function showAlert(type, message) {
      const alertContainer = document.querySelector('.container');
      const alertDiv = document.createElement('div');
      alertDiv.className = `alert alert-${type} alert-dismissible fade show mt-3`;
      alertDiv.innerHTML = `<i class="fa fa-info-circle me-2"></i>${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
      alertContainer.prepend(alertDiv);
  }

  const form = document.getElementById('supplier-form');
  const idInput = document.getElementById('supplier-id');
  const nameInput = document.getElementById('supplier-name');
  const nitInput = document.getElementById('supplier-nit');
  const addressInput = document.getElementById('supplier-address');
  const emailInput = document.getElementById('supplier-email');
  const phoneInput = document.getElementById('supplier-phone');
  const cancelBtn = document.getElementById('cancel-edit');
  const table = document.getElementById('suppliers-table');
  const search = document.getElementById('search-supplier');

  let suppliers = [];

  async function loadSuppliers() {
    suppliers = await window.api.getSuppliers();
    renderTable(suppliers);
  }

  function renderTable(list) {
    table.innerHTML = '';
    for (const s of list) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${s.name}</strong></td>
        <td>${s.nit || ''}</td>
        <td>${s.address || ''}</td>
        <td>${s.email || ''}</td>
        <td>${s.phone || ''}</td>
        <td>
          <button class="btn btn-sm btn-primary edit" data-id="${s.id}"><i class="fa fa-edit"></i></button>
          <button class="btn btn-sm btn-danger del" data-id="${s.id}"><i class="fa fa-trash"></i></button>
        </td>
      `;
      table.appendChild(tr);
    }
    table.querySelectorAll('.edit').forEach(b => b.addEventListener('click', async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      const supplier = await window.api.getSupplierById(id);
      idInput.value = supplier.id;
      nameInput.value = supplier.name;
      nitInput.value = supplier.nit || '';
      addressInput.value = supplier.address || '';
      emailInput.value = supplier.email || '';
      phoneInput.value = supplier.phone || '';
      cancelBtn.style.display = 'inline-block';
      window.scrollTo(0, 0);
    }));
    table.querySelectorAll('.del').forEach(b => b.addEventListener('click', async (e) => {
      if (!confirm('¿Realmente deseas eliminar este proveedor?')) return;
      const id = Number(e.currentTarget.dataset.id);
      await window.api.deleteSupplier(id);
      loadSuppliers();
    }));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      id: idInput.value ? Number(idInput.value) : undefined,
      name: nameInput.value.trim(),
      nit: nitInput.value.trim(),
      address: addressInput.value.trim(),
      email: emailInput.value.trim(),
      phone: phoneInput.value.trim()
    };
    if (!payload.name) {
      alert('El nombre del proveedor es obligatorio.');
      return;
    }

    if (payload.id) {
      await window.api.updateSupplier(payload);
    } else {
      await window.api.saveSupplier(payload);
    }
    form.reset();
    idInput.value = '';
    cancelBtn.style.display = 'none';
    await loadSuppliers();
  });

  cancelBtn.addEventListener('click', () => {
    form.reset();
    idInput.value = '';
    cancelBtn.style.display = 'none';
  });

  search.addEventListener('input', () => {
    const q = search.value.toLowerCase();
    const filtered = suppliers.filter(s => s.name.toLowerCase().includes(q));
    renderTable(filtered);
  });

  loadSuppliers();
});