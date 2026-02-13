document.addEventListener('DOMContentLoaded', () => {
  // Layout manejado por layout.js

  const form = document.getElementById('client-form');
  const idInput = document.getElementById('client-id');
  const nameInput = document.getElementById('client-name');
  const idcardInput = document.getElementById('client-idcard');
  const addressInput = document.getElementById('client-address');
  const emailInput = document.getElementById('client-email');
  const phoneInput = document.getElementById('client-phone');
  const cancelBtn = document.getElementById('cancel-edit');
  const table = document.getElementById('clients-table');
  const search = document.getElementById('search-client');

  let clients = [];

  async function loadClients() {
    clients = await window.api.getClients();
    renderTable(clients);
  }

  function renderTable(list) {
    table.innerHTML = '';
    for (const c of list) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${c.name}</strong></td>
        <td>${c.id_card_or_nit}</td>
        <td>${c.address || ''}</td>
        <td>${c.email || ''}</td>
        <td>${c.phone || ''}</td>
        <td>
          <button class="btn btn-sm btn-warning edit" data-id="${c.id}">Editar</button>
          <button class="btn btn-sm btn-danger del" data-id="${c.id}">Eliminar</button>
        </td>
      `;
      table.appendChild(tr);
    }
    table.querySelectorAll('.edit').forEach(b => b.addEventListener('click', async (e) => {
      const id = Number(e.target.dataset.id);
      const client = await window.api.getClientById(id);
      idInput.value = client.id;
      nameInput.value = client.name;
      idcardInput.value = client.id_card_or_nit;
      addressInput.value = client.address || '';
      emailInput.value = client.email || '';
      phoneInput.value = client.phone || '';
      cancelBtn.style.display = 'inline-block';
    }));
    table.querySelectorAll('.del').forEach(b => b.addEventListener('click', async (e) => {
      const id = Number(e.currentTarget.dataset.id); // Capturar ID antes del await
      const result = await Swal.fire({
        title: '¿Eliminar cliente?',
        text: "Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, eliminar'
      });
      if (result.isConfirmed) {
        await window.api.deleteClient(id);
        loadClients();
        Swal.fire('Eliminado', 'El cliente ha sido eliminado.', 'success');
      }
    }));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      id: idInput.value ? Number(idInput.value) : undefined,
      name: nameInput.value.trim(),
      id_card_or_nit: idcardInput.value.trim(),
      address: addressInput.value.trim(),
      email: emailInput.value.trim(),
      phone: phoneInput.value.trim()
    };
    if (!payload.name || !payload.id_card_or_nit) { 
      Swal.fire('Atención', 'Nombre y NIT/Cédula son obligatorios.', 'warning'); 
      return; 
    }

    if (payload.id) {
      await window.api.updateClient(payload);
      Swal.fire({ icon: 'success', title: 'Cliente actualizado', timer: 1500, showConfirmButton: false });
      cancelBtn.style.display = 'none';
    } else {
      const res = await window.api.saveClient(payload);
      if (!res.success) { 
        Swal.fire('Error', res.message, 'error');
        return; 
      }
      Swal.fire({ icon: 'success', title: 'Cliente creado', timer: 1500, showConfirmButton: false });
    }
    form.reset();
    idInput.value = '';
    await loadClients();
  });

  cancelBtn.addEventListener('click', () => {
    form.reset();
    idInput.value = '';
    cancelBtn.style.display = 'none';
  });

  search.addEventListener('input', () => {
    const q = search.value.toLowerCase();
    const filtered = clients.filter(c => c.name.toLowerCase().includes(q));
    renderTable(filtered);
  });

  loadClients();
});
