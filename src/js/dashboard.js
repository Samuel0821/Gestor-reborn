document.addEventListener('DOMContentLoaded', async () => {
  // La lógica del layout ahora se maneja en layout.js

  // --- ESTILOS PERSONALIZADOS PARA DASHBOARD (Modo Oscuro) ---
  const dashboardStyles = document.createElement('style');
  dashboardStyles.innerHTML = `
    /* Adaptación de tarjetas y listas en modo oscuro */
    body.dark-mode .card {
        background-color: #1e293b;
        border-color: #334155;
    }
    body.dark-mode .card-header {
        background-color: #1e293b;
        border-bottom-color: #334155;
    }
    body.dark-mode .list-group-item {
        background-color: #1e293b;
        border-color: #334155;
        color: #cbd5e1;
    }
    body.dark-mode .list-group-item-action:hover {
        background-color: #334155;
        color: #fff;
    }
  `;
  document.head.appendChild(dashboardStyles);
  // -----------------------------------------------------------

  // 1. Configuración Inicial Dashboard
  const userName = localStorage.getItem('user_name') || 'Usuario';
  const welcomeMsg = document.getElementById('welcome-msg');
  if (welcomeMsg) welcomeMsg.textContent = `Buen día, ${userName} `;
  
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateEl = document.getElementById('current-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('es-ES', options);

  // 2. Configurar Filtros de Fecha (Por defecto: Mes actual)
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const startInput = document.getElementById('filter-start-date');
  const endInput = document.getElementById('filter-end-date');
  
  if(startInput) startInput.value = firstDay;
  if(endInput) endInput.value = lastDay;

  document.getElementById('apply-filter-btn')?.addEventListener('click', () => {
      loadDashboardData(startInput.value, endInput.value);
  });

  // 4. Cargar Datos Iniciales
  loadDashboardData(firstDay, lastDay);
});

async function loadDashboardData(startDate, endDate) {
  try {
      const [stats, recentActivity, lowStock, dueOrders, scheduledServices, openServices] = await Promise.all([
          window.api.getAdvancedDashboardStats({ startDate, endDate }),
          window.api.getRecentActivity(),
          window.api.getLowStockProducts(),
          window.api.getDuePurchaseOrders(),
          window.api.getPendingScheduledServices(),
          window.api.getOpenServicesList()
      ]);

      if (stats) {
          renderKPIs(stats);
          renderCharts(stats);
      }
      
      renderActivity(recentActivity);
      renderAlerts(stats ? stats.alerts : {}, lowStock, dueOrders);
      renderServiceWidgets(scheduledServices, openServices);

  } catch (error) {
      console.error("Error cargando dashboard:", error);
  }
};

// --- RENDERIZADO DE KPIs ---
function renderKPIs(stats) {
    const formatMoney = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
    const formatNum = (num) => new Intl.NumberFormat('es-CO').format(num);

    // Ventas Hoy
    updateKpi('kpi-sales-today', stats.salesToday, true);
    
    // Tendencia
    const trendEl = document.getElementById('kpi-sales-trend');
    if (trendEl) {
        let trendPercent = 0;
        if (stats.salesYesterday > 0) {
            trendPercent = ((stats.salesToday - stats.salesYesterday) / stats.salesYesterday) * 100;
        } else if (stats.salesToday > 0) {
            trendPercent = 100;
        }
        
        const trendIcon = trendPercent >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
        const trendClass = trendPercent >= 0 ? 'up' : 'down';
        trendEl.className = `kpi-trend ${trendClass}`;
        trendEl.innerHTML = `<i class="fa ${trendIcon} me-1"></i> ${Math.abs(trendPercent).toFixed(1)}% vs ayer`;
    }

    // Utilidad Neta
    updateKpi('kpi-net-profit', stats.financials.netProfit, true);

    // Alertas
    const totalAlerts = (stats.alerts.lowStock || 0) + (stats.alerts.pendingOrders || 0);
    updateKpi('kpi-alerts-count', totalAlerts, false);

    // Deudores
    updateKpi('kpi-debtors', stats.alerts.debtors || 0, false);

    // --- NUEVAS TARJETAS ---
    if (stats.general) {
        updateKpi('kpi-inventory-value', stats.general.inventoryValue, true);
        updateKpi('kpi-total-products', stats.general.totalProducts, false);
        updateKpi('kpi-total-clients', stats.general.totalClients, false);
        updateKpi('kpi-total-suppliers', stats.general.totalSuppliers, false);
        updateKpi('kpi-pending-po', stats.general.pendingPOPayments, true);
        
        // Inyectar tarjeta de Servicios Abiertos si no existe
        if (!document.getElementById('kpi-open-services')) {
            const kpiContainer = document.getElementById('kpi-sales-today')?.closest('.row');
            if (kpiContainer) {
                const html = `
                <div class="col-md-3 mb-4">
                    <div class="kpi-card" id="card-open-services" style="cursor: pointer;" title="Ir a Servicios Abiertos">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <div class="kpi-label">Servicios Abiertos</div>
                                <div class="kpi-value text-primary" id="kpi-open-services">0</div>
                                <div class="small text-muted mt-1">En ejecución</div>
                            </div>
                            <div class="kpi-icon-wrapper bg-primary bg-opacity-10 text-primary">
                                <i class="fa fa-concierge-bell"></i>
                            </div>
                        </div>
                    </div>
                </div>`;
                kpiContainer.insertAdjacentHTML('beforeend', html);
                
                document.getElementById('card-open-services').addEventListener('click', () => {
                    sessionStorage.setItem('serviceFilterStatus', 'Abierto');
                    window.location.href = 'services.html';
                });
            }
        }
        updateKpi('kpi-open-services', stats.openServices || 0, false);
    }
}

function updateKpi(id, value, isMoney) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('skeleton');
    
    // Animación CountUp simple
    const start = 0;
    const end = value;
    const duration = 1000;
    const startTime = performance.now();

    const format = (num) => {
        return isMoney 
            ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num)
            : new Intl.NumberFormat('es-CO').format(Math.floor(num));
    };

    const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing easeOutQuart
        const ease = 1 - Math.pow(1 - progress, 4);
        
        const currentVal = start + (end - start) * ease;
        el.textContent = format(currentVal);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            el.textContent = format(end);
        }
    };
    
    requestAnimationFrame(animate);
}

// --- GRÁFICOS (Chart.js) ---
function renderCharts(stats) {
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#cbd5e1' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    // 1. Top Productos (Bar Chart)
    const ctxProducts = document.getElementById('topProductsChart');
    if (ctxProducts) {
        new Chart(ctxProducts.getContext('2d'), {
            type: 'bar',
            data: {
                labels: stats.topProducts.map(p => p.name),
                datasets: [{
                    label: 'Unidades Vendidas',
                    data: stats.topProducts.map(p => p.qty),
                    backgroundColor: 'rgba(13, 42, 87, 0.7)',
                    borderColor: 'rgba(13, 42, 87, 1)',
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        titleColor: isDark ? '#f1f5f9' : '#0f172a',
                        bodyColor: isDark ? '#cbd5e1' : '#334155',
                        borderColor: gridColor,
                        borderWidth: 1
                    }
                },
                scales: { 
                    y: { 
                        beginAtZero: true,
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor }
                    }
                }
            }
        });
    }

    // 2. Métodos de Pago (Doughnut)
    const ctxPayment = document.getElementById('paymentMethodsChart');
    if (ctxPayment) {
        new Chart(ctxPayment.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Efectivo', 'Transferencia', 'Crédito'],
                datasets: [{
                    data: [stats.paymentMethods.cash, stats.paymentMethods.transfer, stats.paymentMethods.credit],
                    backgroundColor: ['#2ecc71', '#3498db', '#f1c40f'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                borderColor: isDark ? '#1e293b' : '#ffffff',
                plugins: { 
                    legend: { 
                        position: 'bottom', 
                        labels: { 
                            boxWidth: 12, 
                            font: { size: 11 },
                            color: textColor
                        } 
                    } 
                }
            }
        });
    }
}

// --- ACTIVIDAD RECIENTE ---
function renderActivity(activities) {
    const container = document.getElementById('activity-list');
    if (!container) return;
    container.innerHTML = '';

    if (!activities || activities.length === 0) {
        container.innerHTML = '<div class="text-muted small">No hay actividad reciente.</div>';
        return;
    }

    activities.forEach(act => {
        const date = new Date(act.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const html = `
            <div class="activity-item">
                <div class="fw-bold text-dark" style="font-size: 0.95rem;">${act.description}</div>
                <div class="text-muted small"><i class="fa fa-clock me-1"></i>${date}</div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

// --- ALERTAS ---
function renderAlerts(alertCounts, lowStockProducts, dueOrders) {
    const container = document.getElementById('alerts-container');
    if (!container) return;
    container.innerHTML = '';

    // 1. Stock Bajo
    if (lowStockProducts && lowStockProducts.length > 0) {
        const rows = lowStockProducts.map(p => `
            <tr>
                <td class="ps-3"><small class="fw-bold text-dark">${p.code}</small></td>
                <td><small class="text-dark">${p.name}</small></td>
                <td class="text-center"><small class="text-muted">${p.min_stock}</small></td>
                <td class="text-center pe-3"><small class="fw-bold text-danger">${p.stock}</small></td>
            </tr>
        `).join('');

        const alertHtml = `
            <div class="alert alert-danger p-0 overflow-hidden mb-3" style="border: 1px solid #f5c6cb;">
                <div class="d-flex align-items-center p-3 bg-danger bg-opacity-10">
                    <i class="fa fa-exclamation-triangle me-3 fs-4 text-danger"></i>
                    <div>
                        <div class="fw-bold text-danger">${lowStockProducts.length} Productos con Stock Bajo</div>
                        <div class="small text-danger opacity-75">Requieren reabastecimiento urgente.</div>
                    </div>
                </div>
                <div class="bg-white" style="max-height: 200px; overflow-y: auto;">
                    <table class="table table-sm table-hover mb-0">
                        <thead class="table-light sticky-top">
                            <tr>
                                <th class="ps-3 small text-muted">Cód</th>
                                <th class="small text-muted">Producto</th>
                                <th class="text-center small text-muted">Min</th>
                                <th class="text-center pe-3 small text-muted">Actual</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', alertHtml);
    }

    // 2. Cuentas por Pagar (Vencidas o Próximas)
    if (dueOrders && dueOrders.length > 0) {
        const rows = dueOrders.map(o => `
            <tr>
                <td class="ps-3"><small class="fw-bold text-dark">${o.po_number || o.id}</small></td>
                <td><small class="text-dark">${o.supplier_name}</small></td>
                <td class="text-center"><small class="text-danger fw-bold">${o.due_date}</small></td>
                <td class="text-end pe-3"><small>${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(o.outstanding_balance)}</small></td>
            </tr>
        `).join('');

        const alertHtml = `
            <div class="alert alert-warning p-0 overflow-hidden mb-3" style="border: 1px solid #ffeeba;">
                <div class="d-flex align-items-center p-3 bg-warning bg-opacity-10">
                    <i class="fa fa-clock me-3 fs-4 text-warning"></i>
                    <div>
                        <div class="fw-bold text-dark">${dueOrders.length} Cuentas por Pagar (Vencidas/Próximas)</div>
                        <div class="small text-muted">Facturas que requieren atención inmediata.</div>
                    </div>
                </div>
                <div class="bg-white" style="max-height: 200px; overflow-y: auto;">
                    <table class="table table-sm table-hover mb-0">
                        <thead class="table-light sticky-top">
                            <tr>
                                <th class="ps-3 small text-muted">OC#</th>
                                <th class="small text-muted">Proveedor</th>
                                <th class="text-center small text-muted">Vence</th>
                                <th class="text-end pe-3 small text-muted">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', alertHtml);
    }

    // 2. Órdenes Pendientes
    if (alertCounts && alertCounts.pendingOrders > 0) {
        const alertHtml = `
            <div class="alert alert-warning d-flex align-items-center mb-2 py-2">
                <i class="fa fa-truck-loading me-3 fs-4"></i>
                <div>
                    <div class="fw-bold">${alertCounts.pendingOrders} Órdenes de Compra Pendientes</div>
                    <div class="small">Mercancía por recibir.</div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', alertHtml);
    }

    if ((!alertCounts || (alertCounts.lowStock === 0 && alertCounts.pendingOrders === 0 && (!dueOrders || dueOrders.length === 0)))) {
        container.innerHTML = `
            <div class="text-center py-4 text-success">
                <i class="fa fa-check-circle fs-1 mb-2 opacity-50"></i>
                <p class="mb-0 fw-bold">Todo en orden</p>
                <small>No hay alertas críticas en el sistema.</small>
            </div>
        `;
    }

    // Botón exportar PDF Stock
    const btnExport = document.getElementById('export-low-stock-pdf');
    if (btnExport) {
        if (lowStockProducts && lowStockProducts.length > 0) {
            btnExport.classList.remove('d-none');
            btnExport.onclick = async () => {
                const res = await window.api.exportLowStockPDF();
                if (res.success) {
                    Swal.fire('Exportado', 'Reporte guardado correctamente', 'success');
                } else {
                    Swal.fire('Error', res.message, 'error');
                }
            };
        } else {
            btnExport.classList.add('d-none');
        }
    }
}

function renderServiceWidgets(scheduled, open) {
    let container = document.getElementById('services-widgets-row');
    if (!container) {
        // Buscar contenedor principal para inyectar la nueva fila
        const mainContainer = document.querySelector('.content-container .container-fluid') || document.querySelector('.content-container');
        if (mainContainer) {
            container = document.createElement('div');
            container.id = 'services-widgets-row';
            container.className = 'row mt-4';
            mainContainer.appendChild(container);
        } else {
             return; 
        }
    }
    
    container.innerHTML = '';

    // Tarjeta: Servicios Programados (Pendientes de Ejecución)
    const scheduledHtml = `
        <div class="col-md-6 mb-4">
            <div class="card shadow h-100">
                <div class="card-header py-3 d-flex flex-row align-items-center justify-content-between">
                    <h6 class="m-0 font-weight-bold text-primary"><i class="fa fa-calendar-alt me-2"></i>Servicios Programados (Pendientes)</h6>
                </div>
                <div class="card-body p-0">
                    <div class="list-group list-group-flush">
                        ${scheduled && scheduled.length > 0 ? scheduled.map(s => `
                            <a href="services.html" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fw-bold">${s.name}</div>
                                    <div class="small text-muted"><i class="fa fa-user me-1"></i>${s.client_name || 'Sin cliente'}</div>
                                </div>
                                <div class="text-end">
                                    <div class="badge bg-info">${s.scheduled_date}</div>
                                </div>
                            </a>
                        `).join('') : '<div class="text-center text-muted py-4">No hay servicios programados pendientes.</div>'}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Tarjeta: Servicios Abiertos (Borradores)
    const openHtml = `
        <div class="col-md-6 mb-4">
            <div class="card shadow h-100">
                <div class="card-header py-3 d-flex flex-row align-items-center justify-content-between">
                    <h6 class="m-0 font-weight-bold text-info"><i class="fa fa-edit me-2"></i>Borradores de Servicios (Abiertos)</h6>
                </div>
                <div class="card-body p-0">
                    <div class="list-group list-group-flush">
                        ${open && open.length > 0 ? open.map(s => `
                            <a href="services.html" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fw-bold">${s.name}</div>
                                    <div class="small text-muted"><i class="fa fa-user me-1"></i>${s.client_name || 'Sin cliente'}</div>
                                </div>
                                <div class="text-end">
                                    <div class="text-success fw-bold">${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(s.price)}</div>
                                </div>
                            </a>
                        `).join('') : '<div class="text-center text-muted py-4">No hay servicios abiertos.</div>'}
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = scheduledHtml + openHtml;
}
