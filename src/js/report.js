document.addEventListener('DOMContentLoaded', () => {
    const reportTypeSelect = document.getElementById('reportType');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    function showAlert(message, type = 'danger') {
        let alertDiv = document.getElementById('report-alert');
        if (!alertDiv) {
            alertDiv = document.createElement('div');
            alertDiv.id = 'report-alert';
            alertDiv.className = 'mt-3';
            document.querySelector('.report-form').before(alertDiv);
        }
        alertDiv.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
            <i class="fa fa-exclamation-circle me-2"></i>${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>`;
    }

    async function loadReport(startDate, endDate) {
        try {
            const report = await window.api.getSalesReport({ startDate, endDate });
            console.log("Ventas del período:", report.sales);
            console.log("TOTAL:", report.totalGeneral);
            const container = document.getElementById("report-container");
            container.innerHTML = `
                <h5>Ventas del ${startDate} al ${endDate}</h5>
                <ul>
                  ${report.sales.map(s => `
                    <li>
                      <strong>${s.invoice_number}</strong> - ${s.sale_date} - ${s.total_amount}
                      <ul>
                        ${s.items.map(it => `<li>${it.product_name} x${it.quantity} = ${it.subtotal}</li>`).join("")}
                      </ul>
                    </li>
                  `).join("")}
                </ul>
                <div class="fw-bold">TOTAL GENERAL: ${report.totalGeneral}</div>
            `;
            showAlert('Reporte generado correctamente.', 'success');
        } catch (err) {
            console.error("Error al cargar el reporte:", err);
            showAlert("Ocurrió un error al generar el reporte.", 'danger');
        }
    }

  window.generateReport = function() {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    if (!startDate || !endDate) {
      showAlert('Por favor, selecciona las fechas.', 'warning');
      return;
    }
    loadReport(startDate, endDate);
  };
});
