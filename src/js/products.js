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
            <div class="page-title">Inventario de Productos</div>
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

    // Exportar inventario
    document.getElementById("exportExcelBtn")?.addEventListener("click", async () => {
        const res = await window.api.exportInventoryExcel();
        showAlert(res.success ? "success" : "danger", res.message);
    });

    document.getElementById("exportPdfBtn")?.addEventListener("click", async () => {
        const res = await window.api.exportInventoryPDF();
        showAlert(res.success ? "success" : "danger", res.message);
    });

    
    // Helpers
   
    function formatCOP(value) {
        const num = Number(value) || 0;
        return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            minimumFractionDigits: 0,
        }).format(Math.round(num));
    }

    function showAlert(type, message) {
        let alertDiv = document.getElementById('inventory-alert');
        if (!alertDiv) {
            alertDiv = document.createElement('div');
            alertDiv.id = 'inventory-alert';
            alertDiv.className = 'mt-3';
            document.querySelector('.card').before(alertDiv);
        }
        alertDiv.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
            <i class="fa fa-info-circle me-2"></i>${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>`;
    }

    
    // Cargar productos
    
    async function loadProducts() {
        const { products: fetchedProducts, totalInventoryValue } = await window.api.getInventory();
        products = fetchedProducts;
        renderTable(products);
        
        const totalValueElement = document.getElementById('total-inventory-value');
        if (totalValueElement) {
            totalValueElement.textContent = formatCOP(totalInventoryValue);
        }
    }

    function renderTable(list) {
        table.innerHTML = '';
        list.forEach(p => {
            const tr = document.createElement('tr');
            const stockAlert = (p.stock <= p.min_stock) ? `<span class="badge bg-danger ms-2">Stock mínimo</span>` : '';
            tr.innerHTML = `
                <td>${p.code}</td>
                <td>${p.name}</td>
                <td>${formatCOP(p.sale_price)}</td>
                <td>${p.stock} ${stockAlert}</td>
                <td>${p.min_stock || 0}</td>
                <td>
                    <button class="btn btn-sm btn-primary edit" data-id="${p.id}" title="Editar"><i class="fa fa-edit"></i> Editar</button>
                    <button class="btn btn-sm btn-danger del" data-id="${p.id}" title="Eliminar"><i class="fa fa-trash"></i> Eliminar</button>
                </td>
            `;
            table.appendChild(tr);

            // Restricción de roles
            const role = localStorage.getItem('user_role');
            if (role !== 'admin') {
                tr.querySelectorAll('.edit, .del').forEach(btn => btn.remove());
            }

            // --- Editar producto ---
            tr.querySelector('.edit').addEventListener('click', () => {
                idInput.value = p.id;
                codeInput.value = p.code;
                nameInput.value = p.name;
                categorySelect.value = p.category || '';
                categoryNew.value = '';
                purchaseInput.value = p.purchase_price || 0;
                saleInput.value = p.sale_price || 0;
                document.getElementById('product-special-price').value = p.special_price || 0;
                stockInput.value = p.stock || 0;
                minStockInput.value = p.min_stock || 0;
                
                supplierSelect.value = p.supplier_id || '';
                // --- LÓGICA DE EDICIÓN DE VARIANTES ---
                variantsContainer.innerHTML = '';
                if (p.variants && p.variants.length > 0) {
                    p.variants.forEach(v => {
                        addVariantField(v.name, v.sale_price, v.conversion_factor);
                    });
                }
                // --- FIN LÓGICA DE EDICIÓN DE VARIANTES ---

                cancelBtn.style.display = 'inline-block';
            });

            // --- Eliminar producto ---
            tr.querySelector('.del').addEventListener('click', async () => {
                if (!confirm('¿Eliminar producto?')) return;
                await window.api.deleteProduct(p.id);
                await loadProducts();
                await loadCategories();
            });
        });
    }

    // Variantes
   
    const variantsContainer = document.getElementById('variants-container');
    const addVariantBtn = document.getElementById('add-variant-btn');

    addVariantBtn.addEventListener('click', () => {
        addVariantField();
    });

    function addVariantField(variantName = '', variantPrice = '', conversionFactor = '') {
        const variantRow = document.createElement('div');
        variantRow.classList.add('row', 'g-3', 'mb-2', 'variant-row');
        variantRow.innerHTML = `
            <div class="col-md-4">
                <input type="text" class="form-control variant-name" placeholder="Nombre (Ej: 1/2 saco)" value="${variantName}">
            </div>
            <div class="col-md-3">
                <input type="number" step="0.01" class="form-control variant-price" placeholder="Precio" value="${variantPrice}">
            </div>
            <div class="col-md-3">
                <input type="number" step="0.01" class="form-control variant-factor" placeholder="Factor (ej: 0.5)" value="${conversionFactor}">
            </div>
            <div class="col-md-2 d-flex align-items-center">
                <button type="button" class="btn btn-danger btn-sm remove-variant-btn">Eliminar</button>
            </div>
        `;
        variantsContainer.appendChild(variantRow);

        variantRow.querySelector('.remove-variant-btn').addEventListener('click', () => {
            variantRow.remove();
        });
    }

    function getVariants() {
        const variants = [];
        document.querySelectorAll('.variant-row').forEach(row => {
            const name = row.querySelector('.variant-name').value.trim();
            const price = parseFloat(row.querySelector('.variant-price').value);
            const factor = parseFloat(row.querySelector('.variant-factor').value);
            if (name && !isNaN(price) && !isNaN(factor)) {
                variants.push({ name, sale_price: price, conversion_factor: factor });
            }
        });
        return variants;
    }

    // Formulario
    
    const form = document.getElementById('product-form');
    const minStockInput = document.getElementById('product-min-stock');
    const idInput = document.getElementById('product-id');
    const codeInput = document.getElementById('product-code');
    const nameInput = document.getElementById('product-name');
    const categorySelect = document.getElementById('product-category');
    const categoryNew = document.getElementById('product-category-new');
    const purchaseInput = document.getElementById('product-purchase-price');
    const saleInput = document.getElementById('product-sale-price');
    const stockInput = document.getElementById('product-stock');
    const cancelBtn = document.getElementById('cancel-product');
    const supplierSelect = document.getElementById('product-supplier');
    const table = document.getElementById('products-table');
    const search = document.getElementById('search-product');
    const codeErrorMessageSpan = document.getElementById('code-error-message');

    let products = [];

    async function loadCategories() {
        const cats = await window.api.getCategories();
        categorySelect.innerHTML = '<option value="">(Sin categoría)</option>';
        cats.forEach(c => {
            const o = document.createElement('option');
            o.value = c.name;
            o.textContent = c.name;
            categorySelect.appendChild(o);
        });
    }

    async function loadSuppliers() {
        const suppliers = await window.api.getSuppliers();
        supplierSelect.innerHTML = '<option value="">(Sin proveedor)</option>';
        suppliers.forEach(s => {
            const o = document.createElement('option');
            o.value = s.id;
            o.textContent = s.name;
            supplierSelect.appendChild(o);
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        codeErrorMessageSpan.textContent = '';
        const category = categoryNew.value.trim() || categorySelect.value || null;
        const specialPrice = document.getElementById('product-special-price').value;
        const variants = getVariants(); // Obtenemos las variantes del formulario

        const payload = {
            id: idInput.value ? Number(idInput.value) : undefined,
            code: codeInput.value.trim(),
            name: nameInput.value.trim(),
            category,
            purchase_price: parseFloat(purchaseInput.value) || 0,
            sale_price: parseFloat(saleInput.value) || 0,
            special_price: parseFloat(specialPrice) || 0,
            stock: parseInt(stockInput.value, 10) || 0,
            min_stock: parseInt(minStockInput.value, 10) || 0,
            supplier_id: supplierSelect.value ? Number(supplierSelect.value) : null,
            variants // Agregamos el array de variantes al payload
        };
        
        if (!payload.code || !payload.name) {
            alert('Código y nombre obligatorios');
            return;
        }

        if (payload.id) {
            const res = await window.api.updateProduct(payload);
            if (!res.success) {
                if (res.message.includes("UNIQUE constraint failed: products.code")) {
                    codeErrorMessageSpan.textContent = 'El código ya existe';
                    return;
                }
                alert(res.message);
                return;
            }
            cancelBtn.style.display = 'none';
        } else {
            const res = await window.api.addProduct(payload);
            if (!res.success) {
                if (res.message.includes("UNIQUE constraint failed: products.code")) {
                    codeErrorMessageSpan.textContent = 'El código ya existe';
                    return;
                }
                alert(res.message);
                return;
            }
        }
        form.reset();
        idInput.value = '';
        variantsContainer.innerHTML = ''; // Limpiamos los campos de variantes al guardar
        await loadProducts();
        await loadCategories();
    });

    cancelBtn.addEventListener('click', () => { 
        form.reset(); 
        idInput.value=''; 
        supplierSelect.value = '';
        cancelBtn.style.display='none'; 
        variantsContainer.innerHTML = ''; 
    });

    minStockInput.value = '';

    search.addEventListener('input', () => {
        const q = search.value.toLowerCase();
        renderTable(products.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)));
    });

   
    // Precarga desde lector de código (cuando escaneas en ventas)
   
    const newProductCode = localStorage.getItem("newProductCode");
    if (newProductCode) {
        codeInput.value = newProductCode;
        localStorage.removeItem("newProductCode");
        nameInput.focus();
    }

    
    // Inicialización
    
    loadProducts();
    loadCategories();
    loadSuppliers();
});
