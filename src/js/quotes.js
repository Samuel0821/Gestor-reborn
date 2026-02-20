document.addEventListener('DOMContentLoaded', async () => {
  // Layout manejado por layout.js

  const clientSelect = document.getElementById('quote-client');
  const productInput = document.getElementById('quote-product-input');
  const productDatalist = document.getElementById('quote-products-list');
  const qtyInput = document.getElementById('quote-quantity');
  const form = document.getElementById('quote-form');
  const quotesList = document.getElementById('quotes-list');
  const quoteItemsTbody = document.getElementById('quote-items');
  const totalDiv = document.getElementById('quote-total');
  const finalizeBtn = document.getElementById('finalize-quote');

  let quoteItems = [];
  let allProducts = [];
  let editingQuoteId = null;

  // Función para guardar el estado del carrito en localStorage
  function saveQuoteState() {
    localStorage.setItem('persistentQuoteCart', JSON.stringify(quoteItems));
  }

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

  // --- FILTRO POR CLIENTE (Mover al inicio para evitar ReferenceError) ---
  const filterContainer = document.createElement("div");
  filterContainer.className = "mb-3 d-flex align-items-center";
  filterContainer.innerHTML = `
    <label class="me-2 fw-bold">Filtrar por Cliente:</label>
    <select id="filter-client-quote" class="form-select w-auto">
        <option value="">-- Todos --</option>
    </select>
  `;
  if (quotesList && quotesList.parentNode) {
      quotesList.parentNode.insertBefore(filterContainer, quotesList);
  }
  const filterClientSelect = document.getElementById('filter-client-quote');
  filterClientSelect.addEventListener('change', () => loadQuotes());

  // --- Carga Inicial ---
  await loadProducts();
  await loadClients();
  await loadQuotes();

  // Cargar carritos guardados DESPUÉS de cargar productos para poder enriquecerlos
  const persistentCart = localStorage.getItem('persistentQuoteCart');
  if (persistentCart) {
    try {
      quoteItems = JSON.parse(persistentCart);
    } catch (e) { console.error(e); }
  }

  const savedQuoteCart = sessionStorage.getItem('quoteCart');
  if (savedQuoteCart) {
    try {
      const newItems = JSON.parse(savedQuoteCart);
      quoteItems = quoteItems.concat(newItems);
      sessionStorage.removeItem('quoteCart');
    } catch (e) { console.error(e); }
  }

  // Enriquece todos los items cargados con la información de precios completa
  quoteItems = quoteItems.map(item => {
    if (!item.product_id) return item;
    const product = allProducts.find(p => p.id === item.product_id);
    if (!product) return item;
    const source = item.variant_id ? product.variants.find(v => v.id === item.variant_id) : product;
    if (!source) return item;
    return { ...item, ...{ sale_price: source.sale_price, special_price: source.special_price, special_price_2: source.special_price_2 } };
  });

  renderQuoteItems(); // Renderizar una vez con los datos cargados y enriquecidos

  function formatCOP(value) {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  }

  // Modal de selección de variante para cotizaciones

  function showVariantSelectionModalForQuote(prod, qtyDefault = 1) {
    const modalHtml = `
      <div class="modal fade" id="variantModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Seleccionar Unidad de Venta</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p>El producto <strong>${prod.name}</strong> tiene múltiples unidades de venta. Por favor, selecciona una:</p>
              <select id="variant-select" class="form-select mb-3">
                <option value="">-- Selecciona una opción --</option>
                <option value="base" data-price="${prod.sale_price}">Unidad base (${formatCOP(prod.sale_price)})</option>
                ${prod.variants.map(v => `<option value="${v.id}" data-name="${v.name}" data-price="${v.sale_price}">${v.name} (${formatCOP(v.sale_price)})</option>`).join('')}
              </select>
              <label class="form-label">Cantidad</label>
              <input type="number" id="variant-qty" class="form-control" value="${qtyDefault}" min="0.1" step="0.1">
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-primary" id="confirm-variant-btn">Agregar a Cotización</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById("variantModal");
    if (existing) existing.remove();
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    const modal = new bootstrap.Modal(document.getElementById("variantModal"));
    modal.show();

    document.getElementById("confirm-variant-btn").addEventListener("click", () => {
      const select = document.getElementById("variant-select");
      const selectedOption = select.options[select.selectedIndex];
      if (!selectedOption.value) {
        Swal.fire('Atención', "Por favor, selecciona una unidad de venta.", 'warning');
        return;
      }

      const qty = Number(document.getElementById("variant-qty").value) || 1;

      let price = prod.sale_price;
      let productName = prod.name;
      let selectedVariant = null;

      if (selectedOption.value !== "base") {
        const variantId = Number(selectedOption.value);
        selectedVariant = prod.variants.find(v => v.id === variantId);
        if (selectedVariant) {
          price = selectedVariant.sale_price;
          // Agregamos la variante al nombre
          productName = `${prod.name} (${selectedVariant.name})`;
        }
      }

      addItemToQuote(prod, qty, price, productName, selectedVariant);
      modal.hide();
    });
  }

  // Función para agregar ítems a la cotización
  
  function addItemToQuote(prod, qty, price, productNameOverride = null, variant = null) {
    const source = variant || prod;
    // Calcular costo: prioriza el de la variante, si no, calcula desde el padre.
    let purchasePrice = 0;
    if (variant) {
        purchasePrice = variant.purchase_price > 0 ? variant.purchase_price : (prod ? (prod.purchase_price || 0) * (variant.conversion_factor || 1) : 0);
    } else if (prod) {
        purchasePrice = prod.purchase_price || 0;
    }

    quoteItems.push({
      product_id: prod ? prod.id : null,
      product_code: prod ? prod.code : 'SERV',
      product_name: productNameOverride || prod.name, // aquí siempre queda con variante si aplica
      quantity: qty,
      price: price,
      sale_price: source.sale_price || 0,
      special_price: source.special_price || 0,
      special_price_2: source.special_price_2 || 0,
      subtotal: price * qty,
      is_service: !prod, // Marcar si es un servicio
      purchase_price: purchasePrice,
      variant_id: variant ? variant.id : null
    });
    renderQuoteItems();
  }

  // --- Cargar productos
  function renderProductDatalist(products) {
    productDatalist.innerHTML = "";
    products.forEach(p => {
      const opt = document.createElement("option");
      opt.value = `${p.name} (${p.code}) - Stock ${p.stock}`;
      opt.dataset.id = p.id;
      opt.dataset.price = p.sale_price;
      opt.dataset.stock = p.stock;
      productDatalist.appendChild(opt);
    });
  }

  async function loadProducts() {
    allProducts = await window.api.getProducts();
    renderProductDatalist(allProducts);
  }

  // --- Cargar clientes
  async function loadClients() {
    const clients = await window.api.getClients();
    clientSelect.innerHTML = '<option value="">-- Sin cliente --</option>';
    clients.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.id_card_or_nit})`;
      clientSelect.appendChild(opt);
      
      // Llenar también el filtro
      const optFilter = document.createElement("option");
      optFilter.value = c.id;
      optFilter.textContent = c.name;
      filterClientSelect.appendChild(optFilter);
    });
  }

  // --- Renderizar ítems
  function renderQuoteItems() {
    saveQuoteState(); // Guardar estado cada vez que se renderiza (cambios en items)
    totalDiv.textContent = `TOTAL: ${formatCOP(quoteItems.reduce((sum, item) => sum + item.subtotal, 0))}`;
    quoteItemsTbody.innerHTML = "";
    let total = 0;

    function generatePriceOptions(item) {
      let options = '';
      const prices = [
        { label: 'Normal', value: item.sale_price },
        { label: 'Esp. 1', value: item.special_price },
        { label: 'Esp. 2', value: item.special_price_2 }
      ];
      prices.forEach(p => {
        if (p.value > 0) {
          const isSelected = Math.abs(item.price - p.value) < 0.01;
          options += `<option value="${p.value}" ${isSelected ? 'selected' : ''}>${p.label}: ${formatCOP(p.value)}</option>`;
        }
      });
      return options;
    }

    quoteItems.forEach((it, i) => {
      const isService = it.is_service || String(it.product_name).toLowerCase().startsWith('[servicio]');
      total += it.subtotal;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${it.product_code || '-'}</td>
        <td>${it.product_name}</td>
        <td>${it.quantity}</td>
        <td>
          ${isService ? formatCOP(it.price) : `<select class="form-select form-select-sm price-selector" data-i="${i}">${generatePriceOptions(it)}</select>`}
        </td>
        <td>${formatCOP(it.price*it.quantity)}</td>
        <td>
          <button class="btn btn-sm btn-danger remove" data-i="${i}">Eliminar</button>
        </td>
      `;
      quoteItemsTbody.appendChild(tr);
    });

    quoteItemsTbody.querySelectorAll(".remove").forEach(b=>{
      b.addEventListener('click', e=>{
        const i = Number(e.target.dataset.i);
        quoteItems.splice(i,1);
        renderQuoteItems();
      });
    });
  }

  // Delegación de eventos para el cambio de precios en cotizaciones
  quoteItemsTbody.addEventListener('change', (e) => {
    if (e.target.classList.contains('price-selector')) {
      const index = Number(e.target.dataset.i);
      const newPrice = parseFloat(e.target.value);
      if (!isNaN(newPrice) && quoteItems[index]) {
        quoteItems[index].price = newPrice;
        quoteItems[index].subtotal = newPrice * quoteItems[index].quantity;
        renderQuoteItems(); // Re-renderizar para actualizar subtotal y total
      }
    }
  });

  // --- Agregar producto
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputText = productInput.value.trim();
    
    const selectedOption = Array.from(productDatalist.options).find(
        opt => opt.value === inputText
    );

    if (!selectedOption) {
        Swal.fire('Atención', "Ítem no válido. Selecciona uno de la lista.", 'warning');
        return;
    }

    const itemId = Number(selectedOption.dataset.id);
    const qty = Number(qtyInput.value) || 1;

    const prod = allProducts.find(p => p.id === itemId);
    if (!prod) { Swal.fire('Error', "Producto no encontrado.", 'error'); return; }

    if (prod.stock <= prod.min_stock) {
      Swal.fire('Advertencia', `El producto '${prod.name}' está en stock mínimo (${prod.stock} unidades).`, 'warning');
    }

    // Chequeamos si el producto tiene variantes
    if (prod.variants && prod.variants.length > 0) {
      showVariantSelectionModalForQuote(prod, qty);
    } else {
      addItemToQuote(prod, qty, prod.sale_price);
    }

    productInput.value = "";
    qtyInput.value = "1";
    productInput.focus();
  });

  // --- Finalizar cotización
  finalizeBtn.addEventListener("click", async ()=>{
    if(quoteItems.length===0){ Swal.fire('Atención', "No hay items", 'warning'); return;}
    const clientId = clientSelect.value ? Number(clientSelect.value) : null;
    
    let res;
    if (editingQuoteId) {
      // Actualizar cotización existente
      res = await window.api.updateQuoteDetails({ id: editingQuoteId, client_id: clientId, items: quoteItems });
    } else {
      // Crear nueva cotización
      res = await window.api.createQuote({ client_id: clientId, items: quoteItems });
    }

    if(!res.success){ Swal.fire('Error', res.message, 'error'); return; }
    Swal.fire('Éxito', res.message || (editingQuoteId ? "Cotización actualizada" : "Cotización creada"), 'success');
    
    cancelEdit(); // Limpiar estado de edición y formulario
    quoteItems=[];
    renderQuoteItems();
    await loadQuotes();
    await loadProducts();
  });

  function cancelEdit() {
    editingQuoteId = null;
    quoteItems = [];
    renderQuoteItems();
    clientSelect.value = "";
    finalizeBtn.textContent = "Finalizar Cotización";
    finalizeBtn.classList.remove('btn-warning');
    finalizeBtn.classList.add('btn-primary');
    const cancelBtn = document.getElementById('cancel-edit-quote-btn');
    if(cancelBtn) cancelBtn.remove();
  }

  // --- Cargar cotizaciones
  async function loadQuotes(){
    const clientId = filterClientSelect.value ? Number(filterClientSelect.value) : null;
    const quotes = await window.api.getQuotes(clientId);
    if(!quotes.length){
      quotesList.innerHTML='<div class="alert alert-secondary">No hay cotizaciones</div>';
      return;
    }
    quotesList.innerHTML = quotes.map(q=>{
      const itemsHtml = (q.items||[]).map(i=>`<li>${i.product_name} x ${i.quantity} = ${formatCOP(i.subtotal)}</li>`).join('');
      return `<div class="card mb-2 p-2">
        <div><strong>${q.quote_number||`COT-${String(q.id).padStart(3,'0')}`}</strong> — ${q.quote_date} — Total: ${formatCOP(q.total_amount)}
          <div class="float-end">
            <div class="dropdown">
                <button class="btn btn-sm btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                  Acciones
                </button>
                <ul class="dropdown-menu">
                  <li><button class="dropdown-item approve-quote" data-id="${q.id}"><i class="fa fa-check me-2 text-primary"></i> Aprobar</button></li>
                  <li><button class="dropdown-item export-quote" data-id="${q.id}" data-quote_number="${q.quote_number}"><i class="fa fa-file-pdf me-2 text-success"></i> Exportar PDF</button></li>
                  <li><hr class="dropdown-divider"></li>
                  <li><button class="dropdown-item edit-quote" data-id="${q.id}"><i class="fa fa-edit me-2 text-warning"></i> Editar</button></li>
                  <li><button class="dropdown-item delete-quote" data-id="${q.id}"><i class="fa fa-trash me-2 text-danger"></i> Eliminar</button></li>
                </ul>
            </div>
          </div>
        </div><ul>${itemsHtml}</ul>
      </div>`;
    }).join('');

    quotesList.querySelectorAll('.approve-quote').forEach(b=>{
      b.addEventListener('click', async e=>{
        const quoteId = Number(e.target.dataset.id);
        const result = await Swal.fire({
            title: '¿Aprobar cotización?',
            text: "Se convertirá en una venta y se descontará del inventario al procesar el pago.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, aprobar',
            cancelButtonText: 'Cancelar'
        });
        if (!result.isConfirmed) return;
        await processQuoteApproval(quoteId); // Llamar a la nueva función de procesamiento
      });
    });

    quotesList.querySelectorAll('.edit-quote').forEach(b=>{
      b.addEventListener('click', async e=>{
        const quoteId = Number(e.target.dataset.id);
        const quote = await window.api.getQuoteById(quoteId);
        if(!quote) { Swal.fire('Error', "Error al cargar cotización", 'error'); return; }

        editingQuoteId = quoteId;
        clientSelect.value = quote.client_id || "";
        
        // Reconstruir items con detalles de producto para permitir edición de precios/variantes
        const detailedItems = [];
        for (const item of quote.items) {
            if (item.product_id) {
                const product = allProducts.find(p => p.id === item.product_id);
                if (product) { // Si el producto aún existe en el sistema
                    let source = product; // Por defecto, la fuente de precios es el producto padre
                    if (item.variant_id && product.variants) {
                        const v = product.variants.find(v => v.id === item.variant_id);
                        if (v) source = v; // Si se encuentra la variante, se convierte en la fuente de precios
                    }
                    detailedItems.push({
                        ...item,
                        // Aseguramos que el item tenga toda la info de precios para el selector
                        sale_price: source.sale_price || 0,
                        special_price: source.special_price || 0,
                        special_price_2: source.special_price_2 || 0,
                    });
                }
            } else {
                // Servicios o ítems sin producto asociado
                detailedItems.push({ ...item, sale_price: item.price, special_price: 0, special_price_2: 0 });
            }
        }
        quoteItems = detailedItems;
        renderQuoteItems();

        finalizeBtn.textContent = "Actualizar Cotización";
        finalizeBtn.classList.remove('btn-primary');
        finalizeBtn.classList.add('btn-warning');

        // Agregar botón cancelar si no existe
        if(!document.getElementById('cancel-edit-quote-btn')) {
          const cancelBtnHtml = `<button type="button" id="cancel-edit-quote-btn" class="btn btn-secondary ms-2">Cancelar Edición</button>`;
          finalizeBtn.insertAdjacentHTML('afterend', cancelBtnHtml);
          document.getElementById('cancel-edit-quote-btn').addEventListener('click', cancelEdit);
        }
        
        window.scrollTo(0, 0);
      });
    });

    quotesList.querySelectorAll('.delete-quote').forEach(b=>{
      b.addEventListener('click', async e=>{
        const id = Number(e.target.dataset.id); // Capturar ID antes del await
        const result = await Swal.fire({
            title: '¿Eliminar cotización?',
            text: "Esta acción no se puede deshacer.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Sí, eliminar'
        });
        if(!result.isConfirmed) return;
        await window.api.deleteQuote(id);
        loadQuotes();
        Swal.fire('Eliminado', 'La cotización ha sido eliminada.', 'success');
      });
    });

    quotesList.querySelectorAll('.export-quote').forEach(b=>{
      b.addEventListener('click', async e=>{
        const result = await Swal.fire({
            title: 'Opciones de Exportación',
            text: "¿Incluir IVA 19% en la cotización?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, con IVA',
            cancelButtonText: 'No, sin IVA'
        });
        const includeIva = result.isConfirmed;
        // 👇 Aquí ya viaja el product_name con variante si aplica
        const res = await window.api.exportQuotePDF(Number(e.target.dataset.id), e.target.dataset.quote_number, includeIva);
        Swal.fire(res.success ? 'Éxito' : 'Error', res.message || JSON.stringify(res), res.success ? 'success' : 'error');
      });
    });
  }

  // Nueva función para manejar el proceso de aprobación de cotización
  async function processQuoteApproval(quoteId) {
    const quote = await window.api.getQuoteById(quoteId);
    if (!quote) {
      Swal.fire('Error', "No se pudo cargar la cotización para aprobar.", 'error');
      return;
    }

    // Re-obtener todos los productos para asegurar el stock más reciente
    const currentAllProducts = await window.api.getProducts();

    // Agrupar requerimientos por producto padre para validar el total convertido
    const productRequirements = {}; // { productId: { product, totalRequiredBase } }

    for (const item of quote.items) {
      if (!item.product_id || item.product_code === 'SERV' || item.skip_stock) {
        continue;
      }

      const product = currentAllProducts.find(p => p.id === item.product_id);
      if (!product) continue;

      let conversionFactor = 1;
      if (item.variant_id && product.variants) {
          const variant = product.variants.find(v => v.id === item.variant_id);
          if (variant) conversionFactor = variant.conversion_factor || 1;
      }

      const requiredBase = item.quantity * conversionFactor;

      if (!productRequirements[item.product_id]) {
          productRequirements[item.product_id] = { product: product, totalRequiredBase: 0 };
      }
      productRequirements[item.product_id].totalRequiredBase += requiredBase;
    }

    let insufficientStockItems = [];
    for (const pid in productRequirements) {
        const req = productRequirements[pid];
        // Usamos un pequeño margen de error para comparaciones de punto flotante
        if (req.product.stock < (req.totalRequiredBase - 0.0001)) {
             insufficientStockItems.push({
                name: req.product.name,
                required: parseFloat(req.totalRequiredBase.toFixed(2)), // Mostrar en unidad base
                available: req.product.stock
             });
        }
    }

    if (insufficientStockItems.length > 0) {
      let alertMessage = "Stock insuficiente para los siguientes productos:<br><ul style='text-align: left;'>";
      insufficientStockItems.forEach(item => {
        alertMessage += `<li><strong>${item.name}</strong>: Requerido ${item.required} (Unidad Base), Disponible ${item.available}</li>`;
      });
      alertMessage += "</ul><br>Por favor, actualice el inventario y reintente.";
      Swal.fire({
          title: 'No se puede aprobar',
          html: alertMessage,
          icon: 'error'
      });
      return;
    }

    // Si el stock es suficiente, proceder al modal de pago
    const totalAmount = quote.items.reduce((sum, item) => sum + item.subtotal, 0);
    const clientId = quote.client_id;

    showPaymentModalForQuote(totalAmount, clientId, quote.items, quoteId);
  }

  // Nueva función para el modal de pago, adaptada de sales.js
  function showPaymentModalForQuote(totalAmount, clientId, quoteItems, quoteId) {
    const modalHtml = `
      <div class="modal fade" id="paymentModalForQuote" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Registrar Pago de Cotización</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p><strong>Total de la Venta:</strong> ${formatCOP(totalAmount)}</p>
              <div class="mb-2">
                <label>Tipo de Venta</label>
                <select class="form-select" id="sale-type-quote">
                    <option value="cash">Contado (Efectivo)</option>
                    <option value="transfer">Contado (Transferencia)</option>
                    <option value="credit">Crédito</option>
                </select>
              </div>
              <div class="mb-2" id="cashReceivedContainer">
                <label>Efectivo recibido</label>
                <input type="number" id="cashReceivedQuote" class="form-control" value="0" min="0">
              </div>
              <div class="mb-2" id="transferAmountContainer">
                <label>Transferencia</label>
                <input type="number" id="transferAmountQuote" class="form-control" value="0" min="0">
              </div>
              <div class="mb-2" id="bankReferenceContainerQuote" style="display:none;">
                <label>Banco / Referencia</label>
                <input type="text" id="transferReferenceQuote" class="form-control" placeholder="Ej: Bancolombia, Nequi...">
              </div>
              <div id="changeInfoQuote" class="mt-2 fw-bold text-success"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-primary" id="confirmPaymentBtnQuote">Confirmar Venta</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById("paymentModalForQuote");
    if (existing) existing.remove();
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const modal = new bootstrap.Modal(document.getElementById("paymentModalForQuote"));
    modal.show();

    const saleTypeSelect = document.getElementById("sale-type-quote");
    const cashInput = document.getElementById("cashReceivedQuote");
    const transferInput = document.getElementById("transferAmountQuote");
    const transferRefInput = document.getElementById("transferReferenceQuote");
    const cashReceivedContainer = document.getElementById("cashReceivedContainer");
    const transferAmountContainer = document.getElementById("transferAmountContainer");
    const bankReferenceContainer = document.getElementById("bankReferenceContainerQuote");
    const changeInfo = document.getElementById("changeInfoQuote");

    function updatePaymentFields() {
      const selectedType = saleTypeSelect.value;
      cashReceivedContainer.style.display = (selectedType === 'cash' || selectedType === 'transfer') ? 'block' : 'none';
      transferAmountContainer.style.display = (selectedType === 'transfer') ? 'block' : 'none';
      bankReferenceContainer.style.display = (selectedType === 'transfer' && parseFloat(transferInput.value) > 0) ? 'block' : 'none';
      
      if (selectedType === 'credit') {
          cashInput.value = 0;
          transferInput.value = 0;
          changeInfo.textContent = '';
      } else if (selectedType === 'cash') {
          cashInput.value = totalAmount; // Pre-llenar efectivo con el total
          transferInput.value = 0;
      } else if (selectedType === 'transfer') {
          transferInput.value = totalAmount; // Pre-llenar transferencia con el total
          cashInput.value = 0;
      }
      updateChange();
    }

    function updateChange() {
      const cash = parseFloat(cashInput.value) || 0;
      const transfer = parseFloat(transferInput.value) || 0;
      const totalPaid = cash + transfer;
      const change = totalPaid - totalAmount;
      if (change >= 0) {
        changeInfo.textContent = `Cambio a devolver: ${formatCOP(change)}`;
        changeInfo.classList.remove('text-danger');
        changeInfo.classList.add('text-success');
      } else {
        changeInfo.textContent = `Falta: ${formatCOP(-change)}`;
        changeInfo.classList.remove('text-success');
        changeInfo.classList.add('text-danger');
      }

      // Mostrar campo de banco si hay monto de transferencia
      bankReferenceContainer.style.display = (saleTypeSelect.value === 'transfer' && transfer > 0) ? "block" : "none";
    }

    saleTypeSelect.addEventListener("change", updatePaymentFields);
    cashInput.addEventListener("input", updateChange);
    transferInput.addEventListener("input", updateChange);
    updatePaymentFields(); // Estado inicial

    document.getElementById("confirmPaymentBtnQuote").addEventListener("click", async () => {
      const saleType = saleTypeSelect.value;
      const cash = parseFloat(cashInput.value) || 0;
      const transfer = parseFloat(transferInput.value) || 0;
      const transferRef = transferRefInput.value.trim();
      const totalPaid = cash + transfer;

      if (saleType !== "credit" && totalPaid < totalAmount) {
        Swal.fire('Error', "El monto pagado es insuficiente.", 'error');
        return;
      }
      if (saleType === "credit" && !clientId) {
        Swal.fire('Atención', "Para una venta a crédito, debes seleccionar un cliente.", 'warning');
        return;
      }

      const outstandingBalance = saleType === "credit" ? totalAmount : Math.max(0, totalAmount - totalPaid);
      const paidAmount = saleType === "credit" ? 0 : totalPaid;

      const saleData = {
        quote_id: quoteId, // Enlazar a la cotización original
        client_id: clientId,
        items: quoteItems,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        outstanding_balance: outstandingBalance,
        sale_type: saleType,
        cash_payment: cash,
        transfer_payment: transfer,
        transfer_reference: transferRef
      };

      // Se asume que window.api.createSaleFromQuote está implementado en el proceso principal
      const res = await window.api.createSaleFromQuote(saleData);
      if (!res.success) {
        Swal.fire('Error', res.message, 'error');
        return;
      }

      Swal.fire('Éxito', res.message || "Cotización aprobada y convertida a venta exitosamente.", 'success');
      localStorage.removeItem('persistentQuoteCart'); // Limpiar el carrito persistente de cotizaciones
      quoteItems = []; // Limpiar los ítems de la cotización actual
      renderQuoteItems(); // Actualizar la interfaz de usuario
      modal.hide(); // Cerrar el modal de pago
      await loadQuotes(); // Recargar la lista de cotizaciones
      await loadProducts(); // Recargar productos para reflejar los cambios de stock
    });
  }

});
