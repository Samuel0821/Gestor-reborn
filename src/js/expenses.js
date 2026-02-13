document.addEventListener('DOMContentLoaded', () => {
    // Layout manejado por layout.js

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
              <p><strong>Registrado:</strong> <span id="detail-created"></span></p>
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

    async function loadExpenses() {
        const expenses = await window.api.getExpenses(); // Requiere backend
        tableBody.innerHTML = '';
        let total = 0;

        expenses.forEach(exp => {
            total += exp.amount;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${exp.date}</td>
                <td>${exp.description}</td>
                <td><span class="badge bg-secondary">${exp.category}</span></td>
                <td class="text-end text-danger fw-bold">-${formatCOP(exp.amount)}</td>
                <td>
                    <button class="btn btn-sm btn-info view-expense me-1" data-id="${exp.id}" title="Ver Detalle"><i class="fa fa-eye"></i></button>
                    <button class="btn btn-sm btn-secondary export-expense me-1" data-id="${exp.id}" title="Exportar PDF"><i class="fa fa-file-pdf"></i></button>
                    <button class="btn btn-sm btn-outline-danger delete-expense" data-id="${exp.id}" title="Eliminar"><i class="fa fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        totalDisplay.textContent = `Total: ${formatCOP(total)}`;

        // Eventos botones
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
                    document.getElementById('detail-created').textContent = exp.created_at || '-';
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

        if (!description || amount <= 0 || !date) {
            Swal.fire('Atención', 'Por favor complete todos los campos correctamente.', 'warning');
            return;
        }

        const expense = { description, amount, category, date };

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

    loadExpenses();
});
