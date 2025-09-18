document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('dashboard-cards');
  const alertsContainer = document.getElementById('low-stock-alerts');
  const data = await window.api.getDashboardData();
  const lowStock = await window.api.getLowStockProducts();
  let alertsHtml = '';
  if (lowStock.length) {
    alertsHtml = `<div class="col-12 mb-3">
      <div class="alert alert-danger" role="alert">
        <strong>¡Productos en stock mínimo!</strong><br>
        <ul class="mb-0">
          ${lowStock.map(p => `<li><i class='fa fa-triangle-exclamation text-danger me-2'></i>${p.name} (${p.code}) - Stock: <strong>${p.stock}</strong> / Mínimo: <strong>${p.min_stock}</strong></li>`).join('')}
        </ul>
      </div>
    </div>`;
  }
  alertsContainer.innerHTML = alertsHtml;
  container.innerHTML = `
    <div class="col-md-3"><div class="card p-3"><h5>Clientes</h5><div class="display-6">${data.clients}</div></div></div>
    <div class="col-md-3"><div class="card p-3"><h5>Productos</h5><div class="display-6">${data.products}</div></div></div>
    <div class="col-md-3"><div class="card p-3"><h5>Ventas</h5><div class="display-6">${data.sales}</div></div></div>
    <div class="col-md-3"><div class="card p-3"><h5>Cotizaciones</h5><div class="display-6">${data.quotes}</div></div></div>
  `;
});
