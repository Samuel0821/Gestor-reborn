document.addEventListener('DOMContentLoaded', () => {
    // Layout manejado por layout.js
    const role = localStorage.getItem('user_role');

    const reportTypeSelect = document.getElementById('reportType');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const container = document.getElementById("report-container");
    const generateBtn = document.getElementById("btn-generate-report");
    
    // Inyectar botones de navegación
    const navDiv = document.createElement('div');
    navDiv.className = 'btn-group mb-4 w-100 shadow-sm';
    navDiv.role = 'group';
    navDiv.innerHTML = `
        <button type="button" class="btn btn-primary active" id="btn-rep-sales"><i class="fa fa-shopping-cart me-2"></i>Reporte Ventas</button>
        <button type="button" class="btn btn-outline-primary" id="btn-rep-expenses"><i class="fa fa-money-bill-wave me-2"></i>Reporte Egresos</button>
        <button type="button" class="btn btn-outline-primary" id="btn-rep-retentions"><i class="fa fa-university me-2"></i>Retenciones (DIAN)</button>
        ${role === 'admin' ? '<button type="button" class="btn btn-outline-primary" id="btn-rep-audit"><i class="fa fa-user-shield me-2"></i>Reporte Modificaciones</button>' : ''}
    `;
    
    // Insertar antes del formulario de fechas
    const reportFormCard = document.querySelector('.report-form')?.closest('.card');
    if (reportFormCard) {
        reportFormCard.parentNode.insertBefore(navDiv, reportFormCard);
    }

    let activeTab = 'sales'; // 'sales', 'expenses', 'audit', 'retentions'

    // Manejadores de eventos para las pestañas
    const btnSales = document.getElementById('btn-rep-sales');
    const btnExpenses = document.getElementById('btn-rep-expenses');
    const btnAudit = document.getElementById('btn-rep-audit');
    const btnRetentions = document.getElementById('btn-rep-retentions');

    function setActiveTab(tab, btn) {
        activeTab = tab;
        [btnSales, btnExpenses, btnAudit, btnRetentions].forEach(b => {
            if(b) {
                b.classList.remove('btn-primary', 'active');
                b.classList.add('btn-outline-primary');
            }
        });
        btn.classList.remove('btn-outline-primary');
        btn.classList.add('btn-primary', 'active');
        
        // Ocultar selector de tipo de reporte si no es ventas (opcional, pero mejora UX)
        if (tab === 'sales') {
            if(reportTypeSelect) reportTypeSelect.parentElement.style.display = 'block';
        } else {
            if(reportTypeSelect) reportTypeSelect.parentElement.style.display = 'none';
        }
        
        // Limpiar contenedor
        container.innerHTML = '<div class="text-center text-muted mt-5">Seleccione un rango de fechas y haga clic en "Generar Reporte"</div>';
    }

    btnSales.addEventListener('click', () => setActiveTab('sales', btnSales));
    btnExpenses.addEventListener('click', () => setActiveTab('expenses', btnExpenses));
    btnRetentions.addEventListener('click', () => setActiveTab('retentions', btnRetentions));
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

    async function loadReport(startDate, endDate, reportType) {
        if (activeTab === 'sales') {
            await loadSalesReport(startDate, endDate, reportType);
        } else if (activeTab === 'expenses') {
            await loadExpensesReport(startDate, endDate);
        } else if (activeTab === 'audit') {
            await loadAuditReport(startDate, endDate);
        } else if (activeTab === 'retentions') {
            await loadRetentionsReport(startDate, endDate);
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
                Swal.fire('Info', 'No hay ventas en el período seleccionado.', 'info');
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
            Swal.fire('Éxito', 'Reporte generado correctamente.', 'success');

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
                        Swal.fire('Éxito', "Reporte exportado correctamente: " + result.filePath, 'success');
                    } else {
                        Swal.fire('Error', "Error al exportar PDF: " + result.message, 'error');
                    }
                } catch (err) {
                    console.error(err);
                    Swal.fire('Error', "Ocurrió un error al exportar PDF.", 'error');
                }
            });

        } catch (err) {
            console.error("Error al cargar el reporte:", err);
            Swal.fire('Error', "Ocurrió un error al generar el reporte.", 'error');
        }
    }

    async function loadExpensesReport(startDate, endDate) {
        try {
            const expenses = await window.api.getExpenses(startDate, endDate);
            
            if (expenses.length === 0) {
                container.innerHTML = `<h5>Reporte de Egresos del ${startDate} al ${endDate}</h5><div class="alert alert-info">No hay gastos registrados en este período.</div>`;
                Swal.fire('Info', 'No hay gastos registrados en este período.', 'info');
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
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5>Reporte de Egresos del ${startDate} al ${endDate}</h5>
                    <button id="btn-export-expenses-pdf" class="btn btn-success"><i class="fa fa-file-pdf me-2"></i>Exportar PDF</button>
                </div>
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

            Swal.fire('Éxito', 'Reporte de egresos generado correctamente.', 'success');

            document.getElementById('btn-export-expenses-pdf').addEventListener('click', async () => {
                const res = await window.api.exportExpensesReportPDF(startDate, endDate);
                if (res.success) {
                    Swal.fire('Éxito', `Reporte exportado: ${res.filePath}`, 'success');
                } else {
                    Swal.fire('Error', res.message, 'error');
                }
            });
        } catch (err) {
            console.error(err);
            Swal.fire('Error', "Error al cargar reporte de egresos.", 'error');
        }
    }

    async function loadRetentionsReport(startDate, endDate) {
        try {
            // Nota: Debes implementar getRetentionsReport en el backend (index.js/database.js)
            // Debería retornar: [{ date, supplier_name, po_number, retention_type, retention_amount, total_payment }]
            const retentions = await window.api.getRetentionsReport({ startDate, endDate });
            
            if (!retentions || retentions.length === 0) {
                container.innerHTML = `<h5>Reporte de Retenciones del ${startDate} al ${endDate}</h5><div class="alert alert-info">No hay retenciones registradas en este período.</div>`;
                Swal.fire('Info', 'No hay retenciones registradas.', 'info');
                return;
            }

            let totalRetained = 0;
            // Agrupar por concepto para facilitar el pago a la DIAN
            const summaryByType = {};

            let rows = retentions.map(r => {
                totalRetained += r.retention_amount;
                
                // Sumar al agrupado
                const typeKey = r.retention_type || 'Otros';
                summaryByType[typeKey] = (summaryByType[typeKey] || 0) + r.retention_amount;

                return `
                    <tr>
                        <td>${r.date}</td>
                        <td>${r.supplier_name} <br><small class="text-muted">OC #${r.po_number} | Fact: ${r.supplier_invoice_number || 'S/N'}</small></td>
                        <td>${r.retention_type}%</td>
                        <td class="text-end">${formatCOP(r.retention_amount)}</td>
                    </tr>
                `;
            }).join('');

            // Generar HTML del resumen por concepto
            let summaryHtml = '<div class="row mb-4"><div class="col-md-6"><div class="card"><div class="card-header bg-light fw-bold">Resumen por Concepto (A Pagar DIAN)</div><ul class="list-group list-group-flush">';
            for (const [type, amount] of Object.entries(summaryByType)) {
                summaryHtml += `<li class="list-group-item d-flex justify-content-between align-items-center">
                    Retención ${type}%
                    <span class="fw-bold">${formatCOP(amount)}</span>
                </li>`;
            }
            summaryHtml += '</ul></div></div></div>';

            container.innerHTML = `
                <h5>Reporte de Retenciones en la Fuente (${startDate} al ${endDate})</h5>
                ${summaryHtml}
                <table class="table table-striped table-bordered mt-3">
                    <thead class="table-light">
                        <tr>
                            <th>Fecha Pago</th>
                            <th>Proveedor / Orden</th>
                            <th>Tarifa</th>
                            <th class="text-end">Valor Retenido</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr class="fw-bold fs-5">
                            <td colspan="3" class="text-end">TOTAL A PAGAR (DIAN):</td>
                            <td class="text-end text-danger">${formatCOP(totalRetained)}</td>
                        </tr>
                    </tfoot>
                </table>
            `;
            Swal.fire('Éxito', 'Reporte de retenciones generado.', 'success');
        } catch (err) {
            console.error(err);
            Swal.fire('Error', "Error al cargar reporte de retenciones. Verifique que el backend tenga la función implementada.", 'error');
        }
    }

    async function loadAuditReport(startDate, endDate) {
        try {
            const logs = await window.api.getAuditLogs({ startDate, endDate });
            
            if (logs.length === 0) {
                container.innerHTML = `<h5>Reporte de Modificaciones del ${startDate} al ${endDate}</h5><div class="alert alert-info">No hay registros de actividad en este período.</div>`;
                Swal.fire('Info', 'No hay registros de actividad en este período.', 'info');
                return;
            }

            let rows = logs.map(log => {
                // SQLite guarda en UTC por defecto. Ajustamos para mostrar hora local correcta.
                let localDate = log.timestamp;
                try {
                    // Agregamos 'Z' para indicar que es UTC y que JS lo convierta a la zona horaria local
                    localDate = new Date(log.timestamp.replace(' ', 'T') + 'Z').toLocaleString();
                } catch (e) {
                    localDate = new Date(log.timestamp).toLocaleString();
                }
                return `
                <tr>
                    <td>${localDate}</td>
                    <td><strong>${log.user_name}</strong></td>
                    <td>${log.action}</td>
                    <td>${log.details || '-'}</td>
                </tr>
            `}).join('');

            container.innerHTML = `
                <h5>Reporte de Modificaciones (Auditoría)</h5>
                <div class="table-responsive">
                    <table class="table table-sm table-bordered">
                        <thead class="table-light">
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
            Swal.fire('Éxito', 'Reporte de auditoría generado correctamente.', 'success');
        } catch (err) {
            console.error(err);
            Swal.fire('Error', "Error al cargar reporte de auditoría.", 'error');
        }
    }

    // Manejo del botón Generar Reporte
    if (generateBtn) {
        generateBtn.addEventListener("click", () => {
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const reportType = reportTypeSelect.value;

        if (!startDate || !endDate) {
            Swal.fire('Atención', 'Por favor, selecciona las fechas.', 'warning');
            return;
        }

        if (endDate < startDate) {
            Swal.fire('Atención', 'La fecha final no puede ser anterior a la inicial.', 'warning');
            return;
        }

        loadReport(startDate, endDate, reportType);
        });
    }
});
