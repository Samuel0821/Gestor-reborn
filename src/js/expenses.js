document.addEventListener('DOMContentLoaded', () => {
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

    // --- ESTILOS PARA EL FORMULARIO DE EGRESOS ---
    const expenseFormStyles = document.createElement('style');
    expenseFormStyles.innerHTML = `
      #expense-form {
        padding: 20px;
        border-radius: 10px;
        background-color: #f8f9fa;
        box-shadow: 0 4px 15px rgba(0,0,0,0.05);
      }
      #expense-form .form-label {
        font-weight: 600;
        color: #343a40;
        margin-bottom: 5px;
      }
      #expense-form .form-control,
      #expense-form .form-select {
        border-radius: 8px;
        border: 1px solid #ced4da;
        padding: 10px 15px;
        transition: all 0.3s ease;
      }
      #expense-form .form-control:focus,
      #expense-form .form-select:focus {
        border-color: #80bdff;
        box-shadow: 0 0 0 0.25rem rgba(0, 123, 255, 0.25);
      }
      #expense-form .btn-primary {
        border-radius: 8px;
        padding: 10px 20px;
        font-weight: 600;
      }
      /* Ajustes para el Modo Oscuro */
      body.dark-mode #expense-form {
        background-color: #2d333b;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      }
      body.dark-mode #expense-form .form-label {
        color: #c9d1d9;
      }
      body.dark-mode #expense-form .form-control,
      body.dark-mode #expense-form .form-select {
        background-color: #373e47;
        border-color: #444c56;
        color: #c9d1d9;
      }
      body.dark-mode #expense-form .form-control::placeholder {
        color: #8b949e;
      }
    `;
    document.head.appendChild(expenseFormStyles);
    // ---------------------------------------------------------------------------------------

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
              <p><strong>Método:</strong> <span id="detail-method"></span></p>
              <p><strong>Referencia:</strong> <span id="detail-reference"></span></p>
              <p><strong>Registrado:</strong> <span id="detail-created"></span></p>
              <div id="detail-refund-items" class="mt-3" style="display: none;">
                <h6>Detalle de Devolución</h6>
                <p><strong>Factura Original:</strong> <span id="refund-invoice-number"></span></p>
                <p><strong>Cliente:</strong> <span id="refund-client-name"></span></p>
                <div class="table-responsive">
                    <table class="table table-sm table-bordered">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th class="text-end">Cantidad</th>
                                <th class="text-end">Valor Unit.</th>
                                <th class="text-end">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody id="refund-items-tbody"></tbody>
                    </table>
                </div>
              </div>
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

    let allExpenses = [];
    let filteredExpenses = [];
    let currentRenderedCount = 0;
    const ITEMS_PER_BATCH = 15;

    async function loadExpenses() {
        allExpenses = await window.api.getExpenses(); // Trae todos los egresos
        applyFilterAndRender();
    }

    function applyFilterAndRender() {
        const q = document.getElementById('search-expense')?.value.toLowerCase() || '';
        
        // Filtramos por descripción o categoría
        filteredExpenses = allExpenses.filter(exp => 
            exp.description.toLowerCase().includes(q) || 
            exp.category.toLowerCase().includes(q) ||
            exp.date.includes(q)
        );
        
        tableBody.innerHTML = '';
        currentRenderedCount = 0;
        renderBatch();
    }

    function renderBatch() {
        const batch = filteredExpenses.slice(currentRenderedCount, currentRenderedCount + ITEMS_PER_BATCH);
        renderTableRows(batch);
        currentRenderedCount += batch.length;
        updateLoadMoreButton();
        updateTotal();
    }

    function updateTotal() {
        let total = 0;
        // El total se calcula sobre la lista filtrada completa
        filteredExpenses.forEach(exp => total += exp.amount);
        totalDisplay.textContent = `Total: ${formatCOP(total)}`;
    }

    function updateLoadMoreButton() {
        let loadMoreBtn = document.getElementById('load-more-expenses-btn');
        if (!loadMoreBtn) return;
        loadMoreBtn.style.display = (currentRenderedCount < filteredExpenses.length) ? 'block' : 'none';
    }

    function renderTableRows(list) {
        list.forEach(exp => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${exp.date}</td>
                <td>${exp.description}</td>
                <td><span class="badge bg-secondary">${exp.category}</span></td>
                <td>${exp.method === 'transfer' ? '<span class="badge bg-info">Transferencia</span>' : '<span class="badge bg-success">Efectivo</span>'}</td>
                <td class="text-end text-danger fw-bold">-${formatCOP(exp.amount)}</td>
                <td>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                            Acciones
                        </button>
                        <ul class="dropdown-menu">
                            <li><button class="dropdown-item view-expense" data-id="${exp.id}"><i class="fa fa-eye me-2 text-info"></i> Ver Detalle</button></li>
                            <li><button class="dropdown-item export-expense" data-id="${exp.id}"><i class="fa fa-file-pdf me-2 text-secondary"></i> Exportar PDF</button></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><button class="dropdown-item delete-expense" data-id="${exp.id}"><i class="fa fa-trash me-2 text-danger"></i> Eliminar</button></li>
                        </ul>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Restricción de roles
        const role = localStorage.getItem('user_role');
        if (role !== 'admin') {
            document.querySelectorAll('.delete-expense').forEach(btn => {
                const li = btn.closest('li');
                if (li) li.remove();
            });
        }

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
                    document.getElementById('detail-method').textContent = (exp.method === 'transfer') ? 'Transferencia' : 'Efectivo';
                    document.getElementById('detail-reference').textContent = exp.reference || '-';
                    document.getElementById('detail-created').textContent = exp.created_at || '-';

                    // Lógica para detalles de devolución
                    const refundDetailContainer = document.getElementById('detail-refund-items');
                    const refundItemsTbody = document.getElementById('refund-items-tbody');
                    refundDetailContainer.style.display = 'none'; // Ocultar por defecto
                    refundItemsTbody.innerHTML = ''; // Limpiar ítems previos

                    if (exp.category === 'Devolución' && exp.details) {
                        try {
                            const details = JSON.parse(exp.details);
                            document.getElementById('refund-invoice-number').textContent = details.invoice_number || '-';
                            document.getElementById('refund-client-name').textContent = details.client_name || 'Consumidor Final';
                            
                            if (details.items && details.items.length > 0) {
                                details.items.forEach(item => {
                                    refundItemsTbody.innerHTML += `
                                        <tr>
                                            <td>${item.product_name}</td>
                                            <td class="text-end">${item.quantity}</td>
                                            <td class="text-end">${formatCOP(item.price)}</td>
                                            <td class="text-end">${formatCOP(item.subtotal)}</td>
                                        </tr>
                                    `;
                                });
                                refundDetailContainer.style.display = 'block'; // Mostrar la sección de devolución
                            }
                        } catch (parseError) {
                            console.error("Error al parsear detalles de egreso:", parseError);
                        }
                    }
                    detailModal.show();
                }
            });
        });

        document.querySelectorAll('.export-expense').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                const res = await window.api.exportExpensePDF(id);
                Swal.fire(res.success ? 'Éxito' : 'Error', res.success ? `PDF exportado: ${res.filePath}` : res.message, res.success ? 'success' : 'error');
            });
        });

        document.querySelectorAll('.delete-expense').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                const result = await Swal.fire({
                    title: '¿Eliminar este gasto?',
                    text: "Esta acción no se puede deshacer.",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Sí, eliminar',
                    cancelButtonText: 'Cancelar'
                });
                if (result.isConfirmed) {
                    await window.api.deleteExpense(id);
                    loadExpenses();
                    Swal.fire('Eliminado', 'El gasto ha sido eliminado.', 'success');
                }
            });
        });
    }

    // Listener para el buscador
    const searchInput = document.getElementById('search-expense');
    if (searchInput) {
        searchInput.addEventListener('input', applyFilterAndRender);
    }

    // Crear y configurar botón "Cargar más"
    if (!document.getElementById('load-more-expenses-btn')) {
        const loadMoreBtnContainer = document.createElement('div');
        loadMoreBtnContainer.className = 'text-center my-3';
        loadMoreBtnContainer.innerHTML = `<button id="load-more-expenses-btn" class="btn btn-outline-primary"><i class="fa fa-arrow-down me-2"></i>Cargar más egresos</button>`;
        tableBody.closest('table').after(loadMoreBtnContainer);
        document.getElementById('load-more-expenses-btn').addEventListener('click', renderBatch);
    }

    document.getElementById('btn-export-modal').addEventListener('click', async () => {
        if(currentDetailId) {
            const res = await window.api.exportExpensePDF(currentDetailId);
            Swal.fire(res.success ? 'Éxito' : 'Error', res.success ? `PDF exportado: ${res.filePath}` : res.message, res.success ? 'success' : 'error');
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const description = document.getElementById('expense-desc').value.trim();
        const amount = Number(document.getElementById('expense-amount').value);
        const category = document.getElementById('expense-category').value;
        const date = document.getElementById('expense-date').value;
        const methodEl = document.getElementById('expense-method');
        const method = methodEl ? methodEl.value : 'cash';
        const reference = document.getElementById('expense-reference') ? document.getElementById('expense-reference').value.trim() : null;

        if (!description || amount <= 0 || !date) {
            Swal.fire('Atención', 'Por favor complete todos los campos correctamente.', 'warning');
            return;
        }

        const expense = { description, amount, category, date, method: method, reference: reference };

        const res = await window.api.saveExpense(expense);
        if(res.success) {
            Swal.fire({
                icon: 'success',
                title: 'Gasto registrado',
                timer: 1500,
                showConfirmButton: false
            });
            form.reset();
            document.getElementById('expense-date').valueAsDate = new Date();
            loadExpenses();
        } else {
            Swal.fire('Error', res.message || 'No se pudo guardar el gasto.', 'error');
        }
    });

    // Lógica para actualizar el historial cuando se cambie a la pestaña de historial
    const historyTab = document.querySelector('button[data-bs-target="#nav-history"], a[href="#nav-history"]');
    if (historyTab) {
        historyTab.addEventListener('shown.bs.tab', () => {
            loadExpenses();
        });
    }

    loadExpenses();

    // Mostrar/ocultar referencia cuando se seleccione transferencia
    const methodSelect = document.getElementById('expense-method');
    if (methodSelect) {
        methodSelect.addEventListener('change', (e) => {
            const container = document.getElementById('expense-ref-container');
            if (!container) return;
            container.style.display = e.target.value === 'transfer' ? 'block' : 'none';
        });
    }
});
