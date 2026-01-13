document.addEventListener('DOMContentLoaded', async () => {
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
      <div class="sidebar-brand"><i class="fa fa-cubes"></i> <span class="brand-text ms-2">GestorFX</span></div>
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
        <a href="settings.html" class="sidebar-link ${currentPage === 'settings.html' ? 'active' : ''}"><i class="fa fa-cog"></i> <span class="link-text">Ajustes</span></a>
        <a href="support.html" class="sidebar-link ${currentPage === 'support.html' ? 'active' : ''}"><i class="fa fa-headset"></i> <span class="link-text">Soporte Técnico</span></a>
      </nav>
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
        <div class="page-title">Dashboard</div>
      </div>
      <div class="user-profile">
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

    document.getElementById('logout-btn').addEventListener('click', () => {
      if(confirm('¿Cerrar sesión?')) {
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

  // Función para mostrar alertas
  function showAlert(message, type = 'info') {
    const alertsContainer = document.getElementById('dashboard-alerts');
    if (!alertsContainer) return;
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = 'alert';
    alert.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    alertsContainer.appendChild(alert);
  }
  const container = document.getElementById('dashboard-cards');
  const alertsContainer = document.getElementById('low-stock-alerts');
  const data = await window.api.getDashboardData();
  const suppliersCount = await window.api.getSuppliersCount();
  const purchaseOrdersCount = await window.api.getPurchaseOrdersCount();
  const lowStock = await window.api.getLowStockProducts();
  let alertsHtml = '';
  if (lowStock.length) {
    alertsHtml = `<div class="col-12 mb-3">
      <div class="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
        <div>
          <strong>¡Productos en stock mínimo!</strong> (${lowStock.length} productos)
        </div>
        <button id="export-low-stock-btn" class="btn btn-sm btn-danger">
          <i class="fa fa-file-pdf me-1"></i> Exportar PDF
        </button>
      </div>
      <div class="card p-3 mt-2" style="max-height: 150px; overflow-y: auto;">
          <ul class="mb-0">
            ${lowStock.map(p => `<li><i class='fa fa-triangle-exclamation text-danger me-2'></i>${p.name} (${p.code}) - Stock: <strong>${p.stock}</strong> / Mínimo: <strong>${p.min_stock}</strong></li>`).join('')}
          </ul>
      </div>
    </div>`;
    alertsContainer.innerHTML = alertsHtml;

    document.getElementById('export-low-stock-btn').addEventListener('click', async () => {
      const result = await window.api.exportLowStockPDF();
      if (result.success) {
        showAlert(`Reporte de bajo stock guardado en: ${result.filePath}`, 'success');
      } else {
        showAlert(result.message, 'danger');
      }
    });
  }
  container.innerHTML = `
    <div class="col-md-3"><div class="card p-3 dashboard-card">
      <h5>Clientes</h5><div class="display-6">${data.clients}</div></div></div>
    <div class="col-md-3"><div class="card p-3 dashboard-card">
      <h5>Productos</h5><div class="display-6">${data.products}</div></div></div>
    <div class="col-md-3"><div class="card p-3 dashboard-card">
      <h5>Proveedores</h5><div class="display-6">${suppliersCount}</div></div></div>
    <div class="col-md-3"><div class="card p-3 dashboard-card">
      <h5>Ventas</h5><div class="display-6">${data.sales}</div></div></div>
    <div class="col-md-3"><div class="card p-3 dashboard-card">
      <h5>Cotizaciones</h5><div class="display-6">${data.quotes}</div></div></div>
    <div class="col-md-3"><div class="card p-3 dashboard-card">
      <h5>Servicios</h5><div class="display-6">${data.services}</div></div></div>
    <div class="col-md-3"><div class="card p-3 dashboard-card">
      <h5>Órdenes de Compra</h5><div class="display-6">${purchaseOrdersCount}</div></div></div>
    
    <!-- Gráfico de Ventas -->
    <div class="col-12 mt-4">
      <div class="card p-3 shadow-sm">
        <h5 class="card-title mb-3"><i class="fa fa-chart-area me-2 text-primary"></i>Ventas de los últimos 7 días</h5>
        <canvas id="salesChart" style="max-height: 300px;"></canvas>
      </div>
    </div>
  `;

  // Cargar Chart.js dinámicamente y renderizar gráfico
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
  script.onload = async () => {
    const salesData = await window.api.getSalesLastDays(7);
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: salesData.map(d => d.date),
        datasets: [{
          label: 'Ventas ($)',
          data: salesData.map(d => d.total),
          borderColor: '#1E3A8A',
          backgroundColor: 'rgba(30, 58, 138, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  };
  document.head.appendChild(script);
});
