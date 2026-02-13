document.addEventListener('DOMContentLoaded', () => {
  // Layout manejado por layout.js

  document.getElementById("exportExcelBtn")?.addEventListener("click", async () => {
      const res = await window.api.exportSuppliersExcel();
      Swal.fire(res.success ? 'Éxito' : 'Error', res.message, res.success ? 'success' : 'error');
  });

  document.getElementById("exportPdfBtn")?.addEventListener("click", async () => {
      const res = await window.api.exportSuppliersPDF();
      Swal.fire(res.success ? 'Éxito' : 'Error', res.message, res.success ? 'success' : 'error');
  });

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
      const id = Number(e.currentTarget.dataset.id); // Capturar el ID antes del await
      const result = await Swal.fire({
        title: '¿Eliminar proveedor?',
        text: "Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      });
      if (result.isConfirmed) {
        await window.api.deleteSupplier(id);
        loadSuppliers();
        Swal.fire('Eliminado', 'El proveedor ha sido eliminado.', 'success');
      }
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
      Swal.fire('Atención', 'El nombre del proveedor es obligatorio.', 'warning');
      return;
    }

    if (payload.id) {
      await window.api.updateSupplier(payload);
      Swal.fire({ icon: 'success', title: 'Proveedor actualizado', timer: 1500, showConfirmButton: false });
    } else {
      await window.api.saveSupplier(payload);
      Swal.fire({ icon: 'success', title: 'Proveedor creado', timer: 1500, showConfirmButton: false });
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