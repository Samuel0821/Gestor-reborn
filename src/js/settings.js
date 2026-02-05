document.addEventListener('DOMContentLoaded', () => { 
  // Mostrar usuario logueado
  const role = localStorage.getItem('user_role');
  const name = localStorage.getItem('user_name');
  if (role && name) {
    // --- INICIO LOGICA LAYOUT ERP ---
    const currentPage = window.location.pathname.split('/').pop();
    
    // Crear estructura principal
    const appWrapper = document.createElement('div');
    appWrapper.className = 'app-wrapper';

    // Sidebar
    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
       <div class="sidebar-brand">
        <img src="../logo/gestorfx_logof.ico" alt="Logo" style="height: 100px; width: auto; margin-right: 10px;">
       </div>      
       <nav class="sidebar-menu">
        <a href="index.html" class="sidebar-link ${currentPage === 'index.html' ? 'active' : ''}"><i class="fa fa-home"></i> <span class="link-text">Dashboard</span></a>
        <a href="sales.html" class="sidebar-link ${currentPage === 'sales.html' ? 'active' : ''}"><i class="fa fa-shopping-cart"></i> <span class="link-text">Ventas</span></a>
        <a href="products.html" class="sidebar-link ${currentPage === 'products.html' ? 'active' : ''}"><i class="fa fa-box"></i> <span class="link-text">Productos</span></a>
        <a href="clients.html" class="sidebar-link ${currentPage === 'clients.html' ? 'active' : ''}"><i class="fa fa-users"></i> <span class="link-text">Clientes</span></a>
        <a href="suppliers.html" class="sidebar-link ${currentPage === 'suppliers.html' ? 'active' : ''}"><i class="fa fa-truck"></i> <span class="link-text">Proveedores</span></a>
        <a href="quotes.html" class="sidebar-link ${currentPage === 'quotes.html' ? 'active' : ''}"><i class="fa fa-file-invoice-dollar"></i> <span class="link-text">Cotizaciones</span></a>
        <a href="purchase_orders.html" class="sidebar-link ${currentPage === 'purchase_orders.html' ? 'active' : ''}"><i class="fa fa-clipboard-list"></i> <span class="link-text">Órdenes Compra</span></a>
        <a href="services.html" class="sidebar-link ${currentPage === 'services.html' ? 'active' : ''}"><i class="fa fa-concierge-bell"></i> <span class="link-text">Servicios</span></a>
        <a href="reports.html" class="sidebar-link ${currentPage === 'reports.html' ? 'active' : ''}"><i class="fa fa-chart-line"></i> <span class="link-text">Reportes</span></a>
        <a href="expenses.html" class="sidebar-link ${currentPage === 'expenses.html' ? 'active' : ''}"><i class="fa fa-money-bill-wave"></i> <span class="link-text">Gastos</span></a>
        <a href="settings.html" class="sidebar-link ${currentPage === 'settings.html' ? 'active' : ''}"><i class="fa fa-cog"></i> <span class="link-text">Ajustes</span></a>
        <a href="support.html" class="sidebar-link ${currentPage === 'support.html' ? 'active' : ''}"><i class="fa fa-headset"></i> <span class="link-text">Soporte Técnico</span></a>
      </nav>
      <div style="margin-top: auto; padding: 15px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.5); border-top: 1px solid rgba(255,255,255,0.1);">
        © 2026 GestorFX | Desarrollado por <a href="https://www.grisalistech.com" target="_blank" style="color: rgba(255,255,255,0.8); text-decoration: none;">Grisalis Technologies</a>
      </div>
    `;

    // Main Content Wrapper
    const mainWrapper = document.createElement('div');
    mainWrapper.className = 'main-content-wrapper';

    // Navbar
    const navbar = document.createElement('div');
    navbar.className = 'top-navbar';
    navbar.innerHTML = `
      <div class="d-flex align-items-center">
        <button id="sidebar-toggle" class="btn btn-link text-white"><i class="fa fa-bars"></i></button>
        <div class="page-title">Configuración</div>
      </div>
      <div class="user-profile" id="user-info-header">
        <div class="user-info">
          <div class="user-name">${name}</div>
          <div class="user-role">${role === 'admin' ? 'Administrador' : 'Usuario'}</div>
        </div>
        <button id="logout-btn" class="btn btn-outline-danger btn-sm" title="Salir"><i class="fa fa-sign-out-alt"></i></button>
      </div>
    `;

    // Mover el contenido existente (.container) dentro del nuevo layout
    const contentContainer = document.createElement('div');
    contentContainer.className = 'content-container';
    const originalContainer = document.querySelector('.container');
    if (originalContainer) contentContainer.appendChild(originalContainer);

    mainWrapper.appendChild(navbar);
    mainWrapper.appendChild(contentContainer);
    appWrapper.appendChild(sidebar);
    appWrapper.appendChild(mainWrapper);
    
    // Insertar al inicio del body
    document.body.insertBefore(appWrapper, document.body.firstChild);
    // --- FIN LOGICA LAYOUT ERP ---

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

    // Lógica Sidebar Colapsable
    const toggleBtn = document.getElementById('sidebar-toggle');
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    });
    if(localStorage.getItem('sidebar-collapsed') === 'true') sidebar.classList.add('collapsed');
  }

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
