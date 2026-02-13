/**
 * GestorFX - Layout Manager
 * Maneja Sidebar, Navbar y Modo Oscuro globalmente.
 */

document.addEventListener("DOMContentLoaded", () => {
    // Verificar si estamos en el login (no aplicar layout)
    if (document.querySelector('.login-page')) return;

    const role = localStorage.getItem('user_role');
    const name = localStorage.getItem('user_name');

    // Si no hay sesión, redirigir (doble verificación)
    if (!role || !name) {
        // window.location.href = 'login.html'; // Dejar que cada página maneje su redirección si es necesario
        return;
    }

    // 1. Aplicar Modo Oscuro Globalmente
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }

    // 2. Construir Layout
    const currentPage = window.location.pathname.split('/').pop();
    const pageTitle = document.title.split('-')[0].trim() || 'GestorFX';

    const appWrapper = document.createElement('div');
    appWrapper.className = 'app-wrapper';

    // Sidebar HTML
    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar';
    // Recuperar estado colapsado
    if(localStorage.getItem('sidebar-collapsed') === 'true') sidebar.classList.add('collapsed');

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

    // Navbar HTML
    const navbar = document.createElement('div');
    navbar.className = 'top-navbar';
    navbar.innerHTML = `
      <div class="d-flex align-items-center">
        <button id="sidebar-toggle" class="btn btn-link text-white"><i class="fa fa-bars"></i></button>
        <div class="page-title">${pageTitle}</div>
      </div>
      <div class="user-profile" id="user-info-header">
        <button id="theme-toggle" class="btn btn-link text-white me-2" title="Cambiar tema">
            <i class="fa ${isDarkMode ? 'fa-sun' : 'fa-moon'}"></i>
        </button>
        <div class="user-info">
          <div class="user-name">${name}</div>
          <div class="user-role">${role === 'admin' ? 'Administrador' : 'Usuario'}</div>
        </div>
        <button id="logout-btn" class="btn btn-outline-danger btn-sm" title="Salir"><i class="fa fa-sign-out-alt"></i></button>
      </div>
    `;

    // Main Content Wrapper
    const mainWrapper = document.createElement('div');
    mainWrapper.className = 'main-content-wrapper';

    // Mover contenido existente
    const contentContainer = document.createElement('div');
    contentContainer.className = 'content-container';
    
    // Buscar contenedor principal (puede ser .container o .container-fluid)
    const originalContainer = document.querySelector('.container, .container-fluid');
    if (originalContainer) {
        contentContainer.appendChild(originalContainer);
    }

    mainWrapper.appendChild(navbar);
    mainWrapper.appendChild(contentContainer);
    appWrapper.appendChild(sidebar);
    appWrapper.appendChild(mainWrapper);
    
    document.body.insertBefore(appWrapper, document.body.firstChild);

    // 3. Event Listeners Globales
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

    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    });

    document.getElementById('theme-toggle').addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDark);
        
        const icon = this.querySelector('i');
        if (isDark) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    });
});