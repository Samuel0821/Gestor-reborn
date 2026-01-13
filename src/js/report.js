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
          <div class="sidebar-brand"><i class="fa fa-cubes me-2"></i> GestorFX</div>
          <nav class="sidebar-menu">
            <a href="index.html" class="sidebar-link ${currentPage === 'index.html' ? 'active' : ''}"><i class="fa fa-home"></i> Dashboard</a>
            <a href="sales.html" class="sidebar-link ${currentPage === 'sales.html' ? 'active' : ''}"><i class="fa fa-shopping-cart"></i> Ventas</a>
            <a href="products.html" class="sidebar-link ${currentPage === 'products.html' ? 'active' : ''}"><i class="fa fa-box"></i> Productos</a>
            <a href="clients.html" class="sidebar-link ${currentPage === 'clients.html' ? 'active' : ''}"><i class="fa fa-users"></i> Clientes</a>
            <a href="suppliers.html" class="sidebar-link ${currentPage === 'suppliers.html' ? 'active' : ''}"><i class="fa fa-truck"></i> Proveedores</a>
            <a href="quotes.html" class="sidebar-link ${currentPage === 'quotes.html' ? 'active' : ''}"><i class="fa fa-file-invoice-dollar"></i> Cotizaciones</a>
            <a href="purchase_orders.html" class="sidebar-link ${currentPage === 'purchase_orders.html' ? 'active' : ''}"><i class="fa fa-clipboard-list"></i> Órdenes Compra</a>
            <a href="services.html" class="sidebar-link ${currentPage === 'services.html' ? 'active' : ''}"><i class="fa fa-concierge-bell"></i> Servicios</a>
            <a href="reports.html" class="sidebar-link ${currentPage === 'reports.html' ? 'active' : ''}"><i class="fa fa-chart-line"></i> Reportes</a>
            <a href="settings.html" class="sidebar-link ${currentPage === 'settings.html' ? 'active' : ''}"><i class="fa fa-cog"></i> Ajustes</a>
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
            <div class="page-title">Reportes y Estadísticas</div>
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

    const reportTypeSelect = document.getElementById('reportType');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const container = document.getElementById("report-container");

    let currentSalesReport = [];

    function formatCOP(value) {
        const num = Number(value) || 0;
        return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            minimumFractionDigits: 0,
        }).format(Math.round(num));
    }

    function showAlert(message, type = 'danger') {
        let alertDiv = document.getElementById('report-alert');
        if (!alertDiv) {
            alertDiv = document.createElement('div');
            alertDiv.id = 'report-alert';
            alertDiv.className = 'mt-3';
            document.querySelector('.report-form').before(alertDiv);
        }
        alertDiv.innerHTML = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                <i class="fa fa-exclamation-circle me-2"></i>${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
    }

    async function loadReport(startDate, endDate, reportType) {
        try {
            const report = await window.api.getSalesReport({ startDate, endDate, reportType });
            currentSalesReport = report.sales || [];
            
            // Elimina el botón de exportar PDF si ya existe
            const existingBtnDiv = document.getElementById("export-btn-container");
            if (existingBtnDiv) {
                existingBtnDiv.remove();
            }

            if (currentSalesReport.length === 0) {
                container.innerHTML = `
                    <h5>Ventas (${reportType}) del ${startDate} al ${endDate}</h5>
                    <div class="text-center p-3">
                        <p class="text-muted">No se encontraron ventas para el período seleccionado.</p>
                    </div>
                `;
                showAlert('No hay ventas en el período seleccionado.', 'info');
                return;
            }

            let tableHtml = `
                <h5>Ventas (${reportType}) del ${startDate} al ${endDate}</h5>
                <table class="table table-striped table-bordered">
                    <thead>
                        <tr>
                            <th># Factura</th>
                            <th>Fecha</th>
                            <th>Total</th>
                            <th>Utilidad</th>
                            <th>Detalle</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            currentSalesReport.forEach(s => {
                let itemsHtml = `
                    <ul class="mb-0">
                        ${s.items.map(it => `<li>${it.product_name} x${it.quantity} = ${formatCOP(it.subtotal)}</li>`).join("")}
                    </ul>
                `;

                // Agregar detalle de pagos debajo de los productos
                let pagosHtml = `
                    <div class="mt-2 small text-muted">
                        Efectivo: ${formatCOP(s.cash_payment || 0)} | 
                        Transferencia: ${formatCOP(s.transfer_payment || 0)} | 
                        Crédito: ${s.sale_type === "credit" ? formatCOP(s.outstanding_balance || 0) : formatCOP(0)}
                    </div>
                `;

                tableHtml += `
                    <tr>
                        <td>${s.invoice_number}</td>
                        <td>${s.sale_date}</td>
                        <td>${formatCOP(s.total_amount)}</td>
                        <td>${formatCOP(s.profit)}</td>
                        <td>
                            ${itemsHtml}
                            ${pagosHtml}
                        </td>
                    </tr>
                `;
            });

            tableHtml += `
                    </tbody>
                </table>
                <div class="fw-bold text-end fs-5 mt-2">
                    UTILIDAD TOTAL: ${formatCOP(report.totalProfit)}
                </div>
                <div class="fw-bold text-end fs-5">
                    TOTAL GENERAL: ${formatCOP(report.totalGeneral)}
                </div>
            `;

            container.innerHTML = tableHtml;
            showAlert('Reporte generado correctamente.', 'success');

            // Crear el botón de exportar PDF solo si hay datos
            const btnDiv = document.createElement("div");
            btnDiv.id = "export-btn-container";
            btnDiv.className = "text-end mt-3";
            btnDiv.innerHTML = `
                <button id="btn-export-pdf" class="btn btn-success">
                    <i class="fa fa-file-pdf me-2"></i>Exportar PDF
                </button>
            `;
            container.appendChild(btnDiv);

            const exportBtn = document.getElementById("btn-export-pdf");
            exportBtn.addEventListener("click", async () => {
                try {
                    const companyInfo = await window.api.getCompanySettings();
                    const result = await window.api.exportSalesReportPDF({
                        salesReport: currentSalesReport,
                        companyInfo,
                        filename: `Reporte_Ventas_${new Date().toISOString().slice(0, 10)}.pdf`
                    });
                    if (result.success) {
                        showAlert("Reporte exportado correctamente: " + result.filePath, "success");
                    } else {
                        showAlert("Error al exportar PDF: " + result.message, "danger");
                    }
                } catch (err) {
                    console.error(err);
                    showAlert("Ocurrió un error al exportar PDF.", "danger");
                }
            });

        } catch (err) {
            console.error("Error al cargar el reporte:", err);
            showAlert("Ocurrió un error al generar el reporte.", 'danger');
        }
    }

    window.showAlert = showAlert;
    window.loadReport = loadReport;

    window.generateReport = function() {
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const reportType = reportTypeSelect.value;

        if (!startDate || !endDate) {
            showAlert('Por favor, selecciona las fechas.', 'warning');
            return;
        }

        if (endDate < startDate) {
            showAlert('La fecha final no puede ser anterior a la inicial.', 'warning');
            return;
        }

        loadReport(startDate, endDate, reportType);
    };
});
