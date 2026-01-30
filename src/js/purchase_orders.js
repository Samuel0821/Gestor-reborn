let allOrders = [];
let orderItems = [];
let availableProducts = [];

document.addEventListener("DOMContentLoaded", () => {
    // --- INICIO LOGICA LAYOUT ERP ---
    const role = localStorage.getItem('user_role');
    const name = localStorage.getItem('user_name');
    
    if (role && name) {
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
            <div class="page-title">Gestión de Compras</div>
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

        // Eventos del layout
        document.getElementById('logout-btn').addEventListener('click', () => {
            if(confirm('¿Cerrar sesión?')) {
                ['user_id', 'user_role', 'user_name', 'logueado', 'valor_inicial_dia'].forEach(k => localStorage.removeItem(k));
                window.location.href = 'login.html';
            }
        });

        const toggleBtn = document.getElementById('sidebar-toggle');
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
        });
        if(localStorage.getItem('sidebar-collapsed') === 'true') sidebar.classList.add('collapsed');
    }
    // --- FIN LOGICA LAYOUT ERP ---

    loadOrders();

    // Listeners para filtros
    document.getElementById("searchInput").addEventListener("input", renderTable);
    document.getElementById("filterStatus").addEventListener("change", renderTable);
    document.getElementById("filterPayment").addEventListener("change", renderTable);

    // Listener para autocompletar costo en nueva orden
    const newOrderInput = document.getElementById('newOrderProductInput');
    if(newOrderInput) {
        newOrderInput.addEventListener('input', (e) => {
            const val = e.target.value;
            const product = availableProducts.find(p => p.name === val);
            if (product) {
                document.getElementById('newOrderCost').value = product.purchase_price || 0;
            }
        });
    }

    // Establecer fecha de hoy en modal de pago
    document.getElementById("payDate").valueAsDate = new Date();
});

async function loadOrders() {
    try {
        allOrders = await window.api.getPurchaseOrders();
        renderTable();
    } catch (error) {
        console.error("Error cargando órdenes:", error);
        Swal.fire("Error", "No se pudieron cargar las órdenes de compra", "error");
    }
}

function renderTable() {
    const tbody = document.getElementById("ordersTableBody");
    tbody.innerHTML = "";

    const searchTerm = document.getElementById("searchInput").value.toLowerCase();
    const statusFilter = document.getElementById("filterStatus").value;
    const paymentFilter = document.getElementById("filterPayment").value;

    const filtered = allOrders.filter(order => {
        const matchesSearch = 
            (order.supplier_name || "").toLowerCase().includes(searchTerm) ||
            (order.po_number || "").toLowerCase().includes(searchTerm) ||
            (order.supplier_invoice_number || "").toLowerCase().includes(searchTerm);
        
        const matchesStatus = statusFilter === "all" || order.status === statusFilter;
        
        // Lógica para filtro de pago
        let payStatus = order.payment_status || 'pending';
        // Si es antigua y completada pero sin status, asumimos pendiente si hay saldo o pagada si no
        if (!order.payment_status && order.status === 'completed') {
             payStatus = (order.outstanding_balance > 0) ? 'pending' : 'paid';
        }
        const matchesPayment = paymentFilter === "all" || payStatus === paymentFilter;

        return matchesSearch && matchesStatus && matchesPayment;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No se encontraron órdenes</td></tr>`;
        return;
    }

    filtered.forEach(order => {
        // Calcular estados visuales
        const isReceived = order.status === 'completed';
        const statusBadge = isReceived 
            ? `<span class="badge bg-success badge-status">Recibido</span>` 
            : `<span class="badge bg-warning text-dark badge-status">Pendiente</span>`;

        // Estado de Pago
        let payBadge = `<span class="badge bg-secondary badge-status">N/A</span>`;
        if (isReceived) {
            const balance = order.outstanding_balance || 0;
            const total = order.total_amount || 0;
            
            if (balance <= 100) { // Margen pequeño
                payBadge = `<span class="badge bg-success badge-status">Pagado</span>`;
            } else if (balance < total) {
                payBadge = `<span class="badge bg-info text-dark badge-status">Parcial</span>`;
            } else {
                payBadge = `<span class="badge bg-danger badge-status">Pendiente</span>`;
            }
        }

        // Factura Proveedor
        const invoiceDisplay = order.supplier_invoice_number 
            ? `<span class="fw-bold text-dark">${order.supplier_invoice_number}</span> <i class="fas fa-pen text-muted ms-1 cursor-pointer" onclick="openInvoiceModal(${order.id}, '${order.supplier_invoice_number}')" style="font-size:0.8em"></i>`
            : `<button class="btn btn-sm btn-outline-secondary" onclick="openInvoiceModal(${order.id}, '')"><i class="fas fa-plus"></i> Agg. Factura</button>`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="ps-4 fw-bold">${order.po_number || order.id}</td>
            <td>${order.supplier_name}</td>
            <td>${new Date(order.order_date).toLocaleDateString()}</td>
            <td>${invoiceDisplay}</td>
            <td class="text-end fw-bold">${formatCurrency(order.total_amount)}</td>
            <td class="text-end text-danger">${isReceived ? formatCurrency(order.outstanding_balance) : '-'}</td>
            <td class="text-center">${statusBadge}</td>
            <td class="text-center">${payBadge}</td>
            <td class="text-end pe-4">
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="exportPDF(${order.id})" title="Ver PDF"><i class="fas fa-file-pdf"></i></button>
                    
                    ${!isReceived ? 
                        `<button class="btn btn-sm btn-success" onclick="receiveOrder(${order.id})" title="Recibir Mercancía"><i class="fas fa-check"></i></button>` : 
                        `<button class="btn btn-sm btn-outline-success" onclick="openPaymentModal(${order.id})" title="Registrar Pago" ${(order.outstanding_balance <= 0) ? 'disabled' : ''}><i class="fas fa-hand-holding-usd"></i></button>`
                    }
                    
                    ${isReceived ? 
                        `<button class="btn btn-sm btn-outline-info" onclick="openHistoryModal(${order.id})" title="Historial Pagos"><i class="fas fa-history"></i></button>` : ''
                    }
                    
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteOrder(${order.id})" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- FUNCIONES DE ACCIÓN ---

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
}

async function receiveOrder(id) {
    const result = await Swal.fire({
        title: '¿Recibir Mercancía?',
        text: "Esto sumará los productos al inventario y generará una cuenta por pagar.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#28a745',
        confirmButtonText: 'Sí, recibir ahora'
    });

    if (result.isConfirmed) {
        const res = await window.api.receivePurchaseOrder(id);
        if (res.success) {
            Swal.fire('Recibido', 'Inventario actualizado y deuda generada.', 'success');
            loadOrders();
        } else {
            Swal.fire('Error', res.message, 'error');
        }
    }
}

async function exportPDF(id) {
    const res = await window.api.exportPurchaseOrderPDF(id);
    if (!res.success && res.message !== "Exportación cancelada") {
        Swal.fire("Error", res.message, "error");
    }
}

async function deleteOrder(id) {
    const result = await Swal.fire({
        title: '¿Eliminar Orden?',
        text: "Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        const res = await window.api.deletePurchaseOrder(id);
        if (res.success) {
            loadOrders();
            Swal.fire('Eliminado', 'La orden ha sido eliminada.', 'success');
        } else {
            Swal.fire('Error', res.message, 'error');
        }
    }
}

// --- GESTIÓN DE FACTURAS DE PROVEEDOR ---

let currentInvoiceModal;
function openInvoiceModal(id, currentNumber) {
    document.getElementById('invOrderId').value = id;
    document.getElementById('invNumberInput').value = currentNumber || '';
    currentInvoiceModal = new bootstrap.Modal(document.getElementById('invoiceModal'));
    currentInvoiceModal.show();
}

async function saveInvoiceNumber() {
    const id = document.getElementById('invOrderId').value;
    const number = document.getElementById('invNumberInput').value.trim();
    
    if (!number) return Swal.fire('Atención', 'Debes escribir un número de factura', 'warning');

    const res = await window.api.updatePurchaseInvoiceNumber(id, number);
    if (res.success) {
        currentInvoiceModal.hide();
        loadOrders();
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
        Toast.fire({ icon: 'success', title: 'Factura actualizada' });
    } else {
        Swal.fire('Error', res.message, 'error');
    }
}

// --- GESTIÓN DE PAGOS ---

let currentPaymentModal;
function openPaymentModal(id) {
    const order = allOrders.find(o => o.id == id);
    if (!order) return;

    document.getElementById('payOrderId').value = id;
    document.getElementById('payOrderDisplay').textContent = `${order.po_number || order.id} - ${order.supplier_name}`;
    document.getElementById('payCurrentBalance').textContent = formatCurrency(order.outstanding_balance);
    
    // Reset form
    document.getElementById('payAmount').value = order.outstanding_balance; // Sugerir pagar todo
    document.getElementById('payAmount').max = order.outstanding_balance;
    document.getElementById('payReference').value = '';
    document.getElementById('payNotes').value = '';
    
    currentPaymentModal = new bootstrap.Modal(document.getElementById('paymentModal'));
    currentPaymentModal.show();
}

async function submitPayment() {
    const id = document.getElementById('payOrderId').value;
    const amount = parseFloat(document.getElementById('payAmount').value);
    const date = document.getElementById('payDate').value;
    const method = document.getElementById('payMethod').value;
    const reference = document.getElementById('payReference').value;
    const notes = document.getElementById('payNotes').value;

    if (!amount || amount <= 0) return Swal.fire('Error', 'Ingrese un monto válido', 'warning');
    if (!date) return Swal.fire('Error', 'Seleccione una fecha', 'warning');

    const res = await window.api.addPurchasePayment({
        orderId: id,
        amount,
        date,
        method,
        reference,
        notes
    });

    if (res.success) {
        currentPaymentModal.hide();
        Swal.fire({
            title: 'Pago Registrado',
            text: 'El pago se ha guardado y se ha creado el egreso correspondiente.',
            icon: 'success'
        });
        loadOrders();
    } else {
        Swal.fire('Error', res.message, 'error');
    }
}

// --- HISTORIAL DE PAGOS ---

let currentHistoryModal;
async function openHistoryModal(id) {
    const payments = await window.api.getPurchasePayments(id);
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';

    if (payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay pagos registrados</td></tr>';
    } else {
        payments.forEach(p => {
            tbody.innerHTML += `
                <tr>
                    <td class="ps-3">${p.date}</td>
                    <td>${p.method}</td>
                    <td>${p.reference || '-'}</td>
                    <td><small>${p.notes || ''}</small></td>
                    <td class="text-end pe-3 fw-bold">${formatCurrency(p.amount)}</td>
                </tr>
            `;
        });
    }

    currentHistoryModal = new bootstrap.Modal(document.getElementById('historyModal'));
    currentHistoryModal.show();
}

// --- CREACIÓN DE NUEVA ORDEN ---

async function openCreateModal() {
    // Resetear estado
    orderItems = [];
    document.getElementById('createOrderForm').reset();
    document.getElementById('newOrderItemsBody').innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay productos agregados</td></tr>';
    document.getElementById('newOrderTotal').textContent = formatCurrency(0);

    // Cargar Proveedores
    try {
        const suppliers = await window.api.getSuppliers();
        const supplierSelect = document.getElementById('newOrderSupplier');
        supplierSelect.innerHTML = '<option value="">-- Seleccione un proveedor --</option>';
        suppliers.forEach(s => {
            supplierSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    } catch (e) { console.error(e); }

    // Cargar Productos para Datalist
    try {
        availableProducts = await window.api.getProducts();
        const datalist = document.getElementById('productList');
        datalist.innerHTML = '';
        availableProducts.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            datalist.appendChild(opt);
        });
    } catch (e) { console.error(e); }

    // Mostrar Modal
    const modal = new bootstrap.Modal(document.getElementById('createOrderModal'));
    modal.show();
}

function addItemToOrder() {
    const input = document.getElementById('newOrderProductInput');
    const costInput = document.getElementById('newOrderCost');
    const qtyInput = document.getElementById('newOrderQty');

    const productName = input.value;
    const product = availableProducts.find(p => p.name === productName);

    if (!product) {
        Swal.fire('Error', 'Seleccione un producto válido de la lista', 'error');
        return;
    }

    const qty = parseFloat(qtyInput.value);
    const cost = parseFloat(costInput.value);

    if (!qty || qty <= 0) return;

    // Verificar si ya existe en la lista
    const existing = orderItems.find(i => i.product_id === product.id);
    if (existing) {
        existing.quantity += qty;
        existing.price = cost || existing.price;
        existing.subtotal = existing.quantity * existing.price;
    } else {
        orderItems.push({
            product_id: product.id,
            product_name: product.name,
            quantity: qty,
            price: cost || product.purchase_price || 0,
            subtotal: (cost || product.purchase_price || 0) * qty
        });
    }

    renderOrderItems();
    input.value = '';
    costInput.value = '';
    qtyInput.value = 1;
    input.focus();
}

function renderOrderItems() {
    const tbody = document.getElementById('newOrderItemsBody');
    tbody.innerHTML = '';
    let total = 0;

    orderItems.forEach((item, index) => {
        total += item.subtotal;
        tbody.innerHTML += `
            <tr>
                <td>${item.product_name}</td>
                <td class="text-end">${formatCurrency(item.price)}</td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-end">${formatCurrency(item.subtotal)}</td>
                <td class="text-center">
                    <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="removeOrderItem(${index})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    if (orderItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay productos agregados</td></tr>';
    }

    document.getElementById('newOrderTotal').textContent = formatCurrency(total);
}

function removeOrderItem(index) {
    orderItems.splice(index, 1);
    renderOrderItems();
}

async function submitNewOrder() {
    const supplierId = document.getElementById('newOrderSupplier').value;
    const notes = document.getElementById('newOrderNotes').value;

    if (!supplierId) {
        Swal.fire('Error', 'Debe seleccionar un proveedor', 'warning');
        return;
    }
    if (orderItems.length === 0) {
        Swal.fire('Error', 'Debe agregar al menos un producto', 'warning');
        return;
    }

    const result = await window.api.createPurchaseOrder({
        supplier_id: supplierId,
        items: orderItems,
        notes: notes
    });

    if (result.success) {
        // Cerrar modal
        const modalEl = document.getElementById('createOrderModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        
        Swal.fire('Éxito', 'Orden de compra creada correctamente', 'success');
        loadOrders();
    } else {
        Swal.fire('Error', result.message, 'error');
    }
}