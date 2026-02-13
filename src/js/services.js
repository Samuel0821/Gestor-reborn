document.addEventListener('DOMContentLoaded', async () => {
  // Layout manejado por layout.js

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

  // Modal de selección de variante
  function showVariantSelectionModal(prod, qtyDefault = 1) {
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
              <button type="button" class="btn btn-primary" id="confirm-variant-btn">Agregar a Servicio</button>
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
      let selectedVariant = null;
      
      if (selectedOption.value !== "base") {
        const variantId = Number(selectedOption.value);
        selectedVariant = prod.variants.find(v => v.id === variantId);
      }

      addItemToService(prod, qty, selectedVariant);
      modal.hide();
    });
  }

  function addItemToService(prod, qty, variant) {
      let itemPrice = variant ? variant.sale_price : prod.sale_price;
      let itemName = variant ? `${prod.name} (${variant.name})` : prod.name;
      let variantId = variant ? variant.id : null;

      const existing = currentServiceProducts.find(p => p.product_id === prod.id && p.variant_id === variantId);
      if (existing) {
        existing.quantity += qty;
      } else {
        currentServiceProducts.push({
          product_id: prod.id,
          name: itemName,
          price: itemPrice,
          quantity: qty,
          variant_id: variantId
        });
      }
      renderServiceProducts();
  }

  // Agregar producto a la lista temporal del servicio
  addProductBtn.addEventListener('click', () => {
    const val = productSearch.value;
    const prod = allProducts.find(p => p.name === val);
    if (!prod) {
      Swal.fire('Atención', "Seleccione un producto válido de la lista", 'warning');
      return;
    }
    const qty = Number(productQty.value) || 1;

    // Verificar si tiene variantes
    if (prod.variants && prod.variants.length > 0) {
      showVariantSelectionModal(prod, qty);
      productSearch.value = "";
      productQty.value = 1;
      return;
    }
    addItemToService(prod, qty, null);
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

    Swal.fire({ icon: 'success', title: 'Servicio guardado', timer: 1500, showConfirmButton: false });
    resetForm();
    loadServices();
    loadProducts(); // Recargar lista de productos para actualizar stock en memoria
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
      const id = Number(e.currentTarget.dataset.id); // Capturar ID antes del await
      const result = await Swal.fire({
        title: '¿Eliminar servicio?',
        text: "Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      });
      if(result.isConfirmed) {
        try {
            await window.api.deleteService(id);
            loadServices();
            Swal.fire('Eliminado', 'El servicio ha sido eliminado.', 'success');
        } catch (err) {
            console.error(err);
            Swal.fire('Error', "Error al eliminar servicio", 'error');
        }
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
        name: p.variant_name ? `${p.name} (${p.variant_name})` : p.name,
        price: p.sale_price,
        quantity: p.quantity,
        variant_id: p.variant_id
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
          product_name: p.variant_name ? `${p.name} (${p.variant_name})` : p.name,
          quantity: p.quantity,
          price: p.sale_price,
          sale_price: p.sale_price,
          special_price: 0,
          subtotal: p.sale_price * p.quantity,
          skip_stock: true, // ⚠️ IMPORTANTE: Evita doble descuento de inventario
          variant_id: p.variant_id
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
          product_name: p.variant_name ? `${p.name} (${p.variant_name})` : p.name,
          quantity: p.quantity,
          price: p.sale_price,
          sale_price: p.sale_price,
          special_price: 0,
          subtotal: p.sale_price * p.quantity,
          skip_stock: true, // ⚠️ IMPORTANTE: Evita doble descuento de inventario
          variant_id: p.variant_id
        });
      });

      // AÑADIR al carrito de cotización existente en lugar de sobreescribir
      const existingQuoteCart = JSON.parse(sessionStorage.getItem('quoteCart') || "[]");
      const newQuoteCart = existingQuoteCart.concat(cartItems);
      
      sessionStorage.setItem('quoteCart', JSON.stringify(newQuoteCart));
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