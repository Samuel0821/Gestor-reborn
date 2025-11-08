document.addEventListener('DOMContentLoaded', async () => {
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
    <div class="col-md-3"><div class="card p-3">
      <h5>Clientes</h5><div class="display-6">${data.clients}</div></div></div>
    <div class="col-md-3"><div class="card p-3">
      <h5>Productos</h5><div class="display-6">${data.products}</div></div></div>
    <div class="col-md-3"><div class="card p-3">
      <h5>Proveedores</h5><div class="display-6">${suppliersCount}</div></div></div>
    <div class="col-md-3"><div class="card p-3">
      <h5>Ventas</h5><div class="display-6">${data.sales}</div></div></div>
    <div class="col-md-3"><div class="card p-3">
      <h5>Cotizaciones</h5><div class="display-6">${data.quotes}</div></div></div>
    <div class="col-md-3"><div class="card p-3">
      <h5>Órdenes de Compra</h5><div class="display-6">${purchaseOrdersCount}</div></div></div>
  `;
});
