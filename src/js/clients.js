document.addEventListener('DOMContentLoaded', () => {
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
      if (!confirm('¿Eliminar cliente?')) return;
      const id = Number(e.target.dataset.id);
      await window.api.deleteClient(id);
      loadClients();
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
    if (!payload.name || !payload.id_card_or_nit) { alert('Nombre y NIT son obligatorios'); return; }

    if (payload.id) {
      await window.api.updateClient(payload);
      cancelBtn.style.display = 'none';
    } else {
      const res = await window.api.saveClient(payload);
      if (!res.success) { alert(res.message); return; }
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
