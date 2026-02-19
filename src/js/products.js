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
                document.getElementById('product-special-price-2').value = p.special_price_2 || 0;

                stockInput.value = p.stock || 0;
                minStockInput.value = p.min_stock || 0;
                
                supplierSelect.value = p.supplier_id || '';
                // --- LÓGICA DE EDICIÓN DE VARIANTES ---
                variantsContainer.innerHTML = '';
                if (p.variants && p.variants.length > 0) {
                    p.variants.forEach(v => {
                        addVariantField(v.name, v.purchase_price, v.sale_price, v.special_price, v.special_price_2, v.conversion_factor);
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

    function addVariantField(name = '', cost = '', price = '', sp1 = '', sp2 = '', factor = '') {
        const variantRow = document.createElement('div');
        variantRow.classList.add('row', 'g-2', 'mb-2', 'align-items-center', 'variant-row', 'p-2', 'border', 'rounded');
        variantRow.innerHTML = `
            <div class="col-lg-2"><input type="text" class="form-control form-control-sm variant-name" placeholder="Nombre" value="${name}"></div>
            <div class="col-lg-1"><input type="number" step="any" class="form-control form-control-sm variant-cost" placeholder="Costo" value="${cost}"></div>
            <div class="col-lg-2"><input type="number" step="any" class="form-control form-control-sm variant-price" placeholder="P. Normal" value="${price}"></div>
            <div class="col-lg-2"><input type="number" step="any" class="form-control form-control-sm variant-special-price" placeholder="P. Esp. 1" value="${sp1}"></div>
            <div class="col-lg-2"><input type="number" step="any" class="form-control form-control-sm variant-special-price-2" placeholder="P. Esp. 2" value="${sp2}"></div>
            <div class="col-lg-1"><input type="number" step="any" class="form-control form-control-sm variant-factor" placeholder="Factor" value="${factor}"></div>
            <div class="col-lg-2 d-flex justify-content-between">
                <button type="button" class="btn btn-outline-info btn-sm calc-variant-margins" title="Calcular precios por margen"><i class="fa fa-percent"></i></button>
                <button type="button" class="btn btn-danger btn-sm remove-variant-btn">Eliminar</button>
            </div>
        `;
        variantsContainer.appendChild(variantRow);

        // Botón para calcular márgenes de la variante
        variantRow.querySelector('.calc-variant-margins').addEventListener('click', () => {
            const costInput = variantRow.querySelector('.variant-cost');
            const priceInput = variantRow.querySelector('.variant-price');
            const sp1Input = variantRow.querySelector('.variant-special-price');
            const sp2Input = variantRow.querySelector('.variant-special-price-2');
            const cost = parseFloat(costInput.value) || 0;

            Swal.fire({
                title: 'Calcular Precios de Variante',
                html: `
                    <p>Costo base: <strong>${formatCOP(cost)}</strong></p>
                    <div class="input-group mb-2"><span class="input-group-text" style="width:120px;">Margen Normal %</span><input id="swal-margin-normal" type="number" class="form-control" placeholder="Ej: 30"></div>
                    <div class="input-group mb-2"><span class="input-group-text" style="width:120px;">Margen Esp. 1 %</span><input id="swal-margin-sp1" type="number" class="form-control" placeholder="Ej: 25"></div>
                    <div class="input-group"><span class="input-group-text" style="width:120px;">Margen Esp. 2 %</span><input id="swal-margin-sp2" type="number" class="form-control" placeholder="Ej: 20"></div>
                `,
                confirmButtonText: 'Aplicar Precios',
                preConfirm: () => {
                    const mNorm = parseFloat(document.getElementById('swal-margin-normal').value);
                    const mSp1 = parseFloat(document.getElementById('swal-margin-sp1').value);
                    const mSp2 = parseFloat(document.getElementById('swal-margin-sp2').value);
                    const calculate = (margin) => (cost > 0 && margin > 0) ? Math.round(cost / (1 - (margin / 100))) : 0;
                    
                    if (!isNaN(mNorm)) priceInput.value = calculate(mNorm);
                    if (!isNaN(mSp1)) sp1Input.value = calculate(mSp1);
                    if (!isNaN(mSp2)) sp2Input.value = calculate(mSp2);
                }
            });
        });

        variantRow.querySelector('.remove-variant-btn').addEventListener('click', () => {
            variantRow.remove();
        });
    }

    function getVariants() {
        const variants = [];
        document.querySelectorAll('.variant-row').forEach(row => {
            const name = row.querySelector('.variant-name').value.trim();
            const cost = parseFloat(row.querySelector('.variant-cost').value);
            const price = parseFloat(row.querySelector('.variant-price').value);
            const specialPrice = parseFloat(row.querySelector('.variant-special-price').value);
            const specialPrice2 = parseFloat(row.querySelector('.variant-special-price-2').value);
            const factor = parseFloat(row.querySelector('.variant-factor').value);
            if (name && !isNaN(price) && !isNaN(factor)) {
                variants.push({ name, purchase_price: isNaN(cost) ? 0 : cost, sale_price: price, special_price: isNaN(specialPrice) ? 0 : specialPrice, special_price_2: isNaN(specialPrice2) ? 0 : specialPrice2, conversion_factor: factor });
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
    const specialPriceInput = document.getElementById('product-special-price');
    const specialPrice2Input = document.getElementById('product-special-price-2');
    const stockInput = document.getElementById('product-stock');
    const cancelBtn = document.getElementById('cancel-product');
    const supplierSelect = document.getElementById('product-supplier');
    const table = document.getElementById('products-table');
    const search = document.getElementById('search-product');
    const codeErrorMessageSpan = document.getElementById('code-error-message');

    // NUEVOS CAMPOS DE PORCENTAJE
    const marginNormal = document.getElementById('product-margin-normal');
    const marginSpecial1 = document.getElementById('product-margin-special-1');
    const marginSpecial2 = document.getElementById('product-margin-special-2');
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

    // Función para calcular precios de venta basados en porcentaje de margen
    function calculateSalePrices() {
        const cost = parseFloat(purchaseInput.value) || 0;
        const calculatePrice = (marginPercent) => {
            if (isNaN(marginPercent) || marginPercent <= 0) return 0;
            // Fórmula: Precio de Venta = Costo / (1 - Margen)
            return Math.round(cost / (1 - (marginPercent / 100)));
        };

        saleInput.value = calculatePrice(parseFloat(marginNormal.value));
        specialPriceInput.value = calculatePrice(parseFloat(marginSpecial1.value));
        specialPrice2Input.value = calculatePrice(parseFloat(marginSpecial2.value));
    }

    // Event Listeners para los nuevos campos de porcentaje y costo
    purchaseInput.addEventListener('input', calculateSalePrices);
    marginNormal.addEventListener('input', calculateSalePrices);
    marginSpecial1.addEventListener('input', calculateSalePrices);
    marginSpecial2.addEventListener('input', calculateSalePrices);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        codeErrorMessageSpan.textContent = '';
        const category = categoryNew.value.trim() || categorySelect.value || null;
        const specialPrice = specialPriceInput.value;
        const specialPrice2 = specialPrice2Input.value;
        const variants = getVariants(); // Obtenemos las variantes del formulario

        // Validar que los porcentajes no sean 0 si se usan
        const salePriceValue = parseFloat(saleInput.value);
        if (isNaN(salePriceValue) || salePriceValue <= 0) {
            Swal.fire('Atención', 'El Precio de Venta (Normal) debe ser mayor a 0.', 'warning');
            return;
        }
        // Podríamos añadir validaciones similares para los precios especiales si son obligatorios

        const payload = {
            id: idInput.value ? Number(idInput.value) : undefined,
            code: codeInput.value.trim(),
            name: nameInput.value.trim(),
            category,
            purchase_price: parseFloat(purchaseInput.value) || 0,
            sale_price: parseFloat(saleInput.value) || 0,
            special_price: parseFloat(specialPrice) || 0,
            special_price_2: parseFloat(specialPrice2) || 0,
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
