document.addEventListener('DOMContentLoaded', async () => {
    // Layout manejado por layout.js

    // --- ESTILOS PERSONALIZADOS PARA EL MENÚ DESPLEGABLE (Modo Oscuro + Efecto Flotante) ---
    const dropdownStyles = document.createElement('style');
    dropdownStyles.innerHTML = `
      /* Contenedor del menú */
      .dropdown-menu {
          border-radius: 12px;
          border: none;
          padding: 8px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          animation: fadeInDrop 0.2s ease-out;
      }
      @keyframes fadeInDrop { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

      /* Items del menú */
      .dropdown-item {
          border-radius: 8px;
          margin-bottom: 3px;
          padding: 8px 15px;
          transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Efecto suave */
          font-weight: 500;
          display: flex;
          align-items: center;
          cursor: pointer;
      }

      /* Iconos dentro de los items */
      .dropdown-item i {
          width: 20px;
          text-align: center;
          transition: transform 0.2s;
      }

      /* EFECTO FLOTANTE AL PASAR EL CURSOR (HOVER) */
      .dropdown-item:hover {
          background-color: #f0f2f5;
          transform: translateX(6px); /* Se mueve a la derecha */
          box-shadow: -4px 4px 10px rgba(0,0,0,0.08); /* Sombra sutil */
      }
      .dropdown-item:hover i {
          transform: scale(1.2); /* El icono crece un poco */
      }

      /* --- ADAPTACIÓN MODO OSCURO --- */
      body.dark-mode .dropdown-menu {
          background-color: #2d333b; /* Gris oscuro elegante */
          border: 1px solid #444c56;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      }
      body.dark-mode .dropdown-item {
          color: #c9d1d9;
      }
      body.dark-mode .dropdown-item:hover {
          background-color: #373e47;
          color: #ffffff;
          box-shadow: -4px 4px 10px rgba(0,0,0,0.3);
      }
      body.dark-mode .dropdown-divider { border-top-color: #444c56; }
    `;
    document.head.appendChild(dropdownStyles);

    // --- ESTILOS ESPECÍFICOS DEL MÓDULO DE CAJA ---
    const cashRegisterStyles = document.createElement('style');
    cashRegisterStyles.innerHTML = `
        .kpi-card {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            transition: all 0.3s ease;
        }
        .kpi-card:hover {
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transform: translateY(-2px);
        }
        .kpi-label {
            font-size: 0.9rem;
            color: #6c757d;
            margin-bottom: 5px;
        }
        .kpi-value {
            font-size: 1.8rem;
            font-weight: bold;
            color: #343a40;
        }
        .kpi-icon-wrapper {
            font-size: 2rem;
            opacity: 0.6;
        }
        body.dark-mode .kpi-card {
            background-color: #2d333b;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        body.dark-mode .kpi-label {
            color: #aeb9c4;
        }
        body.dark-mode .kpi-value {
            color: #e2e8f0;
        }
        .denomination-input {
            width: 80px;
            text-align: center;
        }
        .denomination-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px dashed #eee;
        }
        body.dark-mode .denomination-row {
            border-bottom: 1px dashed #444c56;
        }
    `;
    document.head.appendChild(cashRegisterStyles);

    const role = localStorage.getItem('user_role');
    const userId = localStorage.getItem('user_id');
    const userName = localStorage.getItem('user_name');

    let activeSession = null;
    let durationInterval = null;

    const formatCOP = (value) => {
        return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            minimumFractionDigits: 0
        }).format(value);
    };

    const formatDateTime = (isoString) => {
        if (!isoString) return '-';
        // Reemplazo de espacio por T para asegurar compatibilidad de parseo de fecha local
        const date = new Date(isoString.replace(' ', 'T'));
        return date.toLocaleString();
    };

    // --- UI Elements ---
    const openCashRegisterBtn = document.getElementById('open-cash-register-btn');
    const closeCashRegisterBtn = document.getElementById('close-cash-register-btn');
    const currentSessionInfo = document.getElementById('current-session-info');
    const sessionStatusBadge = document.getElementById('session-status-badge');
    const sessionOpenedAt = document.getElementById('session-opened-at');
    const sessionOpenedBy = document.getElementById('session-opened-by');
    const sessionDuration = document.getElementById('session-duration');
    const sessionOpeningBalance = document.getElementById('session-opening-balance');
    const expectedCashBalance = document.getElementById('expected-cash-balance');
    const cashDifference = document.getElementById('cash-difference');
    const reconciliationDenominations = document.getElementById('reconciliation-denominations');
    const totalCountedCash = document.getElementById('total-counted-cash');
    const manualMovementForm = document.getElementById('manual-movement-form');
    const manualMovementAmount = document.getElementById('manual-movement-amount');
    const manualMovementType = document.getElementById('manual-movement-type');
    const manualMovementDescription = document.getElementById('manual-movement-description');
    const manualMovementBtn = document.getElementById('add-manual-movement-btn');

    const movementsTableBody = document.getElementById('movements-table-body');
    const salesTableBody = document.getElementById('sales-table-body');
    const expensesTableBody = document.getElementById('expenses-table-body');
    const servicePaymentsTableBody = document.getElementById('service-payments-table-body');
    const creditPaymentsTableBody = document.getElementById('credit-payments-table-body');

    const exportReportBtn = document.getElementById('export-cash-report-btn');

    // --- Denominations for Reconciliation ---
    const denominations = [
        100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50
    ];

    function renderDenominations() {
        reconciliationDenominations.innerHTML = '';
        denominations.forEach(denom => {
            const row = document.createElement('div');
            row.className = 'denomination-row';
            row.innerHTML = `
                <span class="fw-bold">${formatCOP(denom)}</span>
                <div class="input-group input-group-sm w-50">
                    <input type="number" class="form-control denomination-input" data-denom="${denom}" value="0" min="0">
                    <span class="input-group-text">x</span>
                    <span class="input-group-text denomination-total">${formatCOP(0)}</span>
                </div>
            `;
            reconciliationDenominations.appendChild(row);
        });

        reconciliationDenominations.querySelectorAll('.denomination-input').forEach(input => {
            input.addEventListener('input', updateReconciliationTotals);
        });
    }

    async function updateReconciliationTotals() {
        let total = 0;
        const countedDenominations = [];
        reconciliationDenominations.querySelectorAll('.denomination-row').forEach(row => {
            const input = row.querySelector('.denomination-input');
            const denom = parseInt(input.dataset.denom);
            const count = parseInt(input.value) || 0;
            const amount = denom * count;
            row.querySelector('.denomination-total').textContent = formatCOP(amount);
            total += amount;
            countedDenominations.push({ denomination: denom, count: count, amount: amount });
        });
        totalCountedCash.textContent = formatCOP(total);

        if (activeSession) {
            const difference = total - activeSession.expected_balance;
            cashDifference.textContent = formatCOP(difference);
            cashDifference.className = `kpi-value ${difference === 0 ? 'text-success' : (difference > 0 ? 'text-primary' : 'text-danger')}`;
            totalCountedCash.textContent = formatCOP(total);

            // Save reconciliation details automatically
            await window.api.saveReconciliationDetails({ sessionId: activeSession.id, denominations: countedDenominations });
        }
    }

    function startDurationTimer(openedAtIso) {
        if (durationInterval) clearInterval(durationInterval);
        
        const updateDuration = () => {
            if (!openedAtIso) return;
            
            const startDate = new Date(openedAtIso.replace(' ', 'T'));
            const now = new Date();
            const diff = now - startDate;

            if (diff < 0) {
                sessionDuration.textContent = "00:00:00";
                return;
            }

            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);

            sessionDuration.textContent = 
                String(hours).padStart(2, '0') + ":" + 
                String(minutes).padStart(2, '0') + ":" + 
                String(seconds).padStart(2, '0');
        };

        updateDuration();
        durationInterval = setInterval(updateDuration, 1000);
    }

    async function loadActiveSession() {
        activeSession = await window.api.getActiveCashSession();
        if (activeSession) {
            document.getElementById('open-session-section').style.display = 'none';
            document.getElementById('active-session-section').style.display = 'block';

            sessionStatusBadge.textContent = activeSession.status === 'open' ? 'Abierta' : 'Cerrada';
            sessionStatusBadge.className = `badge bg-${activeSession.status === 'open' ? 'success' : 'danger'}`;
            sessionOpenedAt.textContent = formatDateTime(activeSession.opened_at_iso);
            sessionOpenedBy.textContent = activeSession.user_name;
            sessionOpeningBalance.textContent = formatCOP(activeSession.opening_balance);
            expectedCashBalance.textContent = formatCOP(activeSession.expected_balance || activeSession.opening_balance);

            // Iniciar cronómetro de duración en tiempo real
            startDurationTimer(activeSession.opened_at_iso);

            // Load reconciliation details if any
            const savedDenominations = await window.api.getReconciliationDetails(activeSession.id);
            if (savedDenominations && savedDenominations.length > 0) {
                reconciliationDenominations.querySelectorAll('.denomination-input').forEach(input => {
                    const denom = parseInt(input.dataset.denom);
                    const saved = savedDenominations.find(d => d.denomination === denom);
                    if (saved) {
                        input.value = saved.count;
                    }
                });
            }
            updateReconciliationTotals(); // Recalculate based on loaded values

            await renderSummary(activeSession.id); // Render summary tab
            // Load and render detailed movements
            await loadSessionDetails(activeSession.id);

            // Enable/disable buttons based on role and session status
            closeCashRegisterBtn.disabled = (role !== 'admin' && activeSession.status !== 'open');
            manualMovementBtn.disabled = activeSession.status !== 'open';
            // Habilitar botón de exportar incluso si la sesión está abierta
            exportReportBtn.disabled = false;

        } else {
            document.getElementById('open-session-section').style.display = 'block';
            document.getElementById('active-session-section').style.display = 'none';

            if (durationInterval) clearInterval(durationInterval);

            // Clear any previous data
            sessionOpenedAt.textContent = '';
            sessionOpenedBy.textContent = '';
            sessionOpeningBalance.textContent = '';
            expectedCashBalance.textContent = formatCOP(0);
            sessionDuration.textContent = '00:00:00';
            totalCountedCash.textContent = formatCOP(0);
            cashDifference.textContent = formatCOP(0);
            renderDenominations(); // Reset denominations input
        }
    }

    async function renderSummary(sessionId) {
        const detailedMovements = await window.api.getCashMovementsDetailed(sessionId);
        const summaryContainer = document.getElementById('summary');
        summaryContainer.innerHTML = ''; // Clear previous content

         const sums = {
            in_cash: 0, in_transfer: 0,
            out_cash: 0, out_transfer: 0,
            sales_cash: 0, sales_transfer: 0,
            credit_cash: 0, credit_transfer: 0,
            service_cash: 0, service_transfer: 0,
            manual_in: 0, manual_out: 0,
            expense_cash: 0, expense_transfer: 0,
            purchase_cash: 0, purchase_transfer: 0,
            refund_cash: 0, refund_transfer: 0
        };
        

        detailedMovements.forEach(m => {
            const amount = m.total_amount || 0;
            const st = (m.sub_type || '').toString();
            const isTransfer = /transfer/i.test(st) || st === 'transfer';
            const isCash = /cash/i.test(st) || (!/transfer/i.test(st) && /cash/i.test(st));

            if (m.type === 'in') {
                if (/sale/i.test(st)) {
                    if (isTransfer) { sums.in_transfer += amount; sums.sales_transfer += amount; }
                    else { sums.in_cash += amount; sums.sales_cash += amount; }
                } else if (/credit/i.test(st)) {
                    if (isTransfer) { sums.in_transfer += amount; sums.credit_transfer += amount; }
                    else { sums.in_cash += amount; sums.credit_cash += amount; }
                } else if (/service/i.test(st)) {
                    if (isTransfer) { sums.in_transfer += amount; sums.service_transfer += amount; }
                    else { sums.in_cash += amount; sums.service_cash += amount; }
                } else if (/manual_in|manual/i.test(st)) {
                    sums.in_cash += amount; sums.manual_in += amount;
                } else {
                    // fallback by transfer flag
                    if (isTransfer) sums.in_transfer += amount; else sums.in_cash += amount;
                }
            } else if (m.type === 'out') {
                if (/expense/i.test(st)) {
                    if (isTransfer) { sums.out_transfer += amount; sums.expense_transfer += amount; }
                    else { sums.out_cash += amount; sums.expense_cash += amount; }
                } else if (/purchase/i.test(st)) {
                    if (isTransfer) { sums.out_transfer += amount; sums.purchase_transfer += amount; }
                    else { sums.out_cash += amount; sums.purchase_cash += amount; }
                } else if (/manual_out|manual/i.test(st)) {
                    sums.out_cash += amount; sums.manual_out += amount;
                } else if (/refund/i.test(st)) {
                    if (isTransfer) { sums.out_transfer += amount; sums.refund_transfer += amount; }
                    else { sums.out_cash += amount; sums.refund_cash += amount; }
                } else {
                    if (isTransfer) sums.out_transfer += amount; else sums.out_cash += amount;
                }
            }
        });


        summaryContainer.innerHTML = `
            <div class="card shadow-sm">
                <div class="card-body">
                     <h5 class="card-title border-bottom pb-2">Resumen de Flujo de Fondos (Sesión Actual)</h5>
                    <div class="row">
                        <div class="col-md-6">
                            <h6 class="text-success"><i class="fas fa-arrow-down me-2"></i>INGRESOS TOTALES</h6>
                            <ul class="list-group list-group-flush">
                                <li class="list-group-item d-flex justify-content-between">Ventas (Efectivo): <span>${formatCOP(sums.sales_cash)}</span></li>
                                <li class="list-group-item d-flex justify-content-between">Ventas (Banco): <span>${formatCOP(sums.sales_transfer)}</span></li>
                                <li class="list-group-item d-flex justify-content-between">Abonos Créditos (Efectivo): <span>${formatCOP(sums.credit_cash)}</span></li>
                                <li class="list-group-item d-flex justify-content-between">Abonos Créditos (Banco): <span>${formatCOP(sums.credit_transfer)}</span></li>
                                <li class="list-group-item d-flex justify-content-between">Abonos Servicios (Efectivo): <span>${formatCOP(sums.service_cash)}</span></li>
                                <li class="list-group-item d-flex justify-content-between">Abonos Servicios (Banco): <span>${formatCOP(sums.service_transfer)}</span></li>
                                <li class="list-group-item d-flex justify-content-between">Manuales: <span>${formatCOP(sums.manual_in)}</span></li>
                                <li class="list-group-item d-flex justify-content-between fw-bold bg-light">Subtotal Recibido: <span>${formatCOP(sums.in_cash + sums.in_transfer)}</span></li>
                            </ul>
                        </div>
                        <div class="col-md-6">
                            <h6 class="text-danger"><i class="fas fa-arrow-up me-2"></i>EGRESOS TOTALES</h6>
                            <ul class="list-group list-group-flush">
                                <li class="list-group-item d-flex justify-content-between">Gastos (Efectivo): <span>-${formatCOP(sums.expense_cash + sums.purchase_cash + sums.refund_cash + sums.manual_out)}</span></li>
                                <li class="list-group-item d-flex justify-content-between">Gastos (Transferencia): <span>-${formatCOP(sums.expense_transfer + sums.purchase_transfer + sums.refund_transfer)}</span></li>
                                <li class="list-group-item d-flex justify-content-between">Salidas Manuales: <span>-${formatCOP(sums.manual_out)}</span></li>
                                <li class="list-group-item d-flex justify-content-between fw-bold bg-light">Subtotal Pagado: <span>-${formatCOP(sums.out_cash + sums.out_transfer)}</span></li>
                            </ul>
                        </div>
                    </div>
                    <div class="row mt-4 pt-3 border-top">
                        <div class="col-md-6 border-end">
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="fw-bold fs-6">EFECTIVO EN CAJA (ESPERADO):</span>
                                <span class="text-primary fw-bold fs-5">${formatCOP(activeSession.opening_balance + sums.in_cash - sums.out_cash)}</span>
                            </div>
                            <small class="text-muted">(Base inicial + Entradas Efe. - Salidas Efe.)</small>
                        </div>
                        <div class="col-md-6 ps-4">
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="fw-bold fs-6">SALDO EN BANCOS (SESIÓN):</span>
                                <span class="text-info fw-bold fs-5">${formatCOP(sums.in_transfer - sums.out_transfer)}</span>
                            </div>
                            <small class="text-muted">(Transferencias netas del turno)</small>
                        </div>
                    </div>
                    <div class="mt-4 pt-3 border-top text-center">
                        <div class="fw-bold fs-4">BALANCE TOTAL NETO: <span class="${(sums.in_cash + sums.in_transfer - sums.out_cash - sums.out_transfer) >= 0 ? 'text-success' : 'text-danger'}">${formatCOP(sums.in_cash + sums.in_transfer - sums.out_cash - sums.out_transfer)}</span></div>
                    </div>
                </div>
            </div>
        `;
    }

    async function loadSessionDetails(sessionId) {
        const [
            sales,
            expenses,
            servicePayments,
            creditPayments
        ] = await Promise.all([
            window.api.getSalesForSession(sessionId),
            window.api.getExpensesForSession(sessionId),
            window.api.getServicePaymentsForSession(sessionId),
            window.api.getCreditPaymentsForSession(sessionId)
        ]);

        renderSales(sales);
        renderExpenses(expenses);
        renderServicePayments(servicePayments);
        renderCreditPayments(creditPayments);
    }

    function renderSales(sales) {
        salesTableBody.innerHTML = '';
        if (sales.length === 0) {
            salesTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay ventas en efectivo/transferencia registradas.</td></tr>';
            return;
        }
        sales.forEach(s => {
            salesTableBody.innerHTML += `
                <tr>
                    <td>${s.invoice_number || s.id}</td>
                    <td>${s.client_name || 'Consumidor Final'}</td>
                    <td>${s.cash_paid > 0 && s.transfer_paid > 0 ? 'Mixto' : (s.cash_paid > 0 ? 'Efectivo' : 'Transferencia')}</td>
                    <td class="text-end">${formatCOP(s.total_amount)}</td>
                    <td>${formatDateTime(s.sale_date)}</td>
                </tr>
            `;
        });
    }

    function renderExpenses(expenses) {
        expensesTableBody.innerHTML = '';
        if (expenses.length === 0) {
                expensesTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay egresos registrados.</td></tr>';
            return;
        }
        expenses.forEach(e => {
            expensesTableBody.innerHTML += `
                <tr>
                    <td>${e.description}</td>
                    <td>${e.category}</td>
                        <td>${e.method === 'transfer' ? '<span class="badge bg-info">Transferencia</span>' : '<span class="badge bg-success">Efectivo</span>'}</td>
                    <td class="text-end text-danger">-${formatCOP(e.amount)}</td>
                    <td>${formatDateTime(e.created_at)}</td>
                </tr>
            `;
        });
    }

    function renderServicePayments(payments) {
        servicePaymentsTableBody.innerHTML = '';
        if (payments.length === 0) {
            servicePaymentsTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay abonos a servicios registrados.</td></tr>';
            return;
        }
        payments.forEach(p => {
            servicePaymentsTableBody.innerHTML += `
                <tr>
                    <td>${p.service_name} (${p.client_name || 'N/A'})</td>
                    <td>${p.method === 'cash' ? 'Efectivo' : 'Transferencia'}</td>
                    <td class="text-end">${formatCOP(p.amount)}</td>
                    <td>${formatDateTime(p.date)}</td>
                </tr>
            `;
        });
    }

    function renderCreditPayments(payments) {
        creditPaymentsTableBody.innerHTML = '';
        if (payments.length === 0) {
            creditPaymentsTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay abonos a créditos registrados.</td></tr>';
            return;
        }
        payments.forEach(p => {
            creditPaymentsTableBody.innerHTML += `
                <tr>
                    <td>Factura #${p.invoice_number || p.sale_id} (${p.client_name || 'N/A'})</td>
                    <td>${p.method === 'cash' ? 'Efectivo' : 'Transferencia'}</td>
                    <td class="text-end">${formatCOP(p.amount)}</td>
                    <td>${formatDateTime(p.created_at)}</td>
                </tr>
            `;
        });
    }

    // --- Event Listeners ---
    openCashRegisterBtn.addEventListener('click', async () => {
        const { value: openingBalance } = await Swal.fire({
            title: 'Abrir Caja',
            input: 'number',
            inputLabel: 'Monto inicial en caja (efectivo)',
            inputValue: 0,
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value || parseFloat(value) < 0) {
                    return 'Por favor, ingrese un monto válido.';
                }
            }
        });

        if (openingBalance !== undefined) {
            const { value: openingNotes } = await Swal.fire({
                title: 'Observaciones de Apertura (Opcional)',
                input: 'textarea',
                inputPlaceholder: 'Notas sobre la apertura de caja...',
                showCancelButton: true
            });

            if (openingNotes !== undefined) {
                const res = await window.api.openCashRegister({
                    openingBalance: parseFloat(openingBalance),
                    userId: userId,
                    userName: userName,
                    openingNotes: openingNotes || null
                });
                if (res.success) {
                    Swal.fire('Éxito', 'Caja abierta correctamente.', 'success');
                    await loadActiveSession();
                } else {
                    Swal.fire('Error', res.message, 'error');
                }
            }
        }
    });

    manualMovementForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!activeSession) {
            Swal.fire('Error', 'No hay una sesión de caja activa.', 'error');
            return;
        }

        const amount = parseFloat(manualMovementAmount.value);
        const type = manualMovementType.value; // 'in' or 'out'
        const description = manualMovementDescription.value.trim();

        if (!amount || amount <= 0) {
            Swal.fire('Error', 'Ingrese un monto válido.', 'error');
            return;
        }
        if (!description) {
            Swal.fire('Error', 'Ingrese una descripción para el movimiento.', 'error');
            return;
        }

        const res = await window.api.addCashMovementManual({
            sessionId: activeSession.id,
            type: type,
            sub_type: `manual_${type}`,
            amount: amount,
            description: description
        });

        if (res.success) {
            Swal.fire('Éxito', 'Movimiento registrado.', 'success');
            manualMovementForm.reset();
            await loadActiveSession();
        } else {
            Swal.fire('Error', res.message, 'error');
        }
    });

    closeCashRegisterBtn.addEventListener('click', async () => {
        if (!activeSession) {
            Swal.fire('Error', 'No hay una sesión de caja activa para cerrar.', 'error');
            return;
        }

        const { value: closingNotes } = await Swal.fire({
            title: 'Observaciones de Cierre (Opcional)',
            input: 'textarea',
            inputPlaceholder: 'Notas sobre el cierre de caja...',
            showCancelButton: true
        });

        if (closingNotes === undefined) return; // User cancelled

        const res = await window.api.closeCashRegister({
            realClosingBalance: parseFloat(totalCountedCash.textContent.replace(/[^0-9,-]+/g, "").replace(",", ".")),
            closedByUserId: userId,
            closedByUserName: userName,
            closingNotes: closingNotes || null
        });
        if (res.success) {
            Swal.fire({
                title: 'Caja Cerrada',
                html: `
                    <p><strong>Balance Esperado:</strong> ${formatCOP(res.expected_balance)}</p>
                    <p><strong>Balance Contado:</strong> ${formatCOP(res.closing_balance)}</p>
                    <p><strong>Diferencia:</strong> <span class="${res.difference === 0 ? 'text-success' : (res.difference > 0 ? 'text-primary' : 'text-danger')}">${formatCOP(res.difference)}</span></p>
                `,
                icon: res.difference === 0 ? 'success' : (res.difference > 0 ? 'info' : 'warning')
            });
            // Ofrecer descarga inmediata del reporte de cierre
            const { isConfirmed } = await Swal.fire({
                title: '¿Desea descargar el reporte de cierre ahora?',
                showCancelButton: true,
                confirmButtonText: 'Sí, descargar',
                cancelButtonText: 'No'
            });

            if (isConfirmed) {
                // Llamar al exportador con el session_id devuelto por el cierre
                const exportRes = await window.api.exportCashRegisterReportPDF(res.session_id);
                if (exportRes && exportRes.success) {
                    Swal.fire('Reporte exportado', `Archivo guardado en: ${exportRes.filePath}`, 'success');
                } else {
                    Swal.fire('Error', exportRes && exportRes.message ? exportRes.message : 'No se pudo generar el reporte.', 'error');
                }
            }

            // Refrescar vista (no habrá sesión activa después del cierre)
            await loadActiveSession();
        } else {
            Swal.fire('Error', res.message, 'error');
        }
    });

    exportReportBtn.addEventListener('click', async () => {
        if (!activeSession) {
            Swal.fire('Error', 'No hay una sesión de caja disponible para exportar.', 'error');
            return;
        }
        const res = await window.api.exportCashRegisterReportPDF(activeSession.id);
        if (res.success) {
            Swal.fire('Éxito', `Reporte exportado: ${res.filePath}`, 'success');
        } else {
            Swal.fire('Error', res.message, 'error');
        }
    });

    // Initial load
    renderDenominations();
    await loadActiveSession();
});