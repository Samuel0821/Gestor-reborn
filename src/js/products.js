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

    document.getElementById('expiration-alerts-btn')?.addEventListener('click', async () => {
        const result = await Swal.fire({
            title: 'Consulta de vencimientos',
            html: `<div class="text-start"><label class="form-label">Mostrar</label><select id="expirationStatus" class="form-select mb-2"><option value="all">Vencidos y próximos a vencer</option><option value="expired">Solo vencidos</option><option value="expiring">Próximos a vencer</option></select><label class="form-label">Próximos días</label><input id="expirationDays" type="number" class="form-control" min="0" max="3650" value="30"></div>`,
            showCancelButton: true,
            confirmButtonText: 'Consultar',
            cancelButtonText: 'Cerrar',
            preConfirm: async () => {
                const status = document.getElementById('expirationStatus').value;
                const days = Number(document.getElementById('expirationDays').value || 30);
                const lots = await window.api.getExpirationAlerts(days, status);
                if (!lots.length) {
                    Swal.showValidationMessage('No hay lotes en el estado seleccionado.');
                    return false;
                }
                return lots;
            }
        });
        if (!result.isConfirmed) return;
        const rows = result.value.map(lot => `<tr><td>${lot.product_name}${lot.variant_name ? ` - ${lot.variant_name}` : ''}</td><td>${lot.lot_number}</td><td>${lot.expiration_date}</td><td>${lot.days_remaining < 0 ? '<span class="badge bg-danger">Vencido</span>' : `<span class="badge bg-warning text-dark">${lot.days_remaining} días</span>`}</td></tr>`).join('');
        await Swal.fire({
            title: 'Lotes con vencimiento',
            html: `<div class="table-responsive"><table class="table table-sm text-start"><thead><tr><th>Producto</th><th>Lote</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table></div>`,
            width: 900,
            confirmButtonText: 'Cerrar'
        });
    });
    // ---------------------------------------------------------------------------------------

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
    let productTableAttributes = [];
    const ITEMS_PER_BATCH = 50; // Cantidad a cargar por bloque

    async function loadProducts() {
        const { products: fetchedProducts, totalInventoryValue } = await window.api.getInventory();
        allProducts = fetchedProducts;
        filteredProducts = fetchedProducts; // Al inicio, el filtro es todo
        
        // Reiniciar renderizado
        renderProductTableHeader();
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
            addProductTableCell(tr, p.code);
            addProductTableCell(tr, p.name);
            addProductTableCell(tr, p.category_name || p.category || '-');
            productTableAttributes.forEach(attribute => {
                addProductTableCell(tr, p.attributes?.[attribute.code] || '-');
            });
            addProductTableCell(tr, formatCOP(p.sale_price));
            const stockCell = addProductTableCell(tr, p.stock);
            if (p.stock <= p.min_stock) {
                const alert = document.createElement('span');
                alert.className = 'badge bg-danger ms-2';
                alert.textContent = 'Stock mínimo';
                stockCell.appendChild(alert);
            }
            addProductTableCell(tr, `${p.min_stock || 0} ${p.base_unit_abbreviation || ''}`.trim());
            const actionCell = document.createElement('td');
            actionCell.innerHTML = `
                <div class="dropdown">
                    <button class="btn btn-sm btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">Acciones</button>
                    <ul class="dropdown-menu">
                        <li><button class="dropdown-item edit" data-id="${p.id}"><i class="fa fa-edit me-2 text-primary"></i> Editar</button></li>
                            <li><button class="dropdown-item movements" data-id="${p.id}"><i class="fa fa-clock-rotate-left me-2 text-info"></i> Historial de inventario</button></li>
                        <li><button class="dropdown-item del" data-id="${p.id}"><i class="fa fa-trash me-2 text-danger"></i> Archivar</button></li>
                    </ul>
                </div>`;
            tr.appendChild(actionCell);
            table.appendChild(tr);

            // Restricción de roles
            const role = localStorage.getItem('user_role');
            if (role !== 'admin') {
                tr.querySelectorAll('.edit, .del').forEach(btn => {
                    const li = btn.closest('li');
                    if (li) li.remove();
                });
            }

            // --- Editar producto ---
            const editBtn = tr.querySelector('.edit');
            if (editBtn) editBtn.addEventListener('click', async () => {
                resetProductForm(false);
                idInput.value = p.id;
                codeInput.value = p.code;
                nameInput.value = p.name;
                categorySelect.value = p.category || '';
                categoryNew.value = '';
                productTypeSelect.value = p.product_type_id || '';
                baseUnitSelect.value = p.base_unit_id || '';
                document.getElementById('product-sale-type').value = p.sale_type === 'FRACCTIONED' ? 'FRACCIONADO' : (p.sale_type || 'SIMPLE');
                baseContentInput.value = p.base_content_units || '';
                renderAttributeFields(p.attributes || {});
                purchaseInput.value = p.purchase_price || 0;
                saleInput.value = p.sale_price || 0;
                document.getElementById('product-special-price').value = p.special_price || 0;
                document.getElementById('product-special-price-2').value = p.special_price_2 || 0;

                stockInput.value = p.stock || 0;
                minStockInput.value = p.min_stock || 0;
                
                supplierSelect.value = p.supplier_id || '';
                
                // Calcular márgenes automáticamente al cargar datos
                calculateMarginsFromPrices();

                // --- LÓGICA DE EDICIÓN DE VARIANTES ---
                variantsContainer.innerHTML = '';
                if (p.variants && p.variants.length > 0) {
                    p.variants.forEach(v => {
                        addVariantField(v.name, v.purchase_price, v.sale_price, v.special_price, v.special_price_2, v.conversion_factor, v.content_units, v.unit_id, v);
                    });
                }
                refreshFractionedMode();
                if (window.productFormConfig?.workflows?.lotsAndExpiration) {
                    lotsContainer.replaceChildren();
                    const lots = await window.api.getInventoryLots(p.id);
                    (lots.length ? lots : [{}]).forEach(lot => addLotField(lot));
                }
                // --- FIN LÓGICA DE EDICIÓN DE VARIANTES ---

                productFormModalTitle.textContent = 'Editar Producto';
                productFormModal.show();
            });

            // --- Eliminar producto ---
            const movementsBtn = tr.querySelector('.movements');
            if (movementsBtn) movementsBtn.addEventListener('click', async () => {
                const movements = await window.api.getInventoryMovements(p.id);
                const rows = movements.length
                    ? movements.map(movement => `
                        <tr>
                            <td>${escapeText(movement.created_at)}</td>
                            <td>${escapeText(movement.movement_type)}</td>
                            <td>${escapeText(movement.variant_name || '-')}</td>
                            <td class="text-end">${Number(movement.quantity).toFixed(2)}</td>
                            <td class="text-end">${Number(movement.stock_before).toFixed(2)} → ${Number(movement.stock_after).toFixed(2)}</td>
                            <td>${escapeText(movement.reason || '-')}</td>
                        </tr>`).join('')
                    : '<tr><td colspan="6" class="text-center text-muted">No hay movimientos registrados.</td></tr>';
                Swal.fire({
                    title: `Historial: ${escapeText(p.name)}`,
                    width: 980,
                    html: `<div class="table-responsive"><table class="table table-sm text-start"><thead><tr><th>Fecha</th><th>Tipo</th><th>Variante</th><th class="text-end">Cantidad</th><th class="text-end">Stock</th><th>Motivo</th></tr></thead><tbody>${rows}</tbody></table></div>`,
                    confirmButtonText: 'Cerrar'
                });
            });

            // --- Eliminar producto ---
            const delBtn = tr.querySelector('.del');
            if (delBtn) delBtn.addEventListener('click', async () => {
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

    function addProductTableCell(row, value) {
        const cell = document.createElement('td');
        cell.textContent = value === undefined || value === null ? '-' : String(value);
        row.appendChild(cell);
        return cell;
    }

    function escapeText(value) {
        return String(value ?? '').replace(/[&<>'"]/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[character]));
    }

    function renderProductTableHeader() {
        const header = document.getElementById('products-table-head');
        if (!header) return;
        header.replaceChildren();
        ['Código', 'Nombre', 'Categoría', ...productTableAttributes.map(attribute => attribute.name), 'Precio venta', 'Stock', 'Stock mínimo', 'Acciones']
            .forEach(label => {
                const cell = document.createElement('th');
                cell.textContent = label;
                header.appendChild(cell);
            });
    }

    // Variantes
   
    const variantsContainer = document.getElementById('variants-container');
    const addVariantBtn = document.getElementById('add-variant-btn');

    function industryCode() {
        return window.productFormConfig?.businessType?.code;
    }

    function isPharmacy() {
        return industryCode() === 'FARMACIA';
    }

    function isClothing() {
        return industryCode() === 'ROPA';
    }

    function isHardware() {
        return industryCode() === 'FERRETERIA';
    }

    function isFractioned() {
        const strategy = window.productFormConfig?.strategy;
        return Boolean(strategy?.saleTypes?.includes('FRACCIONADO') && document.getElementById('product-sale-type')?.value === 'FRACCIONADO');
    }

    function calculateFractionedVariant(row) {
        if (!isFractioned()) return;
        const baseContent = Number(baseContentInput.value);
        const content = Number(row.querySelector('.variant-content')?.value);
        const factorInput = row.querySelector('.variant-factor');
        const costInput = row.querySelector('.variant-cost');
        const validContent = isPharmacy()
            ? Number.isInteger(baseContent) && baseContent >= 1 && Number.isInteger(content) && content >= 1
            : Number.isFinite(baseContent) && baseContent > 0 && Number.isFinite(content) && content > 0;
        if (!validContent) {
            factorInput.value = '';
            costInput.value = '';
            return;
        }
        factorInput.value = (content / baseContent).toFixed(6);
        costInput.value = (Number(purchaseInput.value || 0) * content / baseContent).toFixed(2);
    }

    function refreshFractionedMode() {
        const fractioned = isFractioned();
        const pharmacy = isPharmacy();
        const clothing = isClothing();
        const sections = window.productFormConfig?.sections || {};
        pharmacyBaseContentGroup?.classList.toggle('d-none', !fractioned);
        const strategy = window.productFormConfig?.strategy;
        const saleTypeGroup = document.getElementById('hardware-sale-type-group');
        saleTypeGroup?.classList.toggle('d-none', !strategy || clothing);
        if (saleTypeSelect && strategy?.saleTypes?.length === 1) {
            saleTypeSelect.value = clothing ? 'SIMPLE' : strategy.saleTypes[0];
            saleTypeSelect.disabled = true;
        } else if (saleTypeSelect) {
            saleTypeSelect.value = clothing ? 'SIMPLE' : saleTypeSelect.value;
            saleTypeSelect.disabled = clothing;
        }
        stockInput.readOnly = clothing;
        minStockInput.readOnly = clothing;
        document.getElementById('product-stock-label').textContent = clothing ? 'Stock total (calculado)' : 'Stock Actual';
        document.getElementById('product-min-stock-label').textContent = clothing ? 'Mínimo total (calculado)' : 'Stock Mínimo';
        document.getElementById('product-variants-title').textContent = clothing ? 'Matriz de tallas y colores' : 'Unidades de venta y variantes';
        document.getElementById('product-variants-help').textContent = clothing
            ? 'Cada combinación tiene SKU, precio y existencias independientes.'
            : 'Agrega presentaciones, factores y precios alternativos.';
        document.getElementById('generic-variants-header').classList.toggle('d-none', clothing);
        let matrixHeader = document.getElementById('clothing-variants-header');
        if (clothing && !matrixHeader) {
            matrixHeader = document.createElement('div');
            matrixHeader.id = 'clothing-variants-header';
            matrixHeader.className = 'row g-1 mb-2 d-none d-lg-flex small text-muted';
            matrixHeader.innerHTML = '<div class="col-lg-2">SKU</div><div class="col-lg-1">Talla</div><div class="col-lg-2">Color</div><div class="col-lg-1">Costo</div><div class="col-lg-2">Precio normal</div><div class="col-lg-1">Stock inicial</div><div class="col-lg-1">Mínimo</div><div class="col-lg-2">Acciones</div>';
            document.getElementById('generic-variants-header').before(matrixHeader);
        }
        matrixHeader?.classList.toggle('d-none', !clothing);
        document.getElementById('fractioned-base-content-group')?.classList.toggle('d-none', clothing || !fractioned);
        document.getElementById('product-inventory-section')?.classList.toggle('d-none', sections.inventory === false);
        document.getElementById('product-variants-section')?.classList.toggle('d-none', sections.variants === false);
        const baseLabel = document.getElementById('product-base-content-label');
        if (baseLabel) baseLabel.textContent = strategy?.contentLabel || 'Contenido total base';
        document.querySelectorAll('.pharmacy-content-heading').forEach(element => element.classList.toggle('d-none', !fractioned));
        document.querySelectorAll('.variant-factor-heading').forEach(element => element.textContent = fractioned ? 'Factor interno' : 'Factor');
        document.querySelectorAll('.variant-factor-heading').forEach(element => element.classList.toggle('d-none', clothing));
        const contentHelp = document.getElementById('fractioned-content-help');
        if (contentHelp) contentHelp.textContent = strategy?.contentHelp || (pharmacy ? 'Unidades mínimas enteras, por ejemplo 100 tabletas.' : 'Puede usar enteros o decimales: kg, metros, piezas o volumen.');
        document.querySelectorAll('.variant-row').forEach(row => {
            row.querySelector('.variant-content-group')?.classList.toggle('d-none', !fractioned);
            row.querySelector('.variant-factor')?.toggleAttribute('readonly', fractioned);
            row.querySelector('.variant-cost')?.toggleAttribute('readonly', fractioned);
            row.querySelector('.variant-content-group')?.classList.toggle('d-none', clothing || !fractioned);
            row.querySelector('.variant-factor')?.classList.toggle('d-none', clothing);
            calculateFractionedVariant(row);
        });
    }

    addVariantBtn.addEventListener('click', () => {
        addVariantField();
    });

    function updateClothingParentTotals() {
        if (!isClothing()) return;
        const stocks = [...variantsContainer.querySelectorAll('.clothing-stock')].map(input => Number(input.value) || 0);
        const minimums = [...variantsContainer.querySelectorAll('.clothing-min-stock')].map(input => Number(input.value) || 0);
        stockInput.value = stocks.reduce((sum, value) => sum + value, 0);
        minStockInput.value = minimums.reduce((sum, value) => sum + value, 0);
    }

    function addVariantField(name = '', cost = '', price = '', sp1 = '', sp2 = '', factor = '', contentUnits = '', unitId = null, matrixData = {}) {
        const variantRow = document.createElement('div');
        variantRow.classList.add('row', 'g-2', 'mb-2', 'align-items-center', 'variant-row', 'p-2', 'border', 'rounded');
        if (isClothing()) {
            variantRow.dataset.variantId = matrixData.id || '';
            variantRow.innerHTML = `
                <div class="col-lg-2"><input type="text" class="form-control form-control-sm clothing-sku" placeholder="SKU interno" value="${escapeText(matrixData.sku || '')}"></div>
                <div class="col-lg-1"><input type="text" class="form-control form-control-sm clothing-size" placeholder="Talla" value="${escapeText(matrixData.size || '')}"></div>
                <div class="col-lg-2"><input type="text" class="form-control form-control-sm clothing-color" placeholder="Color" value="${escapeText(matrixData.color || '')}"></div>
                <div class="col-lg-1"><input type="number" min="0" step="any" class="form-control form-control-sm variant-cost" placeholder="Costo" value="${cost || purchaseInput.value || ''}"></div>
                <div class="col-lg-2"><input type="number" min="0" step="any" class="form-control form-control-sm variant-price" placeholder="Precio" value="${price || saleInput.value || ''}"></div>
                <div class="col-lg-1"><input type="number" min="0" step="1" class="form-control form-control-sm clothing-stock" placeholder="Stock" value="${matrixData.variant_stock ?? 0}"></div>
                <div class="col-lg-1"><input type="number" min="0" step="1" class="form-control form-control-sm clothing-min-stock" placeholder="Mín." value="${matrixData.variant_min_stock ?? 0}"></div>
                <div class="col-lg-2 d-flex justify-content-end"><button type="button" class="btn btn-danger btn-sm remove-variant-btn">Eliminar</button></div>`;
            const skuInput = variantRow.querySelector('.clothing-sku');
            if (matrixData.sku) skuInput.dataset.manual = 'true';
            const updateSku = () => {
                if (skuInput.dataset.manual === 'true') return;
                const parts = [codeInput.value, variantRow.querySelector('.clothing-size').value, variantRow.querySelector('.clothing-color').value]
                    .map(value => value.trim()).filter(Boolean);
                skuInput.value = parts.join('-').toUpperCase().replace(/\s+/g, '-');
            };
            skuInput.addEventListener('input', () => { skuInput.dataset.manual = 'true'; });
            variantRow.querySelectorAll('.clothing-size, .clothing-color').forEach(input => input.addEventListener('input', updateSku));
            codeInput.addEventListener('input', updateSku);
            variantRow.querySelectorAll('.clothing-stock, .clothing-min-stock').forEach(input => input.addEventListener('input', updateClothingParentTotals));
            variantRow.querySelector('.remove-variant-btn').addEventListener('click', () => {
                variantRow.remove();
                updateClothingParentTotals();
            });
            variantsContainer.appendChild(variantRow);
            updateSku();
            updateClothingParentTotals();
            return;
        }
        variantRow.innerHTML = `
            <div class="col-lg-2"><input type="text" class="form-control form-control-sm variant-name" placeholder="Nombre" value="${name}"></div>
            <div class="col-lg-1 variant-content-group ${isFractioned() ? '' : 'd-none'}"><input type="number" min="0.000001" step="any" class="form-control form-control-sm variant-content" placeholder="Contenido / medida" value="${contentUnits}"></div>
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

        variantRow.querySelector('.variant-content')?.addEventListener('input', () => calculateFractionedVariant(variantRow));
        baseContentInput?.addEventListener('input', () => calculateFractionedVariant(variantRow));
        purchaseInput?.addEventListener('input', () => calculateFractionedVariant(variantRow));

        // Botón para calcular márgenes de la variante
        variantRow.querySelector('.calc-variant-margins').addEventListener('click', () => {
            const costInput = variantRow.querySelector('.variant-cost');
            const priceInput = variantRow.querySelector('.variant-price');
            const sp1Input = variantRow.querySelector('.variant-special-price');
            const sp2Input = variantRow.querySelector('.variant-special-price-2');
            const cost = parseFloat(costInput.value) || 0;

            // Calcular márgenes actuales basados en los precios de la fila
            const getMargin = (priceVal) => {
                const p = parseFloat(priceVal);
                if (cost > 0 && p > cost) {
                    return ((1 - (cost / p)) * 100).toFixed(2);
                }
                return '';
            };

            Swal.fire({
                title: 'Calcular Precios de Variante',
                html: `
                    <p>Costo base: <strong>${formatCOP(cost)}</strong></p>
                    <div class="input-group mb-2"><span class="input-group-text" style="width:120px;">Margen Normal %</span><input id="swal-margin-normal" type="number" step="any" class="form-control" placeholder="Ej: 30" value="${getMargin(priceInput.value)}"></div>
                    <div class="input-group mb-2"><span class="input-group-text" style="width:120px;">Margen Esp. 1 %</span><input id="swal-margin-sp1" type="number" step="any" class="form-control" placeholder="Ej: 25" value="${getMargin(sp1Input.value)}"></div>
                    <div class="input-group"><span class="input-group-text" style="width:120px;">Margen Esp. 2 %</span><input id="swal-margin-sp2" type="number" step="any" class="form-control" placeholder="Ej: 20" value="${getMargin(sp2Input.value)}"></div>
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
        refreshFractionedMode();
    }

    function getVariants() {
        const variants = [];
        document.querySelectorAll('.variant-row').forEach(row => {
            if (isClothing()) {
                const size = row.querySelector('.clothing-size').value.trim();
                const color = row.querySelector('.clothing-color').value.trim();
                const sku = row.querySelector('.clothing-sku').value.trim();
                const cost = Number(row.querySelector('.variant-cost').value || purchaseInput.value || 0);
                const price = Number(row.querySelector('.variant-price').value || saleInput.value);
                const stock = Number(row.querySelector('.clothing-stock').value);
                const minStock = Number(row.querySelector('.clothing-min-stock').value);
                if (size && color && sku && Number.isFinite(price) && price > 0 && Number.isInteger(stock) && stock >= 0 && Number.isInteger(minStock) && minStock >= 0) {
                    variants.push({ id: row.dataset.variantId ? Number(row.dataset.variantId) : null, name: `${size} - ${color}`, size, color, sku, stock, min_stock: minStock, purchase_price: cost, sale_price: price, conversion_factor: 1, content_units: null });
                }
                return;
            }
            const name = row.querySelector('.variant-name').value.trim();
            const cost = parseFloat(row.querySelector('.variant-cost').value);
            const price = parseFloat(row.querySelector('.variant-price').value);
            const specialPrice = parseFloat(row.querySelector('.variant-special-price').value);
            const specialPrice2 = parseFloat(row.querySelector('.variant-special-price-2').value);
            const factor = parseFloat(row.querySelector('.variant-factor').value);
            const rawContent = row.querySelector('.variant-content')?.value;
            const contentUnits = isPharmacy() ? parseInt(rawContent, 10) : parseFloat(rawContent);
            if (isFractioned() && (isPharmacy() ? (!Number.isInteger(contentUnits) || contentUnits < 1) : (!Number.isFinite(contentUnits) || contentUnits <= 0))) return;
            if (name && !isNaN(price) && !isNaN(factor) && factor > 0) {
                variants.push({ name, purchase_price: isNaN(cost) ? 0 : cost, sale_price: price, special_price: isNaN(specialPrice) ? 0 : specialPrice, special_price_2: isNaN(specialPrice2) ? 0 : specialPrice2, conversion_factor: factor, content_units: isFractioned() ? contentUnits : null });
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
    const productTypeSelect = document.getElementById('product-type');
    const baseUnitSelect = document.getElementById('product-base-unit');
    const saleTypeSelect = document.getElementById('product-sale-type');
    const baseContentInput = document.getElementById('product-base-content');
    const pharmacyBaseContentGroup = document.getElementById('fractioned-base-content-group');
    const attributesSection = document.getElementById('product-attributes-section');
    const attributesContainer = document.getElementById('product-attributes');
    const lotsSection = document.getElementById('product-lots-section');
    const lotsContainer = document.getElementById('product-lots-container');
    const addLotButton = document.getElementById('add-lot-btn');
    const profileTitle = document.getElementById('product-profile-title');
    const profileDescription = document.getElementById('product-profile-description');
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
    const productFormModalElement = document.getElementById('product-form-modal');
    const productFormModal = new bootstrap.Modal(productFormModalElement);
    const productFormModalTitle = document.getElementById('product-form-modal-title');
    const newProductButton = document.getElementById('new-product-btn');

    saleTypeSelect?.addEventListener('change', refreshFractionedMode);
    addLotButton?.addEventListener('click', () => addLotField());

    // NUEVOS CAMPOS DE PORCENTAJE
    const marginNormal = document.getElementById('product-margin-normal');
    const marginSpecial1 = document.getElementById('product-margin-special-1');
    const marginSpecial2 = document.getElementById('product-margin-special-2');

    // Configurar inputs para aceptar decimales (step="any") y evitar el error de validación del navegador
    [purchaseInput, saleInput, specialPriceInput, specialPrice2Input, stockInput, minStockInput, marginNormal, marginSpecial1, marginSpecial2].forEach(input => {
        if (input) input.setAttribute('step', 'any');
    });

    let isCalculating = false; // Flag to prevent calculation loops

    function resetProductForm(clearProfileDefaults = true) {
        form.reset();
        idInput.value = '';
        codeErrorMessageSpan.textContent = '';
        variantsContainer.innerHTML = '';
        lotsContainer?.replaceChildren();
        if (baseContentInput) baseContentInput.value = '';
        if (clearProfileDefaults) {
            const defaultProductType = [...productTypeSelect.options].find(option => option.textContent === 'Producto');
            const defaultUnit = [...baseUnitSelect.options].find(option => option.textContent.startsWith('Unidad'));
            productTypeSelect.value = defaultProductType?.value || '';
            baseUnitSelect.value = defaultUnit?.value || '';
        }
        renderAttributeFields();
    }

    newProductButton.addEventListener('click', () => {
        resetProductForm();
        productFormModalTitle.textContent = 'Registrar Nuevo Producto';
        productFormModal.show();
        codeInput.focus();
    });

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

    async function loadProductFormConfig() {
        const config = await window.api.getProductFormConfig();
        window.productFormConfig = config;
        const lotsEnabled = Boolean(config.workflows?.lotsAndExpiration);
        lotsSection?.toggleAttribute('hidden', !lotsEnabled);
        if (lotsEnabled && !lotsContainer.children.length) addLotField();
        productTableAttributes = config.attributes || [];
        if (config.businessType) {
            profileTitle.textContent = `Datos de ${config.businessType.name}`;
            profileDescription.textContent = config.businessType.description || '';
        }
        productTypeSelect.innerHTML = '<option value="">(Sin tipo)</option>';
        saleTypeSelect.innerHTML = '';
        (config.strategy?.saleTypes || ['SIMPLE']).forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type === 'FRACCIONADO' ? 'Fraccionado / por medida' : 'Producto simple';
            saleTypeSelect.appendChild(option);
        });
        saleTypeSelect.value = config.strategy?.defaultSaleType || 'SIMPLE';
        document.getElementById('product-base-content')?.setAttribute('aria-label', config.strategy?.contentLabel || 'Contenido total base');
        config.productTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.id;
            option.textContent = type.name;
            productTypeSelect.appendChild(option);
        });

        baseUnitSelect.innerHTML = '<option value="">(Sin unidad)</option>';
        config.units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit.id;
            option.textContent = unit.abbreviation ? `${unit.name} (${unit.abbreviation})` : unit.name;
            baseUnitSelect.appendChild(option);
        });
        const defaultProductType = config.productTypes.find(type => type.code === 'PRODUCTO');
        const defaultUnit = config.units.find(unit => unit.code === 'UNIDAD');
        if (defaultProductType) productTypeSelect.value = defaultProductType.id;
        if (defaultUnit) baseUnitSelect.value = defaultUnit.id;
        refreshFractionedMode();
        renderAttributeFields();
        renderProductTableHeader();
    }

    function addLotField(lot = {}) {
        if (!lotsContainer) return;
        const row = document.createElement('div');
        row.className = 'col-12 lot-row';
        row.innerHTML = `
            <div class="row g-2 align-items-end p-3 border rounded bg-light">
              <div class="col-md-4"><label class="form-label">Lote</label><input class="form-control lot-number" value="${escapeText(lot.lot_number || '')}" placeholder="Ej. L-2026-001"></div>
              <div class="col-md-4"><label class="form-label">Vencimiento</label><input type="date" class="form-control lot-expiration" value="${escapeText(lot.expiration_date || '')}"></div>
              <div class="col-md-3"><label class="form-label">Cantidad inicial</label><input type="number" min="0" step="any" class="form-control lot-quantity" value="${lot.quantity ?? 0}"></div>
              <div class="col-md-1"><button type="button" class="btn btn-outline-danger remove-lot" title="Quitar lote"><i class="fa fa-trash"></i></button></div>
            </div>`;
        row.querySelector('.remove-lot').addEventListener('click', () => row.remove());
        lotsContainer.appendChild(row);
    }

    function getLots() {
        return [...document.querySelectorAll('.lot-row')].map(row => ({
            lot_number: row.querySelector('.lot-number').value.trim(),
            expiration_date: row.querySelector('.lot-expiration').value || null,
            quantity: Number(row.querySelector('.lot-quantity').value || 0)
        })).filter(lot => lot.lot_number);
    }

    function renderAttributeFields(values = {}) {
        if (!attributesContainer) return;
        attributesContainer.replaceChildren();
        const attributes = window.productFormConfig?.attributes || [];
        attributesSection.hidden = attributes.length === 0;
        attributes.forEach(attribute => {
            const wrapper = document.createElement('div');
            wrapper.className = 'col-md-4';
            const label = document.createElement('label');
            label.className = 'form-label';
            label.textContent = attribute.name;
            label.htmlFor = `product-attribute-${attribute.code}`;
            const input = document.createElement('input');
            input.id = label.htmlFor;
            input.className = attribute.value_type === 'boolean' ? 'form-check-input product-attribute' : 'form-control product-attribute';
            input.dataset.code = attribute.code;
            input.type = attribute.value_type === 'boolean' ? 'checkbox' : attribute.value_type === 'date' ? 'date' : attribute.value_type === 'number' ? 'number' : 'text';
            if (attribute.value_type === 'boolean') {
                input.checked = values[attribute.code] === 'true' || values[attribute.code] === true || values[attribute.code] === '1';
                label.className = 'form-check-label ms-2';
                wrapper.className = 'col-md-4 form-check';
            } else {
                input.value = values[attribute.code] || '';
            }
            input.required = Boolean(attribute.required);
            if (attribute.value_type === 'boolean') wrapper.append(input, label);
            else wrapper.append(label, input);
            attributesContainer.appendChild(wrapper);
        });
    }

    function getAttributeValues() {
        return Object.fromEntries([...document.querySelectorAll('.product-attribute')]
            .map(input => [input.dataset.code, input.type === 'checkbox' ? String(input.checked) : input.value]));
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
        if (isCalculating) return;
        isCalculating = true;

        const cost = parseFloat(purchaseInput.value) || 0;
        const calculatePrice = (marginPercent) => {
            if (cost <= 0 || isNaN(marginPercent) || marginPercent <= 0 || marginPercent >= 100) return '';
            // Fórmula: Precio de Venta = Costo / (1 - Margen)
            return Math.round(cost / (1 - (marginPercent / 100)));
        };

        saleInput.value = calculatePrice(parseFloat(marginNormal.value));
        specialPriceInput.value = calculatePrice(parseFloat(marginSpecial1.value));
        specialPrice2Input.value = calculatePrice(parseFloat(marginSpecial2.value));

        setTimeout(() => { isCalculating = false; }, 50);
    }

    // Función para calcular márgenes basados en precios de venta
    function calculateMarginsFromPrices() {
        if (isCalculating) return;
        isCalculating = true;

        const cost = parseFloat(purchaseInput.value) || 0;
        
        const calculateMargin = (salePriceValue) => {
            const salePrice = parseFloat(salePriceValue);
            if (cost <= 0 || isNaN(salePrice) || salePrice <= cost) {
                return '';
            }
            const margin = (1 - (cost / salePrice)) * 100;
            return margin.toFixed(2);
        };

        marginNormal.value = calculateMargin(saleInput.value);
        marginSpecial1.value = calculateMargin(specialPriceInput.value);
        marginSpecial2.value = calculateMargin(specialPrice2Input.value);

        setTimeout(() => { isCalculating = false; }, 50);
    }

    // Event Listeners para los nuevos campos de porcentaje y costo
    purchaseInput.addEventListener('input', () => {
        // Cuando el costo cambia, recalcula los precios desde los márgenes existentes.
        calculateSalePrices();
    });
    marginNormal.addEventListener('input', calculateSalePrices);
    marginSpecial1.addEventListener('input', calculateSalePrices);
    marginSpecial2.addEventListener('input', calculateSalePrices);

    // Listeners para la lógica inversa (Precio -> Margen)
    saleInput.addEventListener('input', calculateMarginsFromPrices);
    specialPriceInput.addEventListener('input', calculateMarginsFromPrices);
    specialPrice2Input.addEventListener('input', calculateMarginsFromPrices);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        codeErrorMessageSpan.textContent = '';
        const category = categoryNew.value.trim() || categorySelect.value || null;
        const specialPrice = specialPriceInput.value;
        const specialPrice2 = specialPrice2Input.value;
        const variants = getVariants(); // Obtenemos las variantes del formulario
        if (isClothing() && (!variants.length || variants.length !== variantsContainer.querySelectorAll('.variant-row').length)) {
            Swal.fire('Atención', 'Completa SKU, talla, color, precio, stock y mínimo de cada combinación. Agrega al menos una variante.', 'warning');
            return;
        }

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
            stock: isClothing() ? variants.reduce((sum, variant) => sum + variant.stock, 0) : (parseFloat(stockInput.value) || 0),
            min_stock: isClothing() ? variants.reduce((sum, variant) => sum + variant.min_stock, 0) : (parseFloat(minStockInput.value) || 0),
            supplier_id: supplierSelect.value ? Number(supplierSelect.value) : null,
            product_type_id: productTypeSelect.value ? Number(productTypeSelect.value) : null,
            base_unit_id: baseUnitSelect.value ? Number(baseUnitSelect.value) : null,
            sale_type: saleTypeSelect?.value || 'SIMPLE',
            base_content_units: isFractioned() ? Number(baseContentInput.value) : null,
            attributes: getAttributeValues(),
            lots: window.productFormConfig?.workflows?.lotsAndExpiration ? getLots() : [],
            variants // Agregamos el array de variantes al payload
        };
        
        if (!payload.code || !payload.name) {
            Swal.fire('Atención', 'Código y nombre obligatorios', 'warning');
            return;
        }

        if (isFractioned() && (isPharmacy()
            ? (!Number.isInteger(payload.base_content_units) || payload.base_content_units < 1)
            : (!Number.isFinite(payload.base_content_units) || payload.base_content_units <= 0))) {
            Swal.fire('Atención', isPharmacy() ? 'Indica el contenido entero de la caja base.' : 'Indica un contenido base mayor que 0.', 'warning');
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
        renderAttributeFields();
        productFormModal.hide();
        await loadProducts();
        await loadCategories();
    });

    cancelBtn.addEventListener('click', () => {
        productFormModal.hide();
        resetProductForm();
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
    
    window.productFormConfig = { attributes: [] };
    window.api.getProductFormConfig().then(config => {
        return loadProductFormConfig();
    }).then(() => loadProducts()).catch(error => console.error('Error cargando configuración de productos:', error));
    loadCategories();
    loadSuppliers();
});
