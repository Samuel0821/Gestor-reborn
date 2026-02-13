document.addEventListener('DOMContentLoaded', () => {
    // Layout manejado por layout.js

    // Exportar inventario
    document.getElementById("exportExcelBtn")?.addEventListener("click", async () => {
        const res = await window.api.exportInventoryExcel();
        Swal.fire(res.success ? 'Éxito' : 'Error', res.message, res.success ? 'success' : 'error');
    });

    document.getElementById("exportPdfBtn")?.addEventListener("click", async () => {
        const res = await window.api.exportInventoryPDF();
        Swal.fire(res.success ? 'Éxito' : 'Error', res.message, res.success ? 'success' : 'error');
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

    
    // Cargar productos
    
    let allProducts = []; // Almacena TODOS los productos traídos de BD
    let filteredProducts = []; // Almacena los productos filtrados por búsqueda
    let currentRenderedCount = 0; // Cuántos se han pintado en pantalla
    const ITEMS_PER_BATCH = 50; // Cantidad a cargar por bloque

    async function loadProducts() {
        const { products: fetchedProducts, totalInventoryValue } = await window.api.getInventory();
        allProducts = fetchedProducts;
        filteredProducts = fetchedProducts; // Al inicio, el filtro es todo
        
        // Reiniciar renderizado
        table.innerHTML = '';
        currentRenderedCount = 0;
        renderBatch();
        
        const totalValueElement = document.getElementById('total-inventory-value');
        if (totalValueElement) {
            totalValueElement.textContent = formatCOP(totalInventoryValue);
        }
    }

    function renderBatch() {
        const batch = filteredProducts.slice(currentRenderedCount, currentRenderedCount + ITEMS_PER_BATCH);
        renderTableRows(batch);
        currentRenderedCount += batch.length;
        updateLoadMoreButton();
    }

    function updateLoadMoreButton() {
        let loadMoreBtn = document.getElementById('load-more-products-btn');
        if (!loadMoreBtn) return; // Si no se ha creado el botón aún (se crea dinámicamente abajo)
        
        // Mostrar botón solo si quedan productos por mostrar
        loadMoreBtn.style.display = (currentRenderedCount < filteredProducts.length) ? 'block' : 'none';
    }

    function renderTableRows(list) {
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
                        addVariantField(v.name, v.sale_price, v.conversion_factor, v.purchase_price);
                    });
                }
                // --- FIN LÓGICA DE EDICIÓN DE VARIANTES ---

                cancelBtn.style.display = 'inline-block';
            });

            // --- Eliminar producto ---
            tr.querySelector('.del').addEventListener('click', async () => {
                const result = await Swal.fire({
                    title: '¿Eliminar producto?',
                    text: "Esta acción no se puede deshacer.",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Sí, eliminar'
                });
                if (result.isConfirmed) {
                    await window.api.deleteProduct(p.id);
                    await loadProducts();
                    await loadCategories();
                    Swal.fire('Eliminado', 'El producto ha sido eliminado.', 'success');
                }
            });
        });
    }

    // Variantes
   
    const variantsContainer = document.getElementById('variants-container');
    const addVariantBtn = document.getElementById('add-variant-btn');

    addVariantBtn.addEventListener('click', () => {
        addVariantField();
    });

    function addVariantField(variantName = '', variantPrice = '', conversionFactor = '', variantCost = '') {
        const variantRow = document.createElement('div');
        variantRow.classList.add('row', 'g-3', 'mb-2', 'variant-row');
        variantRow.innerHTML = `
            <div class="col-md-3">
                <input type="text" class="form-control variant-name" placeholder="Nombre (Ej: 1/2 saco)" value="${variantName}">
            </div>
            <div class="col-md-2">
                <input type="number" step="0.01" class="form-control variant-cost" placeholder="Costo" value="${variantCost}">
            </div>
            <div class="col-md-2">
                <input type="number" step="0.01" class="form-control variant-price" placeholder="Precio" value="${variantPrice}">
            </div>
            <div class="col-md-2">
                <input type="number" step="0.01" class="form-control variant-factor" placeholder="Factor (ej: 0.5)" value="${conversionFactor}">
            </div>
            <div class="col-md-3 d-flex align-items-center">
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
            const cost = parseFloat(row.querySelector('.variant-cost').value);
            if (name && !isNaN(price) && !isNaN(factor)) {
                variants.push({ name, sale_price: price, conversion_factor: factor, purchase_price: isNaN(cost) ? 0 : cost });
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

    // Crear botón "Cargar más" dinámicamente después de la tabla
    const tableContainer = table.parentElement; // El div que contiene la tabla (o el tbody si no hay div)
    // Buscamos un mejor lugar, idealmente después de la tabla
    const loadMoreContainer = document.createElement('div');
    loadMoreContainer.className = 'text-center my-3';
    loadMoreContainer.innerHTML = `<button id="load-more-products-btn" class="btn btn-outline-primary"><i class="fa fa-arrow-down me-2"></i>Cargar más productos</button>`;
    // Insertar después de la tabla
    table.closest('table').after(loadMoreContainer);
    
    document.getElementById('load-more-products-btn').addEventListener('click', () => {
        renderBatch();
    });

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
            Swal.fire('Atención', 'Código y nombre obligatorios', 'warning');
            return;
        }

        if (payload.id) {
            const res = await window.api.updateProduct(payload);
            if (!res.success) {
                if (res.message.includes("UNIQUE constraint failed: products.code")) {
                    codeErrorMessageSpan.textContent = 'El código ya existe';
                    return;
                }
                Swal.fire('Error', res.message, 'error');
                return;
            }
            Swal.fire({ icon: 'success', title: 'Producto actualizado', timer: 1500, showConfirmButton: false });
            cancelBtn.style.display = 'none';
        } else {
            const res = await window.api.addProduct(payload);
            if (!res.success) {
                if (res.message.includes("UNIQUE constraint failed: products.code")) {
                    codeErrorMessageSpan.textContent = 'El código ya existe';
                    return;
                }
                Swal.fire('Error', res.message, 'error');
                return;
            }
            Swal.fire({ icon: 'success', title: 'Producto creado', timer: 1500, showConfirmButton: false });
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
        // Filtrar sobre la lista completa
        filteredProducts = allProducts.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
        // Reiniciar vista
        table.innerHTML = '';
        currentRenderedCount = 0;
        renderBatch();
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
