document.addEventListener('DOMContentLoaded', async () => {
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
        <div class="page-title">Gestión de Servicios</div>
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

  const form = document.getElementById('service-form');
  const idInput = document.getElementById('service-id');
  const nameInput = document.getElementById('service-name');
  const priceInput = document.getElementById('service-price');
  const descInput = document.getElementById('service-desc');
  
  const productSearch = document.getElementById('product-search');
  const productDatalist = document.getElementById('products-list');
  const productQty = document.getElementById('product-qty');
  const addProductBtn = document.getElementById('add-product-btn');
  const productsTable = document.getElementById('service-products-table');
  
  const servicesTable = document.getElementById('services-table');
  const cancelBtn = document.getElementById('cancel-edit');
  const searchInput = document.getElementById('search-service');

  let allProducts = [];
  let currentServiceProducts = []; // { product_id, name, price, quantity }
  let allServices = [];

  // --- INYECTAR SELECTOR DE CLIENTE ---
  const clientContainer = document.createElement('div');
  clientContainer.className = 'mb-3';
  clientContainer.innerHTML = `
    <label class="form-label">Cliente Asociado</label>
    <select class="form-select" id="service-client">
        <option value="">-- Ninguno --</option>
    </select>
  `;
  // Insertar antes del campo de nombre
  form.prepend(clientContainer);
  const clientSelect = document.getElementById('service-client');
  // ------------------------------------

  function formatCOP(value) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value);
  }

  // Cargar productos para el datalist
  async function loadProducts() {
    allProducts = await window.api.getProducts();
    productDatalist.innerHTML = "";
    allProducts.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.name;
      opt.dataset.id = p.id;
      opt.dataset.price = p.sale_price;
      productDatalist.appendChild(opt);
    });
  }

  // Cargar clientes
  async function loadClients() {
      const clients = await window.api.getClients();
      clientSelect.innerHTML = '<option value="">-- Ninguno --</option>';
      clients.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          clientSelect.appendChild(opt);
      });
  }

  // Agregar producto a la lista temporal del servicio
  addProductBtn.addEventListener('click', () => {
    const val = productSearch.value;
    const prod = allProducts.find(p => p.name === val);
    if (!prod) {
      alert("Seleccione un producto válido de la lista");
      return;
    }
    const qty = Number(productQty.value) || 1;

    // Verificar si ya existe
    const existing = currentServiceProducts.find(p => p.product_id === prod.id);
    if (existing) {
      existing.quantity += qty;
    } else {
      currentServiceProducts.push({
        product_id: prod.id,
        name: prod.name,
        price: prod.sale_price,
        quantity: qty
      });
    }
    renderServiceProducts();
    productSearch.value = "";
    productQty.value = 1;
  });

  function renderServiceProducts() {
    productsTable.innerHTML = "";
    currentServiceProducts.forEach((p, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.quantity}</td>
        <td>${formatCOP(p.price)}</td>
        <td>${formatCOP(p.price * p.quantity)}</td>
        <td><button type="button" class="btn btn-sm btn-danger remove-prod" data-index="${index}">X</button></td>
      `;
      productsTable.appendChild(tr);
    });

    productsTable.querySelectorAll(".remove-prod").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = e.target.dataset.index;
        currentServiceProducts.splice(idx, 1);
        renderServiceProducts();
      });
    });
  }

  // Guardar Servicio
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      id: idInput.value ? Number(idInput.value) : null,
      name: nameInput.value,
      price: Number(priceInput.value) || 0,
      client_id: clientSelect.value ? Number(clientSelect.value) : null,
      description: descInput.value,
      products: currentServiceProducts
    };

    if (data.id) {
      await window.api.updateService(data);
    } else {
      await window.api.createService(data);
    }

    resetForm();
    loadServices();
  });

  function resetForm() {
    form.reset();
    idInput.value = "";
    clientSelect.value = "";
    currentServiceProducts = [];
    renderServiceProducts();
    cancelBtn.style.display = "none";
  }

  cancelBtn.addEventListener("click", resetForm);

  // Cargar Servicios
  async function loadServices() {
    allServices = await window.api.getServices();
    renderServicesTable(allServices);
  }

  function renderServicesTable(list) {
    // Inyectar encabezado de Cliente si no existe
    const tableEl = servicesTable.closest('table');
    if(tableEl) {
        const thead = tableEl.querySelector('thead tr');
        if(thead && !thead.querySelector('.th-client')) {
            const th = document.createElement('th');
            th.className = 'th-client';
            th.textContent = 'Cliente';
            if(thead.children.length > 0) thead.insertBefore(th, thead.children[1]); // Insertar después de Nombre
        }
    }

    servicesTable.innerHTML = "";
    list.forEach(s => {
      const materialsCost = Number(s.materials_cost) || 0;
      const totalSuggested = (s.price || 0) + materialsCost;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${s.name}</strong></td>
        <td>${s.client_name || '<span class="text-muted">-</span>'}</td>
        <td>${s.description || '-'}</td>
        <td>${formatCOP(s.price)}</td>
        <td>${formatCOP(materialsCost)}</td>
        <td><strong>${formatCOP(totalSuggested)}</strong></td>
        <td>
          <button class="btn btn-sm btn-info to-sale" data-id="${s.id}" title="Enviar a Venta"><i class="fa fa-shopping-cart"></i></button>
          <button class="btn btn-sm btn-secondary to-quote" data-id="${s.id}" title="Enviar a Cotización"><i class="fa fa-file-invoice-dollar"></i></button>
          <button class="btn btn-sm btn-primary edit" data-id="${s.id}" title="Editar"><i class="fa fa-edit"></i></button>
          <button class="btn btn-sm btn-danger del" data-id="${s.id}" title="Eliminar"><i class="fa fa-trash"></i></button>
        </td>
      `;
      servicesTable.appendChild(tr);

      // Restricción de roles
      const role = localStorage.getItem('user_role');
      if (role !== 'admin') {
        tr.querySelectorAll('.del').forEach(btn => btn.remove());
      }
    });
    servicesTable.querySelectorAll(".del").forEach(b => b.addEventListener("click", async (e) => {
      if(confirm("¿Eliminar servicio?")) {
        await window.api.deleteService(e.currentTarget.dataset.id);
        loadServices();
      }
    }));

    servicesTable.querySelectorAll(".edit").forEach(b => b.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id;
      const service = await window.api.getServiceById(id);
      idInput.value = service.id;
      nameInput.value = service.name;
      priceInput.value = service.price;
      descInput.value = service.description;
      clientSelect.value = service.client_id || "";
      
      currentServiceProducts = service.products.map(p => ({
        product_id: p.product_id,
        name: p.name,
        price: p.sale_price,
        quantity: p.quantity
      }));
      renderServiceProducts();
      cancelBtn.style.display = "inline-block";
      window.scrollTo(0,0);
    }));

    servicesTable.querySelectorAll(".to-sale").forEach(b => b.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id;
      const service = await window.api.getServiceById(id);
      
      // Construir items para el carrito
      const cartItems = [];
      
      let serviceName = `[SERVICIO] ${service.name}`;
      if (service.description) {
        serviceName += ` - ${service.description}`;
      }

      // 1. El servicio como ítem (sin product_id)
      cartItems.push({
        product_id: null,
        product_code: "SERV",
        product_name: serviceName,
        quantity: 1,
        price: service.price,
        sale_price: service.price,
        special_price: 0,
        subtotal: service.price
      });

      // 2. Los materiales
      service.products.forEach(p => {
        cartItems.push({
          product_id: p.product_id,
          product_code: p.code,
          product_name: p.name,
          quantity: p.quantity,
          price: p.sale_price,
          sale_price: p.sale_price,
          special_price: 0,
          subtotal: p.sale_price * p.quantity,
          skip_stock: true // ⚠️ IMPORTANTE: Evita doble descuento de inventario
        });
      });

      // Guardar en sessionStorage y redirigir
      // Recuperar carrito actual si existe para no sobreescribir? 
      // El usuario pidió "generar ese servicio como venta", asumimos venta nueva o añadir.
      // Vamos a AÑADIR al carrito existente.
      const existingCart = JSON.parse(sessionStorage.getItem('shoppingCart') || "[]");
      const newCart = existingCart.concat(cartItems);
      
      sessionStorage.setItem('shoppingCart', JSON.stringify(newCart));
      window.location.href = "sales.html";
    }));

    servicesTable.querySelectorAll(".to-quote").forEach(b => b.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id;
      const service = await window.api.getServiceById(id);
      
      // Construir items para la cotización
      const cartItems = [];
      
      let serviceName = `[SERVICIO] ${service.name}`;
      if (service.description) {
        serviceName += ` - ${service.description}`;
      }

      // 1. El servicio como ítem
      cartItems.push({
        product_id: null,
        product_code: "SERV",
        product_name: serviceName,
        quantity: 1,
        price: service.price,
        sale_price: service.price,
        special_price: 0,
        subtotal: service.price
      });

      // 2. Los materiales
      service.products.forEach(p => {
        cartItems.push({
          product_id: p.product_id,
          product_code: p.code,
          product_name: p.name,
          quantity: p.quantity,
          price: p.sale_price,
          sale_price: p.sale_price,
          special_price: 0,
          subtotal: p.sale_price * p.quantity,
          skip_stock: true // ⚠️ IMPORTANTE: Evita doble descuento de inventario
        });
      });

      // Guardar en sessionStorage con clave específica para cotizaciones
      sessionStorage.setItem('quoteCart', JSON.stringify(cartItems));
      window.location.href = "quotes.html";
    }));
  }

  searchInput.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allServices.filter(s => 
        s.name.toLowerCase().includes(q) || 
        (s.client_name && s.client_name.toLowerCase().includes(q))
    );
    renderServicesTable(filtered);
  });

  await loadProducts();
  await loadClients();
  await loadServices();
});