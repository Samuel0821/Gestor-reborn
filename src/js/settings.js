document.addEventListener('DOMContentLoaded', () => { 
  // Layout manejado por layout.js

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

  // --- GESTIÓN DE USUARIOS ---
  const userForm = document.getElementById('user-form');
  const usersTable = document.getElementById('users-table');
  const userIdInput = document.getElementById('user-id');
  const userCancelBtn = document.getElementById('cancel-user-edit');
  const userFormTitle = document.getElementById('user-form-title');

  async function loadUsers() {
    if (!usersTable) return;
    
    const currentRole = localStorage.getItem('user_role');
    // Si no es admin, deshabilitar formulario
    if (currentRole !== 'admin' && userForm) {
        userForm.innerHTML = '<div class="alert alert-warning">Solo los administradores pueden gestionar usuarios.</div>';
    }

    const users = await window.api.getUsers();
    usersTable.innerHTML = '';
    users.forEach(u => {
      let actions = '';
      if (currentRole === 'admin') {
        // No permitir borrar al propio admin logueado o al usuario 'admin' base si se desea proteger
        actions += `<button class="btn btn-sm btn-info edit-user me-1" data-id="${u.id}" data-username="${u.username}" data-name="${u.name || ''}" data-role="${u.role}"><i class="fa fa-edit"></i></button>`;
        if (u.username !== 'admin') {
            actions += `<button class="btn btn-sm btn-danger del-user" data-id="${u.id}"><i class="fa fa-trash"></i></button>`;
        }
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.username}</td>
        <td>${u.name || '-'}</td>
        <td><span class="badge bg-${u.role === 'admin' ? 'danger' : 'primary'}">${u.role}</span></td>
        <td>${actions}</td>
      `;
      usersTable.appendChild(tr);
    });

    usersTable.querySelectorAll('.del-user').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const result = await Swal.fire({
            title: '¿Eliminar usuario?',
            text: "Esta acción no se puede deshacer.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Sí, eliminar'
        });
        if (!result.isConfirmed) return;
        const id = e.currentTarget.dataset.id;
        const res = await window.api.deleteUser(id);
        Swal.fire(res.success ? 'Eliminado' : 'Error', res.message, res.success ? 'success' : 'error');
        if (res.success) loadUsers();
      });
    });

    usersTable.querySelectorAll('.edit-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const ds = e.currentTarget.dataset;
            userIdInput.value = ds.id;
            document.getElementById('user-username').value = ds.username;
            document.getElementById('user-fullname').value = ds.name;
            document.getElementById('user-role').value = ds.role;
            document.getElementById('user-password').value = ""; // Limpiar password
            
            userFormTitle.textContent = "Editar Usuario";
            userCancelBtn.style.display = 'inline-block';
        });
    });
  }

  if (userForm) {
    userCancelBtn.addEventListener('click', () => {
        userForm.reset();
        userIdInput.value = "";
        userFormTitle.textContent = "Crear Nuevo Usuario";
        userCancelBtn.style.display = 'none';
    });

    userForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = userIdInput.value;
      const username = document.getElementById('user-username').value.trim();
      const password = document.getElementById('user-password').value.trim();
      const name = document.getElementById('user-fullname').value.trim();
      const role = document.getElementById('user-role').value;

      if (!username) {
        Swal.fire('Atención', "El nombre de usuario es obligatorio.", 'warning');
        return;
      }
      // Si es nuevo, password es obligatorio
      if (!id && !password) {
        Swal.fire('Atención', "La contraseña es obligatoria para nuevos usuarios.", 'warning');
        return;
      }

      let res;
      if (id) {
        res = await window.api.updateUser({ id, username, password, name, role });
      } else {
        res = await window.api.createUser({ username, password, name, role });
      }

      if (res.success) {
        Swal.fire('Éxito', id ? "Usuario actualizado" : "Usuario creado", 'success');
        
        // Si se actualizó el usuario actual, refrescar la cabecera y localStorage
        const currentUserId = localStorage.getItem('user_id');
        if (id && String(id) === String(currentUserId)) {
            const newDisplayName = name || username;
            localStorage.setItem('user_name', newDisplayName);
            localStorage.setItem('user_role', role);
            const header = document.getElementById('user-info-header');
            if (header) {
                header.innerHTML = `
                  <small class="me-3"><i class="fa fa-user-circle me-1"></i> ${newDisplayName} | <strong>${role === 'admin' ? 'Administrador' : 'Usuario'}</strong></small>
                  <button id="logout-btn" class="btn btn-sm btn-outline-danger" style="font-size: 0.75rem; padding: 2px 6px;"><i class="fa fa-sign-out-alt"></i> Salir</button>
                `;
                document.getElementById('logout-btn').addEventListener('click', async () => {
                  const result = await Swal.fire({
                    title: '¿Cerrar sesión?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, cerrar sesión',
                    cancelButtonText: 'Cancelar'
                  });
                  if (result.isConfirmed) {
                    ['user_id', 'user_role', 'user_name', 'logueado', 'valor_inicial_dia'].forEach(k => localStorage.removeItem(k));
                    window.location.href = 'login.html';
                  }
                });
            }
        }

        userForm.reset();
        userIdInput.value = "";
        userFormTitle.textContent = "Crear Nuevo Usuario";
        userCancelBtn.style.display = 'none';
        loadUsers();
      } else {
        Swal.fire('Error', res.message, 'error');
      }
    });

    loadUsers();
  }

  loadSettings();
  loadPrintSettings();
});
