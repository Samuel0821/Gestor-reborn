document.addEventListener('DOMContentLoaded', async () => {
  console.log('quotes.js cargado');

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
        <div class="page-title">Cotizaciones</div>
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

  // Verificar si hay ítems transferidos desde Servicios
  const savedQuoteCart = sessionStorage.getItem('quoteCart');
  if (savedQuoteCart) {
    try {
      quoteItems = JSON.parse(savedQuoteCart);
      sessionStorage.removeItem('quoteCart'); // Limpiar después de cargar
      saveQuoteState();
    } catch (e) { console.error(e); }
  } else {
    // Si no hay transferencia, intentar cargar del almacenamiento local
    const persistentCart = localStorage.getItem('persistentQuoteCart');
    if (persistentCart) {
      try {
        quoteItems = JSON.parse(persistentCart);
      } catch (e) { console.error(e); }
    }
  }

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
        alert("Por favor, selecciona una unidad de venta.");
        return;
      }

      const qty = Number(document.getElementById("variant-qty").value) || 1;

      let price = prod.sale_price;
      let productName = prod.name;

      if (selectedOption.value !== "base") {
        const variantId = Number(selectedOption.value);
        const selectedVariant = prod.variants.find(v => v.id === variantId);
        if (selectedVariant) {
          price = selectedVariant.sale_price;
          // Agregamos la variante al nombre
          productName = `${prod.name} (${selectedVariant.name})`;
        }
      }

      addItemToQuote(prod, qty, price, productName);
      modal.hide();
    });
  }

  // Función para agregar ítems a la cotización
  
  function addItemToQuote(prod, qty, price, productNameOverride = null) {
    quoteItems.push({
      product_id: prod.id,
      product_code: prod.code,
      product_name: productNameOverride || prod.name, // aquí siempre queda con variante si aplica
      quantity: qty,
      price: price,
      sale_price: prod.sale_price,
      special_price: prod.special_price,
      subtotal: price * qty
    });
    renderQuoteItems();
  }

  // --- Cargar productos
  async function loadProducts() {
    allProducts = await window.api.getProducts();
    renderProductDatalist(allProducts);
  }

  // --- Renderizar datalist
  function renderProductDatalist(products) {
    productDatalist.innerHTML = "";
    products.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.name;
      opt.dataset.id = p.id;
      opt.dataset.price = p.sale_price;
      opt.dataset.stock = p.stock;
      productDatalist.appendChild(opt);
    });
  }

  // --- FILTRO POR CLIENTE ---
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
    quoteItems.forEach((it, i) => {
      total += it.subtotal;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${it.product_code}</td>
        <td>${it.product_name}</td>
        <td>${it.quantity}</td>
        <td>
          <select class="form-select form-select-sm price-selector">
            <option value="sale" data-price="${it.sale_price}" ${it.price===it.sale_price?'selected':''}>${formatCOP(it.sale_price)}</option>
            ${it.special_price>0?`<option value="special" data-price="${it.special_price}" ${it.price===it.special_price?'selected':''}>${formatCOP(it.special_price)}</option>`:''}
          </select>
        </td>
        <td>${formatCOP(it.price*it.quantity)}</td>
        <td>
          <button class="btn btn-sm btn-danger remove" data-i="${i}">Eliminar</button>
        </td>
      `;
      quoteItemsTbody.appendChild(tr);

      tr.querySelector('.price-selector').addEventListener('change', e=>{
        const selectedOption = e.target.options[e.target.selectedIndex];
        const newPrice = parseFloat(selectedOption.dataset.price);
        quoteItems[i].price = newPrice;
        quoteItems[i].subtotal = newPrice * quoteItems[i].quantity;
        renderQuoteItems();
      });
    });

    quoteItemsTbody.querySelectorAll(".remove").forEach(b=>{
      b.addEventListener('click', e=>{
        const i = Number(e.target.dataset.i);
        quoteItems.splice(i,1);
        renderQuoteItems();
      });
    });
  }

  // --- Agregar producto
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputText = productInput.value.trim();
    const prod = allProducts.find(p => p.name === inputText);

    if (!prod) {
      alert("Producto no válido. Selecciona uno existente.");
      return;
    }

    const qty = Number(qtyInput.value) || 1;

    if (prod.stock <= prod.min_stock) {
      alert(`¡Advertencia! El producto '${prod.name}' está en stock mínimo (${prod.stock} unidades).`);
    }

    // Chequeamos si el producto tiene variantes
    if (prod.variants && prod.variants.length > 0) {
      showVariantSelectionModalForQuote(prod, qty);
    } else {
      addItemToQuote(prod, qty, prod.sale_price);
    }

    productInput.value = "";
    qtyInput.value = "1";
  });

  // --- Finalizar cotización
  finalizeBtn.addEventListener("click", async ()=>{
    if(quoteItems.length===0){ alert("No hay items"); return;}
    const clientId = clientSelect.value ? Number(clientSelect.value) : null;
    
    let res;
    if (editingQuoteId) {
      // Actualizar cotización existente
      res = await window.api.updateQuoteDetails({ id: editingQuoteId, client_id: clientId, items: quoteItems });
    } else {
      // Crear nueva cotización
      res = await window.api.createQuote({ client_id: clientId, items: quoteItems });
    }

    if(!res.success){ alert(res.message); return; }
    alert(res.message || (editingQuoteId ? "Cotización actualizada" : "Cotización creada"));
    
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
            <button class="btn btn-sm btn-success export-quote" data-id="${q.id}" data-quote_number="${q.quote_number}">Exportar PDF</button>
            <button class="btn btn-sm btn-warning ms-1 edit-quote" data-id="${q.id}">Editar</button>
            <button class="btn btn-sm btn-primary ms-1 approve-quote" data-id="${q.id}">Aprobar</button>
            <button class="btn btn-sm btn-danger ms-1 delete-quote" data-id="${q.id}">Eliminar</button>
          </div>
        </div><ul>${itemsHtml}</ul>
      </div>`;
    }).join('');

    quotesList.querySelectorAll('.approve-quote').forEach(b=>{
      b.addEventListener('click', async e=>{
        if (!confirm('¿Aprobar esta cotización y convertirla en venta?')) return; // Mensaje de confirmación
        const quoteId = Number(e.target.dataset.id);
        await processQuoteApproval(quoteId); // Llamar a la nueva función de procesamiento
      });
    });

    quotesList.querySelectorAll('.edit-quote').forEach(b=>{
      b.addEventListener('click', async e=>{
        const quoteId = Number(e.target.dataset.id);
        const quote = await window.api.getQuoteById(quoteId);
        if(!quote) { alert("Error al cargar cotización"); return; }

        editingQuoteId = quoteId;
        clientSelect.value = quote.client_id || "";
        
        // Reconstruir items con detalles de producto para permitir edición de precios/variantes
        const detailedItems = [];
        for (const item of quote.items) {
            if (item.product_id) {
                const product = allProducts.find(p => p.id === item.product_id);
                if (product) {
                    detailedItems.push({
                        ...item,
                        sale_price: product.sale_price,
                        special_price: product.special_price,
                    });
                } else {
                   detailedItems.push({ ...item, sale_price: item.price, special_price: 0 });
                }
            } else {
                detailedItems.push({ ...item, sale_price: item.price, special_price: 0 });
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
        if(!confirm('Eliminar cotización?')) return;
        await window.api.deleteQuote(Number(e.target.dataset.id));
        loadQuotes();
      });
    });

    quotesList.querySelectorAll('.export-quote').forEach(b=>{
      b.addEventListener('click', async e=>{
        const includeIva = confirm('¿Incluir IVA 19% en la cotización?\nAceptar = Sí, Cancelar = No'); // Confirmación de IVA
        // 👇 Aquí ya viaja el product_name con variante si aplica
        const res = await window.api.exportQuotePDF(Number(e.target.dataset.id), e.target.dataset.quote_number, includeIva);
        alert(res.message || JSON.stringify(res));
      });
    });
  }

  // Nueva función para manejar el proceso de aprobación de cotización
  async function processQuoteApproval(quoteId) {
    const quote = await window.api.getQuoteById(quoteId);
    if (!quote) {
      alert("No se pudo cargar la cotización para aprobar.");
      return;
    }

    // Re-obtener todos los productos para asegurar el stock más reciente
    const currentAllProducts = await window.api.getProducts();

    let insufficientStockItems = [];
    for (const item of quote.items) {
      const product = currentAllProducts.find(p => p.id === item.product_id);
      // Si el producto no se encuentra o el stock es menor a la cantidad requerida
      if (!product || product.stock < item.quantity) {
        insufficientStockItems.push({
          name: item.product_name,
          required: item.quantity,
          available: product ? product.stock : 0
        });
      }
    }

    if (insufficientStockItems.length > 0) {
      let alertMessage = "No se puede aprobar la cotización. Stock insuficiente para los siguientes productos:\n\n";
      insufficientStockItems.forEach(item => {
        alertMessage += `- ${item.name}: Requerido ${item.required}, Disponible ${item.available}\n`;
      });
      alert(alertMessage + "\nPor favor, actualice el inventario y reintente.");
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
        alert("El monto pagado es insuficiente.");
        return;
      }
      if (saleType === "credit" && !clientId) {
        alert("Para una venta a crédito, debes seleccionar un cliente.");
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
        alert(res.message);
        return;
      }

      alert(res.message || "Cotización aprobada y convertida a venta exitosamente.");
      localStorage.removeItem('persistentQuoteCart'); // Limpiar el carrito persistente de cotizaciones
      quoteItems = []; // Limpiar los ítems de la cotización actual
      renderQuoteItems(); // Actualizar la interfaz de usuario
      modal.hide(); // Cerrar el modal de pago
      await loadQuotes(); // Recargar la lista de cotizaciones
      await loadProducts(); // Recargar productos para reflejar los cambios de stock
    });
  }

  await loadProducts();
  await loadClients();
  await loadQuotes();
  renderQuoteItems(); // Renderizar si hay ítems cargados desde servicios
});
