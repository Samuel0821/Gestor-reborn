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
    
    // Inyectar botones de navegación
    const navDiv = document.createElement('div');
    navDiv.className = 'btn-group mb-4 w-100 shadow-sm';
    navDiv.role = 'group';
    navDiv.innerHTML = `
        <button type="button" class="btn btn-primary active" id="btn-rep-sales"><i class="fa fa-shopping-cart me-2"></i>Reporte Ventas</button>
        <button type="button" class="btn btn-outline-primary" id="btn-rep-expenses"><i class="fa fa-money-bill-wave me-2"></i>Reporte Egresos</button>
        ${role === 'admin' ? '<button type="button" class="btn btn-outline-primary" id="btn-rep-audit"><i class="fa fa-user-shield me-2"></i>Reporte Modificaciones</button>' : ''}
    `;
    
    // Insertar antes del formulario de fechas
    const formRow = document.querySelector('.row.g-3');
    if (formRow) {
        formRow.parentNode.insertBefore(navDiv, formRow);
    } else {
        container.before(navDiv);
    }

    let activeTab = 'sales'; // 'sales', 'expenses', 'audit'

    // Manejadores de eventos para las pestañas
    const btnSales = document.getElementById('btn-rep-sales');
    const btnExpenses = document.getElementById('btn-rep-expenses');
    const btnAudit = document.getElementById('btn-rep-audit');

    function setActiveTab(tab, btn) {
        activeTab = tab;
        [btnSales, btnExpenses, btnAudit].forEach(b => {
            if(b) {
                b.classList.remove('btn-primary', 'active');
                b.classList.add('btn-outline-primary');
            }
        });
        btn.classList.remove('btn-outline-primary');
        btn.classList.add('btn-primary', 'active');
        
        // Ocultar selector de tipo de reporte si no es ventas (opcional, pero mejora UX)
        if (tab === 'sales') {
            reportTypeSelect.parentElement.style.display = 'block';
        } else {
            reportTypeSelect.parentElement.style.display = 'none';
        }
        
        // Limpiar contenedor
        container.innerHTML = '<div class="text-center text-muted mt-5">Seleccione un rango de fechas y haga clic en "Generar Reporte"</div>';
    }

    btnSales.addEventListener('click', () => setActiveTab('sales', btnSales));
    btnExpenses.addEventListener('click', () => setActiveTab('expenses', btnExpenses));
    if(btnAudit) btnAudit.addEventListener('click', () => setActiveTab('audit', btnAudit));

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
        if (activeTab === 'sales') {
            await loadSalesReport(startDate, endDate, reportType);
        } else if (activeTab === 'expenses') {
            await loadExpensesReport(startDate, endDate);
        } else if (activeTab === 'audit') {
            await loadAuditReport(startDate, endDate);
        }
    }

    async function loadSalesReport(startDate, endDate, reportType) {
        try {
            const report = await window.api.getSalesReport({ startDate, endDate, reportType });
            const expenses = await window.api.getExpenses(startDate, endDate); // Requiere backend
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
                        Transferencia: ${formatCOP(s.transfer_payment || 0)} ${s.transfer_reference ? `(${s.transfer_reference})` : ''} | 
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

            // Calcular totales financieros
            const totalSales = report.totalGeneral || 0;
            const totalCost = totalSales - (report.totalProfit || 0);
            const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
            const netProfit = (report.totalProfit || 0) - totalExpenses;

            // Agrupar transferencias por banco
            const transfersByBank = {};
            currentSalesReport.forEach(s => {
                if (s.paid_transfer > 0) {
                    const bank = s.transfer_reference || "Otros/Sin Ref";
                    transfersByBank[bank] = (transfersByBank[bank] || 0) + s.paid_transfer;
                }
            });

            let transfersBreakdownHtml = '';
            if (Object.keys(transfersByBank).length > 0) {
                for (const [bank, amount] of Object.entries(transfersByBank)) {
                    transfersBreakdownHtml += `
                        <div class="d-flex justify-content-between ms-3 text-muted" style="font-size: 0.9em;">
                            <span>- ${bank}:</span>
                            <span>${formatCOP(amount)}</span>
                        </div>`;
                }
            }

            const totalIngresado = (report.totalCash || 0) + (report.totalTransfer || 0);
            const totalVentasCalculado = (report.salesCash || 0) + (report.salesTransfer || 0) + (report.salesCredit || 0);

            tableHtml += `
                    </tbody>
                </table>
                
                <div class="row mt-4">
                    <div class="col-md-6">
                        <div class="card bg-light h-100">
                            <div class="card-body">
                                <h5 class="card-title border-bottom pb-2">Resumen de Ventas</h5>
                                <div class="d-flex justify-content-between"><span>Ventas en Efectivo:</span> <strong>${formatCOP(report.salesCash || 0)}</strong></div>
                                <div class="d-flex justify-content-between mt-1"><span>Ventas en Transferencia:</span> <strong>${formatCOP(report.salesTransfer || 0)}</strong></div>
                                <div class="d-flex justify-content-between mt-1 text-warning"><span>Ventas a Crédito:</span> <strong>${formatCOP(report.salesCredit || 0)}</strong></div>
                                <div class="d-flex justify-content-between fw-bold fs-5 mt-3 border-top pt-2">
                                    <span>Total Ventas:</span> 
                                    <span>${formatCOP(totalVentasCalculado)}</span>
                                </div>

                                <h6 class="card-title border-bottom pb-2 mt-4">Ingresos Reales (Caja)</h6>
                                <div class="d-flex justify-content-between"><span>Total Recibido (Efectivo + Transf):</span> <strong class="text-success">${formatCOP(totalIngresado)}</strong></div>
                                <small class="text-muted">* Incluye abonos a créditos anteriores.</small>
                                ${transfersBreakdownHtml}
                            </div>
                        </div>
                    </div>

                    <div class="col-md-6">
                        <div class="card bg-light h-100">
                            <div class="card-body">
                                <h5 class="card-title border-bottom pb-2">Balance Financiero</h5>
                                <div class="d-flex justify-content-between"><span>(+) Total Ventas:</span> <strong>${formatCOP(totalSales)}</strong></div>
                                <div class="d-flex justify-content-between text-muted"><span>(-) Costo Mercancía:</span> <span>${formatCOP(totalCost)}</span></div>
                                <div class="d-flex justify-content-between fw-bold text-primary"><span>(=) Utilidad Bruta:</span> <span>${formatCOP(report.totalProfit)}</span></div>
                                <div class="d-flex justify-content-between text-danger"><span>(-) Total Gastos:</span> <span>${formatCOP(totalExpenses)}</span></div>
                                <div class="d-flex justify-content-between fw-bold fs-5 mt-2 border-top pt-2 ${netProfit >= 0 ? 'text-success' : 'text-danger'}"><span>(=) UTILIDAD NETA REAL:</span> <span>${formatCOP(netProfit)}</span></div>
                            </div>
                        </div>
                    </div>
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
                        filename: `Reporte_Ventas_${new Date().toISOString().slice(0, 10)}.pdf`,
                        financialSummary: {
                            totalSales,
                            totalCost,
                            grossProfit: report.totalProfit,
                            totalExpenses,
                            netProfit
                        },
                        paymentMethodsSummary: {
                            transfersByBank
                        }
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

    async function loadExpensesReport(startDate, endDate) {
        try {
            const expenses = await window.api.getExpenses(startDate, endDate);
            
            if (expenses.length === 0) {
                container.innerHTML = `<h5>Reporte de Egresos del ${startDate} al ${endDate}</h5><div class="alert alert-info">No hay gastos registrados en este período.</div>`;
                return;
            }

            let totalExpenses = 0;
            let rows = expenses.map(exp => {
                totalExpenses += exp.amount;
                return `
                    <tr>
                        <td>${exp.date}</td>
                        <td>${exp.description}</td>
                        <td><span class="badge bg-secondary">${exp.category}</span></td>
                        <td class="text-end">${formatCOP(exp.amount)}</td>
                    </tr>
                `;
            }).join('');

            container.innerHTML = `
                <h5>Reporte de Egresos del ${startDate} al ${endDate}</h5>
                <table class="table table-striped table-hover">
                    <thead class="table-danger">
                        <tr>
                            <th>Fecha</th>
                            <th>Descripción</th>
                            <th>Categoría</th>
                            <th class="text-end">Monto</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr class="fw-bold fs-5">
                            <td colspan="3" class="text-end">TOTAL EGRESOS:</td>
                            <td class="text-end text-danger">${formatCOP(totalExpenses)}</td>
                        </tr>
                    </tfoot>
                </table>
            `;
        } catch (err) {
            console.error(err);
            showAlert("Error al cargar reporte de egresos.", "danger");
        }
    }

    async function loadAuditReport(startDate, endDate) {
        try {
            const logs = await window.api.getAuditLogs({ startDate, endDate });
            
            if (logs.length === 0) {
                container.innerHTML = `<h5>Reporte de Modificaciones del ${startDate} al ${endDate}</h5><div class="alert alert-info">No hay registros de actividad en este período.</div>`;
                return;
            }

            let rows = logs.map(log => `
                <tr>
                    <td>${new Date(log.timestamp).toLocaleString()}</td>
                    <td><strong>${log.user_name}</strong></td>
                    <td>${log.action}</td>
                    <td>${log.details || '-'}</td>
                </tr>
            `).join('');

            container.innerHTML = `
                <h5>Reporte de Modificaciones (Auditoría)</h5>
                <div class="table-responsive">
                    <table class="table table-sm table-bordered">
                        <thead class="table-dark">
                            <tr>
                                <th>Fecha/Hora</th>
                                <th>Usuario</th>
                                <th>Acción</th>
                                <th>Detalles</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        } catch (err) {
            console.error(err);
            showAlert("Error al cargar reporte de auditoría.", "danger");
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
