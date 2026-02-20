document.addEventListener('DOMContentLoaded', () => {
  // Layout manejado por layout.js

  // --- ESTILOS PERSONALIZADOS PARA EL MENÚ DESPLEGABLE (Modo Oscuro + Efecto Flotante) ---
  const dropdownStyles = document.createElement('style');
  dropdownStyles.innerHTML = `
    /* Contenedor del menú */
    .dropdown-menu {
        border-radius: 12px;
        border: none;
        padding: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        animation: fadeInDrop 0.2s ease-out;
    }
    @keyframes fadeInDrop { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

    /* Items del menú */
    .dropdown-item {
        border-radius: 8px;
        margin-bottom: 3px;
        padding: 8px 15px;
        transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Efecto suave */
        font-weight: 500;
        display: flex;
        align-items: center;
        cursor: pointer;
    }

    /* Iconos dentro de los items */
    .dropdown-item i {
        width: 20px;
        text-align: center;
        transition: transform 0.2s;
    }

    /* EFECTO FLOTANTE AL PASAR EL CURSOR (HOVER) */
    .dropdown-item:hover {
        background-color: #f0f2f5;
        transform: translateX(6px); /* Se mueve a la derecha */
        box-shadow: -4px 4px 10px rgba(0,0,0,0.08); /* Sombra sutil */
    }
    .dropdown-item:hover i {
        transform: scale(1.2); /* El icono crece un poco */
    }

    /* --- ADAPTACIÓN MODO OSCURO --- */
    body.dark-mode .dropdown-menu {
        background-color: #2d333b; /* Gris oscuro elegante */
        border: 1px solid #444c56;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    body.dark-mode .dropdown-item {
        color: #c9d1d9;
    }
    body.dark-mode .dropdown-item:hover {
        background-color: #373e47;
        color: #ffffff;
        box-shadow: -4px 4px 10px rgba(0,0,0,0.3);
    }
    body.dark-mode .dropdown-divider { border-top-color: #444c56; }
  `;
  document.head.appendChild(dropdownStyles);
  // ---------------------------------------------------------------------------------------

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
          <div class="dropdown">
            <button class="btn btn-sm btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
              Acciones
            </button>
            <ul class="dropdown-menu">
              <li><button class="dropdown-item edit" data-id="${c.id}"><i class="fa fa-edit me-2 text-primary"></i> Editar</button></li>
              <li><button class="dropdown-item del" data-id="${c.id}"><i class="fa fa-trash me-2 text-danger"></i> Eliminar</button></li>
            </ul>
          </div>
        </td>
      `;
      table.appendChild(tr);
    }

    // Restricción de roles
    const role = localStorage.getItem('user_role');
    if (role !== 'admin') {
        table.querySelectorAll('.del').forEach(btn => btn.closest('li').remove());
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
