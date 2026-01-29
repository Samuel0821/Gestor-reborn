document.addEventListener('DOMContentLoaded', () => {
    // Mostrar usuario logueado y Layout
    const role = localStorage.getItem('user_role');
    const name = localStorage.getItem('user_name');
    
    if (role && name) {
        const currentPage = window.location.pathname.split('/').pop();
        const appWrapper = document.createElement('div');
        appWrapper.className = 'app-wrapper';

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
        `;

        const mainWrapper = document.createElement('div');
        mainWrapper.className = 'main-content-wrapper';

        const navbar = document.createElement('div');
        navbar.className = 'top-navbar';
        navbar.innerHTML = `
          <div class="d-flex align-items-center">
            <button id="sidebar-toggle" class="btn btn-link text-white"><i class="fa fa-bars"></i></button>
            <div class="page-title">Control de Gastos</div>
          </div>
          <div class="user-profile">
            <div class="user-info">
              <div class="user-name">${name}</div>
              <div class="user-role">${role === 'admin' ? 'Administrador' : 'Usuario'}</div>
            </div>
            <button id="logout-btn" class="btn btn-outline-danger btn-sm" title="Salir"><i class="fa fa-sign-out-alt"></i></button>
          </div>
        `;

        const contentContainer = document.createElement('div');
        contentContainer.className = 'content-container';
        const originalContainer = document.querySelector('.container');
        if (originalContainer) contentContainer.appendChild(originalContainer);

        mainWrapper.appendChild(navbar);
        mainWrapper.appendChild(contentContainer);
        appWrapper.appendChild(sidebar);
        appWrapper.appendChild(mainWrapper);
        document.body.insertBefore(appWrapper, document.body.firstChild);

        document.getElementById('logout-btn').addEventListener('click', () => {
            if(confirm('¿Cerrar sesión?')) {
                ['user_id', 'user_role', 'user_name', 'logueado', 'valor_inicial_dia'].forEach(k => localStorage.removeItem(k));
                window.location.href = 'login.html';
            }
        });

        const toggleBtn = document.getElementById('sidebar-toggle');
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
        });
        if(localStorage.getItem('sidebar-collapsed') === 'true') sidebar.classList.add('collapsed');
    }

    // Lógica de Gastos
    const form = document.getElementById('expense-form');
    const tableBody = document.getElementById('expenses-table-body');
    const totalDisplay = document.getElementById('total-expenses');
    
    // Establecer fecha de hoy por defecto
    document.getElementById('expense-date').valueAsDate = new Date();

    // Modal de detalle
    const modalHtml = `
      <div class="modal fade" id="expenseDetailModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Detalle de Egreso</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p><strong>Fecha:</strong> <span id="detail-date"></span></p>
              <p><strong>Categoría:</strong> <span id="detail-category"></span></p>
              <p><strong>Descripción:</strong> <span id="detail-desc"></span></p>
              <p><strong>Monto:</strong> <span id="detail-amount" class="text-danger fw-bold"></span></p>
              <p><strong>Registrado:</strong> <span id="detail-created"></span></p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
              <button type="button" class="btn btn-primary" id="btn-export-modal">Exportar PDF</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const detailModal = new bootstrap.Modal(document.getElementById('expenseDetailModal'));
    let currentDetailId = null;

    function formatCOP(value) {
        return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value);
    }

    async function loadExpenses() {
        const expenses = await window.api.getExpenses(); // Requiere backend
        tableBody.innerHTML = '';
        let total = 0;

        expenses.forEach(exp => {
            total += exp.amount;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${exp.date}</td>
                <td>${exp.description}</td>
                <td><span class="badge bg-secondary">${exp.category}</span></td>
                <td class="text-end text-danger fw-bold">-${formatCOP(exp.amount)}</td>
                <td>
                    <button class="btn btn-sm btn-info view-expense me-1" data-id="${exp.id}" title="Ver Detalle"><i class="fa fa-eye"></i></button>
                    <button class="btn btn-sm btn-secondary export-expense me-1" data-id="${exp.id}" title="Exportar PDF"><i class="fa fa-file-pdf"></i></button>
                    <button class="btn btn-sm btn-outline-danger delete-expense" data-id="${exp.id}" title="Eliminar"><i class="fa fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        totalDisplay.textContent = `Total: ${formatCOP(total)}`;

        // Eventos botones
        document.querySelectorAll('.view-expense').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                const exp = await window.api.getExpenseById(id);
                if(exp) {
                    currentDetailId = id;
                    document.getElementById('detail-date').textContent = exp.date;
                    document.getElementById('detail-category').textContent = exp.category;
                    document.getElementById('detail-desc').textContent = exp.description;
                    document.getElementById('detail-amount').textContent = formatCOP(exp.amount);
                    document.getElementById('detail-created').textContent = exp.created_at || '-';
                    detailModal.show();
                }
            });
        });

        document.querySelectorAll('.export-expense').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                const res = await window.api.exportExpensePDF(id);
                if(res.success) alert(`PDF exportado: ${res.filePath}`);
                else alert(res.message);
            });
        });

        document.querySelectorAll('.delete-expense').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm('¿Eliminar este gasto?')) {
                    await window.api.deleteExpense(e.currentTarget.dataset.id); // Requiere backend
                    loadExpenses();
                }
            });
        });
    }

    document.getElementById('btn-export-modal').addEventListener('click', async () => {
        if(currentDetailId) {
            const res = await window.api.exportExpensePDF(currentDetailId);
            if(res.success) alert(`PDF exportado: ${res.filePath}`);
            else alert(res.message);
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const expense = {
            description: document.getElementById('expense-desc').value,
            amount: Number(document.getElementById('expense-amount').value),
            category: document.getElementById('expense-category').value,
            date: document.getElementById('expense-date').value
        };

        const res = await window.api.saveExpense(expense); // Requiere backend
        if(res.success) {
            form.reset();
            document.getElementById('expense-date').valueAsDate = new Date();
            loadExpenses();
        } else {
            alert('Error al guardar gasto');
        }
    });

    loadExpenses();
});