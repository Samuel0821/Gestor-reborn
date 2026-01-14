document.addEventListener('DOMContentLoaded', () => {
    // Mostrar usuario logueado
    const role = localStorage.getItem('user_role');
    const name = localStorage.getItem('user_name');
    if (role && name) {
        // --- INICIO LOGICA LAYOUT ERP ---
        const currentPage = window.location.pathname.split('/').pop();
        
        // Crear estructura principal
        const appWrapper = document.createElement('div');
        appWrapper.className = 'app-wrapper';

        // Sidebar
        const sidebar = document.createElement('div');
        sidebar.className = 'sidebar';
        sidebar.innerHTML = `
          <div class="sidebar-brand"><i class="fa fa-cubes"></i> <span class="brand-text ms-2">GestorFX</span></div>
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
            <div class="page-title">Órdenes de Compra</div>
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
        // --- FIN LOGICA LAYOUT ERP ---

        document.getElementById('logout-btn').addEventListener('click', () => {
            if(confirm('¿Cerrar sesión?')) {
                ['user_id', 'user_role', 'user_name', 'logueado', 'valor_inicial_dia'].forEach(k => localStorage.removeItem(k));
                window.location.href = 'login.html';
            }
        });

        // Lógica Sidebar Colapsable
        const toggleBtn = document.getElementById('sidebar-toggle');
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
        });
        if(localStorage.getItem('sidebar-collapsed') === 'true') sidebar.classList.add('collapsed');
    }

    const purchaseOrderForm = document.getElementById('purchase-order-form');
    const purchaseOrdersTable = document.getElementById('purchase-orders-table');
    const supplierSelect = document.getElementById('supplier-id');
    const productItemsContainer = document.getElementById('product-items');
    const addProductItemBtn = document.getElementById('add-product-item');
    const savePurchaseOrderBtn = document.getElementById('save-purchase-order');
    const cancelEditBtn = document.getElementById('cancel-edit');
    const searchInput = document.getElementById('search-purchase-order');
    let products = [];

    // Cargar proveedores
    window.api.getSuppliers().then(suppliers => {
        suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.id;
            option.textContent = supplier.name;
            supplierSelect.appendChild(option);
        });
    });

    // Cargar productos
    window.api.getProducts().then(prods => {
        products = prods;
    });

    // Agregar item de producto
    addProductItemBtn.addEventListener('click', () => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('row', 'g-3', 'mb-2', 'product-item');
        const uniqueId = `product-list-${Date.now()}`;
        itemDiv.innerHTML = `
            <div class="col-md-5">
                <input class="form-control product-search" list="${uniqueId}" placeholder="Escriba para buscar un producto...">
                <datalist id="${uniqueId}">
                    ${products.map(p => `<option data-id="${p.id}" value="${p.name}"></option>`).join('')}
                </datalist>
                <input type="hidden" class="product-id">
            </div>
            <div class="col-md-3">
                <input type="number" class="form-control quantity" placeholder="Cantidad" min="1" value="1">
            </div>
            <div class="col-md-3">
                <input type="number" class="form-control price" placeholder="Precio">
            </div>
            <div class="col-md-1">
                <button type="button" class="btn btn-danger btn-sm remove-item">X</button>
            </div>
        `;
        productItemsContainer.appendChild(itemDiv);

        const productSearchInput = itemDiv.querySelector('.product-search');
        const productIdInput = itemDiv.querySelector('.product-id');
        const datalist = itemDiv.querySelector('datalist');

        productSearchInput.addEventListener('input', (e) => {
            const inputValue = e.target.value;
            const option = Array.from(datalist.options).find(opt => opt.value === inputValue);
            if (option) {
                productIdInput.value = option.getAttribute('data-id');
            } else {
                productIdInput.value = '';
            }
        });
    });

    // Remover item de producto
    productItemsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-item')) {
            e.target.closest('.product-item').remove();
        }
    });

    // Guardar orden de compra
    purchaseOrderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const purchaseOrderId = document.getElementById('purchase-order-id').value;
        const supplierId = supplierSelect.value;
        const orderDate = document.getElementById('order-date').value;
        const items = [];
        productItemsContainer.querySelectorAll('.product-item').forEach(item => {
            const productId = item.querySelector('.product-id').value;
            const quantity = item.querySelector('.quantity').value;
            const price = item.querySelector('.price').value;
            if (productId && quantity && price) {
                items.push({
                    product_id: productId,
                    quantity: parseInt(quantity),
                    price: parseFloat(price),
                    subtotal: parseInt(quantity) * parseFloat(price)
                });
            }
        });

        const purchaseOrderData = {
            supplier_id: supplierId,
            order_date: orderDate,
            items: items
        };

        if (purchaseOrderId) {
            purchaseOrderData.id = purchaseOrderId;
            window.api.updatePurchaseOrder(purchaseOrderData).then(() => {
                getPurchaseOrders();
                purchaseOrderForm.reset();
                productItemsContainer.innerHTML = '';
                cancelEditBtn.style.display = 'none';
            });
        } else {
            window.api.createPurchaseOrder(purchaseOrderData).then(() => {
                getPurchaseOrders();
                purchaseOrderForm.reset();
                productItemsContainer.innerHTML = '';
            });
        }
    });

    // Cargar órdenes de compra
    function getPurchaseOrders() {
        window.api.getPurchaseOrders().then(purchaseOrders => {
            renderPurchaseOrders(purchaseOrders);
        });
    }

    function renderPurchaseOrders(purchaseOrders) {
        purchaseOrdersTable.innerHTML = '';
        purchaseOrders.forEach(po => {
            const row = purchaseOrdersTable.insertRow();
            const orderNumber = po.po_number || `OC-${po.id}`;
            
            const statusBadge = po.status === 'pending' 
                ? '<span class="badge bg-warning text-dark">Pendiente</span>' 
                : '<span class="badge bg-success">Recibido</span>';

            const receiveBtn = po.status === 'pending' 
                ? `<button class="btn btn-sm btn-success me-1" onclick="receiveOrder(${po.id})" title="Marcar como Recibido"><i class="fa fa-check"></i></button>` 
                : '';

            row.innerHTML = `
                <td>${orderNumber}</td>
                <td>${po.supplier_name}</td>
                <td>${new Date(po.order_date).toLocaleDateString()}</td>
                <td>${po.total_amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-sm btn-info view-po me-1" data-id="${po.id}" title="Ver"><i class="fa fa-eye"></i></button>
                    ${receiveBtn}
                    <button class="btn btn-sm btn-primary me-1" onclick="editPurchaseOrder(${po.id})" title="Editar"><i class="fa fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deletePurchaseOrder(${po.id})" title="Eliminar"><i class="fa fa-trash"></i></button>
                </td>
            `;
        });
    }

    purchaseOrdersTable.addEventListener('click', e => {
        if (e.target.closest('.view-po')) {
            const id = e.target.closest('.view-po').dataset.id;
            viewPurchaseOrder(id);
        }
    });

    function viewPurchaseOrder(id) {
        window.api.getPurchaseOrderById(id).then(po => {
            if (!po) {
                alert("Orden de compra no encontrada.");
                return;
            }

            const itemsHtml = po.items.map(item => `
                <tr>
                    <td>${item.product_code || ''}</td>
                    <td>${item.product_name}</td>
                    <td class="text-end">${item.quantity}</td>
                    <td class="text-end">${item.price.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
                    <td class="text-end">${item.subtotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
                </tr>
            `).join('');

            const modalHtml = `
                <div class="modal fade" id="po-details-modal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Detalle Orden de Compra: ${po.po_number || `OC-${po.id}`}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <p><strong>Proveedor:</strong> ${po.supplier_name}</p>
                                <p><strong>Fecha:</strong> ${new Date(po.order_date).toLocaleDateString()}</p>
                                <table class="table">
                                    <thead><tr><th>Código</th><th>Producto</th><th class="text-end">Cantidad</th><th class="text-end">Precio</th><th class="text-end">Subtotal</th></tr></thead>
                                    <tbody>${itemsHtml}</tbody>
                                </table>
                                <h5 class="text-end">Total: ${po.total_amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</h5>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-success" id="export-po-pdf-btn"><i class="fa fa-file-pdf me-2"></i>Exportar PDF</button>
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = new bootstrap.Modal(document.getElementById('po-details-modal'));
            modal.show();
            document.getElementById('export-po-pdf-btn').addEventListener('click', () => exportPurchaseOrderPDF(po.id));
            document.getElementById('po-details-modal').addEventListener('hidden.bs.modal', () => document.getElementById('po-details-modal').remove());
        });
    }

    window.receiveOrder = async (id) => {
        if (confirm('¿Confirmar recepción del pedido? Esto sumará los productos al inventario.')) {
            const res = await window.api.receivePurchaseOrder(id);
            if (res.success) {
                alert(res.message);
                getPurchaseOrders();
            } else {
                alert('Error: ' + res.message);
            }
        }
    };

    window.editPurchaseOrder = (id) => {
        window.api.getPurchaseOrderById(id).then(po => {
            document.getElementById('purchase-order-id').value = po.id;
            supplierSelect.value = po.supplier_id;
            document.getElementById('order-date').value = po.order_date.split('T')[0];
            productItemsContainer.innerHTML = '';
            po.items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('row', 'g-3', 'mb-2', 'product-item');
                const uniqueId = `product-list-${Date.now()}-${item.product_id}`;
                itemDiv.innerHTML = `
                    <div class="col-md-5">
                        <input class="form-control product-search" list="${uniqueId}" placeholder="Escriba para buscar un producto..." value="${item.product_name}">
                        <datalist id="${uniqueId}">
                            ${products.map(p => `<option data-id="${p.id}" value="${p.name}"></option>`).join('')}
                        </datalist>
                        <input type="hidden" class="product-id" value="${item.product_id}">
                    </div>
                    <div class="col-md-3">
                        <input type="number" class="form-control quantity" placeholder="Cantidad" min="1" value="${item.quantity}">
                    </div>
                    <div class="col-md-3">
                        <input type="number" class="form-control price" placeholder="Precio" value="${item.price}">
                    </div>
                    <div class="col-md-1">
                        <button type="button" class="btn btn-danger btn-sm remove-item">X</button>
                    </div>
                `;
                productItemsContainer.appendChild(itemDiv);

                const productSearchInput = itemDiv.querySelector('.product-search');
                const productIdInput = itemDiv.querySelector('.product-id');
                const datalist = itemDiv.querySelector('datalist');

                productSearchInput.addEventListener('input', (e) => {
                    const inputValue = e.target.value;
                    const option = Array.from(datalist.options).find(opt => opt.value === inputValue);
                    if (option) {
                        productIdInput.value = option.getAttribute('data-id');
                    } else {
                        productIdInput.value = '';
                    }
                });
            });
            savePurchaseOrderBtn.textContent = 'Actualizar';
            cancelEditBtn.style.display = 'inline-block';
        });
    };

    cancelEditBtn.addEventListener('click', () => {
        purchaseOrderForm.reset();
        productItemsContainer.innerHTML = '';
        document.getElementById('purchase-order-id').value = '';
        savePurchaseOrderBtn.textContent = 'Guardar';
        cancelEditBtn.style.display = 'none';
    });

    window.deletePurchaseOrder = (id) => {
        if (confirm('¿Está seguro de que desea eliminar esta orden de compra?')) {
            window.api.deletePurchaseOrder(id).then(() => {
                getPurchaseOrders();
            });
        }
    };

    async function exportPurchaseOrderPDF(id) {
        const result = await window.api.exportPurchaseOrderPDF(id);
        if (result.success) {
            alert('Orden de compra exportada a PDF correctamente.');
        } else {
            alert(`Error al exportar: ${result.message}`);
        }
    }

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        window.api.getPurchaseOrders().then(purchaseOrders => {
            const filtered = purchaseOrders.filter(po => 
                po.supplier_name.toLowerCase().includes(searchTerm) ||
                po.id.toString().includes(searchTerm)
            );
            renderPurchaseOrders(filtered);
        });
    });

    getPurchaseOrders();
});