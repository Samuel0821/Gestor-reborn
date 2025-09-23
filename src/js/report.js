document.addEventListener('DOMContentLoaded', () => {
    const reportTypeSelect = document.getElementById('reportType');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const container = document.getElementById("report-container");

    let currentSalesReport = []; // <-- guardamos los datos globalmente

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
                tableHtml += `
                    <tr>
                        <td>${s.invoice_number}</td>
                        <td>${s.sale_date}</td>
                        <td>${formatCOP(s.total_amount)}</td>
                        <td>${itemsHtml}</td>
                    </tr>
                `;
            });

            tableHtml += `
                    </tbody>
                </table>
                <div class="fw-bold text-end fs-5">
                    TOTAL GENERAL: ${formatCOP(report.totalGeneral)}
                </div>
            `;

            container.innerHTML = tableHtml;
            showAlert('Reporte generado correctamente.', 'success');

            // Crear botón Exportar PDF si no existe
            let exportBtn = document.getElementById("btn-export-pdf");
            if (!exportBtn) {
                const btnDiv = document.createElement("div");
                btnDiv.className = "text-end mt-3";
                btnDiv.innerHTML = `
                    <button id="btn-export-pdf" class="btn btn-success">
                        <i class="fa fa-file-pdf me-2"></i>Exportar PDF
                    </button>
                `;
                container.appendChild(btnDiv);
                exportBtn = document.getElementById("btn-export-pdf");

                exportBtn.addEventListener("click", async () => {
                    if (currentSalesReport.length === 0) {
                        showAlert("Primero genera un reporte antes de exportar.", "warning");
                        return;
                    }

                    try {
                        const companyInfo = await window.api.getCompanySettings();
                        const result = await window.api.exportSalesReportPDF({
                            salesReport: currentSalesReport,
                            companyInfo,
                            filename: `Reporte_Ventas_${new Date().toISOString().slice(0,10)}.pdf`
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
            }

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