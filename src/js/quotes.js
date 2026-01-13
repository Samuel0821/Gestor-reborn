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
      <div class="sidebar-brand"><i class="fa fa-cubes me-2"></i> GestorFX</div>
      <nav class="sidebar-menu">
        <a href="index.html" class="sidebar-link ${currentPage === 'index.html' ? 'active' : ''}"><i class="fa fa-home"></i> Dashboard</a>
        <a href="sales.html" class="sidebar-link ${currentPage === 'sales.html' ? 'active' : ''}"><i class="fa fa-shopping-cart"></i> Ventas</a>
        <a href="products.html" class="sidebar-link ${currentPage === 'products.html' ? 'active' : ''}"><i class="fa fa-box"></i> Productos</a>
        <a href="clients.html" class="sidebar-link ${currentPage === 'clients.html' ? 'active' : ''}"><i class="fa fa-users"></i> Clientes</a>
        <a href="suppliers.html" class="sidebar-link ${currentPage === 'suppliers.html' ? 'active' : ''}"><i class="fa fa-truck"></i> Proveedores</a>
        <a href="quotes.html" class="sidebar-link ${currentPage === 'quotes.html' ? 'active' : ''}"><i class="fa fa-file-invoice-dollar"></i> Cotizaciones</a>
        <a href="purchase_orders.html" class="sidebar-link ${currentPage === 'purchase_orders.html' ? 'active' : ''}"><i class="fa fa-clipboard-list"></i> Órdenes Compra</a>
        <a href="services.html" class="sidebar-link ${currentPage === 'services.html' ? 'active' : ''}"><i class="fa fa-concierge-bell"></i> Servicios</a>
        <a href="reports.html" class="sidebar-link ${currentPage === 'reports.html' ? 'active' : ''}"><i class="fa fa-chart-line"></i> Reportes</a>
        <a href="settings.html" class="sidebar-link ${currentPage === 'settings.html' ? 'active' : ''}"><i class="fa fa-cog"></i> Ajustes</a>
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

  // Verificar si hay ítems transferidos desde Servicios
  const savedQuoteCart = sessionStorage.getItem('quoteCart');
  if (savedQuoteCart) {
    try {
      quoteItems = JSON.parse(savedQuoteCart);
      sessionStorage.removeItem('quoteCart'); // Limpiar después de cargar
    } catch (e) { console.error(e); }
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

  // --- Cargar clientes
  async function loadClients() {
    const clients = await window.api.getClients();
    clientSelect.innerHTML = '<option value="">-- Sin cliente --</option>';
    clients.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.id_card_or_nit})`;
      clientSelect.appendChild(opt);
    });
  }

  // --- Renderizar ítems
  function renderQuoteItems() {
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

    totalDiv.textContent = `TOTAL: ${formatCOP(total)}`;

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
    const clientId = clientSelect.value?Number(clientSelect.value):null;
    const res = await window.api.createQuote({client_id:clientId,items:quoteItems});
    if(!res.success){ alert(res.message); return; }
    alert(res.message||"Cotización creada");
    quoteItems=[];
    renderQuoteItems();
    await loadQuotes();
    await loadProducts();
  });

  // --- Cargar cotizaciones
  async function loadQuotes(){
    const quotes = await window.api.getQuotes();
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
            <button class="btn btn-sm btn-primary ms-1 approve-quote" data-id="${q.id}">Aprobar</button>
            <button class="btn btn-sm btn-danger ms-1 delete-quote" data-id="${q.id}">Eliminar</button>
          </div>
        </div><ul>${itemsHtml}</ul>
      </div>`;
    }).join('');

    quotesList.querySelectorAll('.approve-quote').forEach(b=>{
      b.addEventListener('click', async e=>{
        if(!confirm('¿Aprobar esta cotización y convertirla en venta?')) return;
        const quoteId = Number(e.target.dataset.id);
        const res = await window.api.approveQuote(quoteId);
        alert(res.message||JSON.stringify(res));
        await loadQuotes();
        await loadProducts();
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
        const includeIva = confirm('¿Incluir IVA 19% en la cotización?\nAceptar = Sí, Cancelar = No');
        // 👇 Aquí ya viaja el product_name con variante si aplica
        const res = await window.api.exportQuotePDF(Number(e.target.dataset.id),e.target.dataset.quote_number,includeIva);
        alert(res.message||JSON.stringify(res));
      });
    });
  }

  await loadProducts();
  await loadClients();
  await loadQuotes();
  renderQuoteItems(); // Renderizar si hay ítems cargados desde servicios
});
