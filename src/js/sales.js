console.log('sales.js cargado');

let saleItems = [];
let allClients = []; // Variable global para almacenar todos los clientes y facilitar la búsqueda
let allProducts = [];
let editingSaleId = null;
let currentCreditOffset = 0;
const CREDITS_LIMIT = 10;
let loadMoreCreditsBtn;

function saveCart() {
  sessionStorage.setItem('shoppingCart', JSON.stringify(saleItems));
}

function formatCOP(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);
}

document.addEventListener("DOMContentLoaded", async () => {
 
  // Referencias a elementos
  
  const productInput = document.getElementById("sale-product-input");
  const productDatalist = document.getElementById("products-list");
  const qtyInput = document.getElementById("sale-quantity");
  const saleForm = document.getElementById("sale-form");
  const saleItemsTbody = document.getElementById("sale-items");
  const totalDiv = document.getElementById("sale-total");
  const finalizeBtn = document.getElementById("finalize-sale");
  const salesList = document.getElementById("sales-list");
  const clientSelect = document.getElementById("sale-client");
  const clientInput = document.getElementById("sale-client-input"); // Nuevo: Input para el nombre del cliente
  const clientsDatalist = document.getElementById("clients-datalist"); // Nuevo: Datalist para sugerencias
  const clientHiddenIdInput = document.getElementById("sale-client-id"); // Nuevo: Input oculto para el ID real
  const saleNotesInput = document.getElementById("sale-notes");
  const saleTypeSelect = document.getElementById("sale-type");
  const creditsList = document.getElementById("credits-list");
  const creditSearchInput = document.getElementById("credit-search-input");
  const creditSearchBtn = document.getElementById("credit-search-btn");
  const barcodeInput = document.getElementById("barcode-input");

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

  // --- FILTRO POR CLIENTE Y BUSCADOR ---
  const searchContainer = document.createElement("div");
  searchContainer.className = "mb-3 col-md-12 d-flex gap-3 align-items-center flex-wrap";
  searchContainer.innerHTML = `
      <div class="input-group input-group-sm flex-grow-1" style="min-width: 250px;">
        <span class="input-group-text"><i class="fa fa-search"></i></span>
        <input type="text" id="search-sale-history" class="form-control" placeholder="Buscar por nombre de cliente o número de factura..." list="client-search-list">
        <datalist id="client-search-list"></datalist>
      </div>
      <div id="sales-filter-container" class="d-flex align-items-center gap-2">
          <label class="form-label mb-0 small fw-bold">Mostrar:</label>
          <select id="sales-filter-status" class="form-select form-select-sm w-auto">
              <option value="active">Activas</option>
              <option value="annulled">Anuladas</option>
              <option value="all">Todas</option>
          </select>
      </div>
  `;
  if (salesList && salesList.parentNode) {
      // Find the parent of salesList to insert the search bar
      const parentDiv = salesList.parentNode;
      parentDiv.insertBefore(searchContainer, salesList);
  }
  const clientSearchDatalist = document.getElementById('client-search-list'); // Referencia al nuevo datalist

  // Listener para el filtro de estado
  document.getElementById("sales-filter-status")?.addEventListener('change', () => loadSales(false));

  const searchSaleInput = document.getElementById('search-sale-history');
  let searchTimeout;
  searchSaleInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadSales(false), 300);
  });

  // --- Carga Inicial ---
  await loadProducts();
  await loadClients(); // Cargar clientes al inicio para poblar el datalist
  
  // Event listener para el input del cliente: actualiza el campo oculto con el ID
  clientInput.addEventListener('input', () => {
    const selectedOption = Array.from(clientsDatalist.options).find(
      opt => opt.value === clientInput.value
    );
    if (selectedOption) {
      clientHiddenIdInput.value = selectedOption.dataset.id;
    } else {
      clientHiddenIdInput.value = ""; // Limpiar si no hay una selección válida
    }
  });

  // Cargar carrito desde sessionStorage DESPUÉS de cargar productos para poder enriquecer los datos
  const savedCart = sessionStorage.getItem('shoppingCart');
  if (savedCart) {
    try {
      const parsedCart = JSON.parse(savedCart);
      // Enriquece los items del carrito con la información de precios completa
      saleItems = parsedCart.map(item => {
        if (!item.product_id) return item;
        const product = allProducts.find(p => p.id === item.product_id);
        if (!product) return item;
        const source = item.variant_id ? product.variants.find(v => v.id === item.variant_id) : product;
        if (!source) return item;
        return { ...item, ...{ sale_price: source.sale_price, special_price: source.special_price, special_price_2: source.special_price_2 } };
      });
    } catch (e) {
      console.error("Error al cargar el carrito guardado:", e);
      sessionStorage.removeItem('shoppingCart');
    }
  }

  function cancelEdit() {
    editingSaleId = null;
    saleItems = [];
    renderSaleItems();
    clientSelect.value = "";
    clientInput.value = ""; // Limpiar el campo visible
    clientHiddenIdInput.value = ""; // Limpiar el ID oculto
    saleNotesInput.value = "";
    saleTypeSelect.value = "cash";
    finalizeBtn.textContent = "Finalizar Venta";
    finalizeBtn.classList.remove('btn-warning');
    finalizeBtn.classList.add('btn-primary');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if(cancelBtn) cancelBtn.remove();
    productInput.focus();
  }

  // --- LÓGICA DE PLAZO DE CRÉDITO ---
  saleTypeSelect.addEventListener('change', () => {
      const container = document.getElementById('credit-due-date-container');
      if (saleTypeSelect.value === 'credit') {
          if (!container) {
              const html = `
                <div id="credit-due-date-container" class="mt-2 bg-light p-2 rounded border shadow-sm">
                    <label class="form-label small fw-bold">Plazo de Vencimiento (Fecha)</label>
                    <input type="date" id="sale-due-date" class="form-control form-control-sm" 
                           value="${new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]}">
                    <small class="text-muted d-block" style="font-size: 0.7rem;">Días calendario para el pago total.</small>
                </div>
              `;
              saleTypeSelect.parentNode.insertAdjacentHTML('beforeend', html);
          }
      } else if (container) container.remove();
  });

  renderSaleItems();

  // Funciones de carga
  
  async function loadProducts() {
    allProducts = await window.api.getProducts();

    productDatalist.innerHTML = "";

    allProducts.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = `${p.name} (${p.code}) - Stock ${p.stock}`;
      opt.dataset.id = p.id;
      opt.dataset.price = p.sale_price;
      opt.dataset.stock = p.stock;
      productDatalist.appendChild(opt);
    });
  }

  async function loadClients() {
    const clients = await window.api.getClients();
    clientSelect.innerHTML = '<option value="">-- Sin cliente --</option>';
    allClients = await window.api.getClients(); // Almacenar todos los clientes globalmente
    clientsDatalist.innerHTML = ''; // Limpiar opciones previas

    const noClientOpt = document.createElement("option");
    noClientOpt.value = "-- Sin cliente --";
    noClientOpt.dataset.id = ""; // ID vacío para "Sin cliente"
    clientsDatalist.appendChild(noClientOpt);

    clients.forEach((c) => {
      // Poblar select oculto para compatibilidad
      const optSelect = document.createElement("option");
      optSelect.value = c.id;
      optSelect.textContent = `${c.name} (${c.id_card_or_nit})`;
      clientSelect.appendChild(optSelect);

      // Poblar datalist para la búsqueda interactiva
      const optDL = document.createElement("option");
      optDL.value = `${c.name} (${c.id_card_or_nit})`; 
      optDL.dataset.id = c.id; 
      clientsDatalist.appendChild(optDL);
    });

    // Poblar el datalist de búsqueda de clientes
    clientSearchDatalist.innerHTML = ""; // Limpiar opciones previas
    clients.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.name; // Mostrar el nombre del cliente en el datalist
      clientSearchDatalist.appendChild(opt);
    });
  }

  // Renderizar items
  
  function renderSaleItems() {
    saleItemsTbody.innerHTML = "";
    let total = 0;

    // Generador de opciones de precios
    function generatePriceOptions(item) {
      let options = '';
      const prices = [
        { label: 'Normal', value: item.sale_price },
        { label: 'Esp. 1', value: item.special_price },
        { label: 'Esp. 2', value: item.special_price_2 }
      ];

      prices.forEach(p => {
        if (p.value > 0) {
          // Compara precios con una pequeña tolerancia para evitar errores de punto flotante
          const isSelected = Math.abs(item.price - p.value) < 0.01;
          options += `<option value="${p.value}" ${isSelected ? 'selected' : ''}>${p.label}: ${formatCOP(p.value)}</option>`;
        }
      });
      return options;
    }

    saleItems.forEach((it, i) => {
      total += it.subtotal;
      const tr = document.createElement("tr");

      const isService = it.is_service || String(it.product_name).toLowerCase().startsWith('[servicio]');
      const isKgVariant = String(it.product_name).toLowerCase().includes("kg");

      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${it.product_code || '-'}</td>
        <td>${it.product_name}</td>
        <td><input type="text" class="form-control form-control-sm serial-input" data-i="${i}" placeholder="Escribir serial..." value="${it.serial_number || ''}"></td>
        <td>
          ${!isService && isKgVariant 
            ? `<input type="number" min="0.1" step="0.1" value="${it.quantity}" data-i="${i}" class="form-control form-control-sm qty-input">`
            : it.quantity}
        </td>
        <td>
          ${isService 
            ? formatCOP(it.price) 
            : `<select class="form-select form-select-sm price-selector" data-i="${i}">${generatePriceOptions(it)}</select>`
          }
        </td>
        <td>${formatCOP(it.price * it.quantity)}</td>
        <td><button class="btn btn-sm btn-danger remove" data-i="${i}">Eliminar</button></td>
      `;

      saleItemsTbody.appendChild(tr);

      // Si es variante por kilos, escuchar cambios de cantidad
      if (isKgVariant) {
        const qtyEl = tr.querySelector(".qty-input");
        if (qtyEl) {
          qtyEl.addEventListener("input", (e) => {
            const newQty = parseFloat(e.target.value);
            if (!isNaN(newQty) && newQty > 0) {
              saleItems[i].quantity = newQty;
              saleItems[i].subtotal = saleItems[i].price * newQty;
              renderSaleItems();
            }
          });
        }
      }
    });

    totalDiv.textContent = `TOTAL: ${formatCOP(total)}`;
    saleItemsTbody
      .querySelectorAll(".remove")
      .forEach((b) =>
        b.addEventListener("click", (e) => {
          const i = Number(e.target.dataset.i);
          saleItems.splice(i, 1);
          renderSaleItems();
        })
      );
    
    // Guardar carrito en sessionStorage cada vez que se renderiza
    saveCart();
  }

  // Delegación de eventos para el cambio de precios
  saleItemsTbody.addEventListener('change', (e) => {
    if (e.target.classList.contains('price-selector')) {
      const index = Number(e.target.dataset.i);
      const newPrice = parseFloat(e.target.value);
      if (!isNaN(newPrice) && saleItems[index]) {
        saleItems[index].price = newPrice;
        saleItems[index].subtotal = newPrice * saleItems[index].quantity;
        renderSaleItems(); // Re-renderizar para actualizar subtotal y total
      }
    }
  });

  // Listener para capturar el número de serial en tiempo real
  saleItemsTbody.addEventListener('input', (e) => {
    if (e.target.classList.contains('serial-input')) {
      const index = Number(e.target.dataset.i);
      if (saleItems[index]) {
        saleItems[index].serial_number = e.target.value.trim();
        saveCart();
      }
    }
  });

  // -----------------------------
  // Agregar producto manual (formulario)
  // -----------------------------
  saleForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectedProductText = productInput.value;
    const selectedOption = Array.from(productDatalist.options).find(
      (opt) => opt.value === selectedProductText
    );

    if (!selectedOption) {
      Swal.fire('Atención', "Ítem no válido. Selecciona uno de la lista.", 'warning');
      return;
    }

    const itemId = Number(selectedOption.dataset.id);
    const qty = Number(qtyInput.value) || 1;

    const prod = allProducts.find((p) => p.id === itemId);

    if (!prod) {
      Swal.fire('Error', "Producto no encontrado", 'error');
      return;
    }
    
    // Si tiene variantes, mostrar modal de selección
    if (prod.variants && prod.variants.length > 0) {
      showVariantSelectionModal(prod, qty);
      productInput.value = "";
      qtyInput.value = "1";
      return;
    }

    if (prod.stock < qty) {
      Swal.fire('Error', "Stock insuficiente", 'error');
      return;
    }
    if (prod.stock <= prod.min_stock) {
      Swal.fire('Advertencia', `El producto '${prod.name}' está en stock mínimo (${prod.stock} unidades).`, 'warning');
    }

    addItemToSale(prod, qty, null);

    productInput.value = "";
    qtyInput.value = "1";
    productInput.focus();
  });

  // Lector de código (campo visible)
  
  if (barcodeInput) {
    barcodeInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const code = barcodeInput.value.trim();
        if (!code) return;

        const prod = allProducts.find((p) => String(p.code) === String(code));
        if (!prod) {
          const result = await Swal.fire({
            title: 'Producto no encontrado',
            text: `El código "${code}" no existe. ¿Deseas registrarlo?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, registrar',
            cancelButtonText: 'Cancelar'
          });

          if (result.isConfirmed) {
            localStorage.setItem("newProductCode", code);
            window.location.href = "products.html";
            return;
          } else {
            barcodeInput.value = "";
            return;
          }
        }

        showPreviewModal(prod);
        barcodeInput.value = "";
      }
    });
  }

  // Modal de vista previa (al escanear)
  
  function showPreviewModal(prod) {
    const hasImage = prod.image_base64 && prod.image_base64.length > 10;
    const imageHtml = hasImage ? `<img src="${prod.image_base64}" style="max-width:120px; display:block; margin-bottom:8px;">` : `<div class="no-image-placeholder">Sin imagen</div>`;

    const variantOptionsHtml = (prod.variants && prod.variants.length > 0) ? `
      <label class="form-label">Variante</label>
      <select id="preview-variant" class="form-select mb-2">
        <option value="">-- Selecciona variante (si aplica) --</option>
        <option value="base" data-price="${prod.sale_price}">Unidad base (${formatCOP(prod.sale_price)})</option>
        ${prod.variants.map(v => `<option value="${v.id}" data-price="${v.sale_price}" data-name="${v.name}">${v.name} (${formatCOP(v.sale_price)})</option>`).join('')}
      </select>
    ` : "";

    const modalHtml = `
      <div class="modal fade" id="previewModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Vista previa del producto</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div style="display:flex; gap:12px; align-items:flex-start;">
                <div>${imageHtml}</div>
                <div style="flex:1;">
                  <p><strong>Código:</strong> ${prod.code}</p>
                  <p><strong>Nombre:</strong> ${prod.name}</p>
                  <p><strong>Precio:</strong> ${formatCOP(prod.sale_price)}</p>
                  ${prod.special_price > 0 ? `<p><strong>Precio especial:</strong> ${formatCOP(prod.special_price)}</p>` : ''}
                  <p><strong>Stock:</strong> ${prod.stock}</p>
                  ${variantOptionsHtml}
                  <label class="form-label">Cantidad:</label>
                  <input type="number" id="preview-qty" class="form-control" value="1" min="0.1" step="0.1" max="${prod.stock}">
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-success" id="confirm-add-btn">Agregar a la venta</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existingModal = document.getElementById("previewModal");
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const modal = new bootstrap.Modal(document.getElementById("previewModal"));
    modal.show();

    document.getElementById("confirm-add-btn").addEventListener("click", () => {
      const qty = Number(document.getElementById("preview-qty").value) || 1;

      const variantSelect = document.getElementById("preview-variant");
      let selectedVariant = null;
      if (variantSelect && variantSelect.value && variantSelect.value !== "base") {
        const variantId = Number(variantSelect.value);
        selectedVariant = prod.variants.find(v => v.id === variantId);
      } else if (variantSelect && variantSelect.value === "base") {
        selectedVariant = null;
      }

      if (prod.stock < qty) {
        Swal.fire('Error', "Stock insuficiente", 'error');
        return;
      }

      addItemToSale(prod, qty, selectedVariant);
      modal.hide();
    });
  }

  // Reutilizable: agregar item a la venta
  
  function addItemToSale(prod, qty, variant) {
    const source = variant || prod; // La fuente de precios es la variante si existe, si no, el producto.
    let itemPrice = source.sale_price;
    let itemName = variant ? `${prod.name} (${variant.name})` : prod.name;
    let variantId = variant ? variant.id : null;

    const existingItemIndex = saleItems.findIndex(i => 
      i.product_id === prod.id && i.variant_id === variantId
    );

    if (existingItemIndex !== -1) {
      saleItems[existingItemIndex].quantity += qty;
      saleItems[existingItemIndex].subtotal += (itemPrice * qty);
    } else {
      saleItems.push({
        product_id: prod.id,
        product_code: prod.code,
        product_name: itemName,
        serial_number: '', // Inicializar vacío
        quantity: qty,
        price: itemPrice, // Precio actual, por defecto el normal
        sale_price: source.sale_price || 0,
        special_price: source.special_price || 0,
        special_price_2: source.special_price_2 || 0,
        subtotal: itemPrice * qty,
        variant_id: variantId,
      });
    }

    renderSaleItems();
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
              <button type="button" class="btn btn-primary" id="confirm-variant-btn">Agregar a Venta</button>
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

      addItemToSale(prod, qty, selectedVariant);
      modal.hide();
    });
  }

  // Modal de pago (nuevo)
 
  async function showPaymentModal(totalAmount, clientId, saleType) {
    // Verificar si hay abonos previos (si viene de un servicio)
    let serviceId = null;
    let previousPaymentsTotal = 0;
    
    // Buscar service_id en los items
    const serviceItem = saleItems.find(i => i.service_id);
    if (serviceItem) {
        serviceId = serviceItem.service_id;
        const payments = await window.api.getServicePayments(serviceId);
        previousPaymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
    }

    const remainingToPay = Math.max(0, totalAmount - previousPaymentsTotal);

    const modalHtml = `
      <div class="modal fade" id="paymentModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Registrar Pago</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p><strong>Total:</strong> ${formatCOP(totalAmount)}</p>
              ${previousPaymentsTotal > 0 ? `
                  <p class="text-success"><strong>Abonado previamente:</strong> ${formatCOP(previousPaymentsTotal)}</p>
                  <p class="text-danger"><strong>Restante a pagar:</strong> ${formatCOP(remainingToPay)}</p>
              ` : ''}
              <div class="mb-2">
                <label>Efectivo recibido</label>
                <input type="number" id="cashReceived" class="form-control" value="0" min="0">
              </div>
              <div class="mb-2">
                <label>Transferencia</label>
                <input type="number" id="transferAmount" class="form-control" value="0" min="0">
              </div>
              <div class="mb-2" id="bankReferenceContainer" style="display:none;">
                <label>Banco / Referencia</label>
                <input type="text" id="transferReference" class="form-control" placeholder="Ej: Bancolombia, Nequi...">
              </div>
              <div id="changeInfo" class="mt-2 fw-bold text-success"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-primary" id="confirmPaymentBtn">Confirmar Pago</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById("paymentModal");
    if (existing) existing.remove();
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const modal = new bootstrap.Modal(document.getElementById("paymentModal"));
    modal.show();

    const cashInput = document.getElementById("cashReceived");
    const transferInput = document.getElementById("transferAmount");
    const transferRefInput = document.getElementById("transferReference");
    const changeInfo = document.getElementById("changeInfo");

    function updateChange() {
      const cash = parseFloat(cashInput.value) || 0;
      const transfer = parseFloat(transferInput.value) || 0;
      const totalPaid = cash + transfer;
      const change = totalPaid - remainingToPay; // Calcular cambio sobre lo que falta
      if (change >= 0) {
        changeInfo.textContent = `Cambio a devolver: ${formatCOP(change)}`;
      } else {
        changeInfo.textContent = `Falta: ${formatCOP(-change)}`;
      }
      
      // Mostrar campo de banco si hay transferencia
      document.getElementById("bankReferenceContainer").style.display = transfer > 0 ? "block" : "none";
    }
    cashInput.addEventListener("input", updateChange);
    transferInput.addEventListener("input", updateChange);
    updateChange();

    document.getElementById("confirmPaymentBtn").addEventListener("click", async () => {
      const cash = parseFloat(cashInput.value) || 0;
      const transfer = parseFloat(transferInput.value) || 0;
      const transferRef = document.getElementById("transferReference").value.trim();
      const totalPaid = cash + transfer;

      if (totalPaid < remainingToPay && saleType !== "credit") {
        Swal.fire('Error', "El monto pagado es insuficiente.", 'error');
        return;
      }

      const outstandingBalance = saleType === "credit" ? remainingToPay : Math.max(0, remainingToPay - totalPaid);
      const paidAmount = saleType === "credit" ? 0 : totalPaid;
      const notes = saleNotesInput.value.trim();

      const saleData = {
        client_id: clientId,
        items: saleItems,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        outstanding_balance: outstandingBalance,
        sale_type: saleType,
        cash_payment: cash,
        transfer_payment: transfer,
        transfer_reference: transferRef,
        service_id: serviceId, // Enviar ID para migrar abonos
        notes: notes
      };

      const res = await window.api.createSale(saleData);
      if (!res.success) {
        Swal.fire('Error', res.message, 'error');
        return;
      }

      const printResult = await Swal.fire({
          title: 'Venta Exitosa',
          text: "¿Desea imprimir una copia de la factura?",
          icon: 'success',
          showCancelButton: true,
          confirmButtonText: '<i class="fa fa-print me-1"></i> Sí, imprimir',
          cancelButtonText: 'No, cerrar',
          confirmButtonColor: '#198754'
      });

      if (printResult.isConfirmed) {
          handlePrintSale(res.id);
      }
      cancelEdit(); 
      modal.hide();
      await loadSales();
      await loadProducts();
      await loadCredits();
    });
  }

  // Finalizar venta (ajustado)
 
  finalizeBtn.addEventListener("click", async () => {
      if (editingSaleId) {
          await handleUpdateSale();
      } else {
          await handleCreateSale();
      }
  });

  async function handleCreateSale() {
      if (saleItems.length === 0) {
          Swal.fire('Atención', "No hay items en la venta.", 'warning');
          return;
      }
      const clientId = clientHiddenIdInput.value ? Number(clientHiddenIdInput.value) : null;
      const saleType = saleTypeSelect.value;
      const totalAmount = saleItems.reduce((sum, item) => sum + item.subtotal, 0);
      const notes = saleNotesInput.value.trim();
      const dueDate = document.getElementById('sale-due-date')?.value || null;

      // Verificar si hay abonos previos (si viene de un servicio)
      let serviceId = null;
      let previousPaymentsTotal = 0;
      
      // Buscar service_id en los items
      const serviceItem = saleItems.find(i => i.service_id);
      if (serviceItem) {
          serviceId = serviceItem.service_id;
          const payments = await window.api.getServicePayments(serviceId);
          previousPaymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
      }

      if (saleType === 'credit') {
          if (!clientId) {
              Swal.fire('Atención', "Para una venta a crédito, debes seleccionar un cliente.", 'warning');
              return;
          }
          
          const remainingToPay = Math.max(0, totalAmount - previousPaymentsTotal);

          const result = await Swal.fire({
              title: 'Confirmar Crédito',
              html: `¿Confirmar venta a crédito?<br><br>
                     Total: <strong>${formatCOP(totalAmount)}</strong><br>
                     Saldo pendiente: <strong>${formatCOP(remainingToPay)}</strong><br>
                     Vencimiento: <strong>${dueDate || 'No definida'}</strong>`,
              icon: 'question',
              showCancelButton: true,
              confirmButtonText: 'Sí, confirmar',
              cancelButtonText: 'Cancelar'
          });

          if (result.isConfirmed) {
              const saleData = {
                  client_id: clientId,
                  items: saleItems,
                  total_amount: totalAmount,
                  paid_amount: previousPaymentsTotal,
                  outstanding_balance: remainingToPay,
                  sale_type: saleType,
                  cash_payment: 0,
                  transfer_payment: 0,
                  transfer_reference: null,
                  service_id: serviceId,
                  due_date: dueDate,
                  notes: notes
              };
              const res = await window.api.createSale(saleData);
              if (!res.success) {
                  Swal.fire('Error', res.message, 'error');
                  return;
              }

              const printResult = await Swal.fire({
                  title: 'Venta Registrada',
                  text: "¿Desea imprimir una copia de la factura?",
                  icon: 'success',
                  showCancelButton: true,
                  confirmButtonText: '<i class="fa fa-print me-1"></i> Sí, imprimir',
                  cancelButtonText: 'No, cerrar',
                  confirmButtonColor: '#198754'
              });

              if (printResult.isConfirmed) {
                  handlePrintSale(res.id);
              }

              cancelEdit();
              await loadSales();
              await loadProducts();
              await loadCredits();
          }
          return;
      }
      await showPaymentModal(totalAmount, clientId, saleType);
  }

  async function handleUpdateSale() {
      if (!editingSaleId) return;

      const originalSale = await window.api.getSaleById(editingSaleId);
      const newTotalAmount = saleItems.reduce((sum, item) => sum + item.subtotal, 0);
      const difference = newTotalAmount - originalSale.total_amount;
      const notes = saleNotesInput.value.trim();
      const dueDate = document.getElementById('sale-due-date')?.value || null;

      let paymentAdjustment = null;

      if (Math.abs(difference) > 0.1 && saleTypeSelect.value !== 'credit') {
          if (difference > 0) {
              const paymentResult = await showDifferenceModal('pay', difference);
              if (!paymentResult) return;
              paymentAdjustment = {
                  amount: difference,
                  method: paymentResult.method,
                  reference: paymentResult.reference
              };
          } else {
              const refundResult = await showDifferenceModal('refund', Math.abs(difference));
              if (!refundResult) return;
              paymentAdjustment = {
                  amount: -Math.abs(difference),
                  method: refundResult.method,
                  reference: null
              };
          }
      }

      const updateData = {
          saleId: editingSaleId, // Se mantiene
          clientId: clientHiddenIdInput.value ? Number(clientHiddenIdInput.value) : null,
          items: saleItems,
          paymentAdjustment: paymentAdjustment,
            sale_type: saleTypeSelect.value, // Informamos el tipo de venta actual
            total_amount: newTotalAmount,   // Enviamos el nuevo total calculado
          userName: localStorage.getItem('user_name') || 'system',
          due_date: dueDate,
          notes: notes
      };

      const res = await window.api.updateSale(updateData);

      if (res.success) {
            const printResult = await Swal.fire({
                title: 'Cambios Guardados',
                text: "¿Desea imprimir la factura actualizada?",
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: '<i class="fa fa-print me-1"></i> Sí, imprimir',
                cancelButtonText: 'No, cerrar',
                confirmButtonColor: '#198754'
            });

            if (printResult.isConfirmed) {
                handlePrintSale(editingSaleId);
            }

          cancelEdit();
          await loadSales(false);
          await loadProducts();
          await loadCredits();
        } else {
            Swal.fire('Error', res.message, 'error');
      }
  }

  // Cargar ventas

  let currentOffset = 0;
  const SALES_LIMIT = 10;
  let loadMoreBtn;

  // Crear botón de "Cargar más"
  const btnContainer = document.createElement("div");
  btnContainer.className = "text-center mt-3 mb-3";
  loadMoreBtn = document.createElement("button");
  loadMoreBtn.className = "btn btn-secondary";
  loadMoreBtn.textContent = "Cargar más facturas";
  loadMoreBtn.style.display = "none";
  loadMoreBtn.addEventListener("click", () => loadSales(true));
  btnContainer.appendChild(loadMoreBtn);
  
  if (salesList && salesList.parentNode) {
    salesList.parentNode.insertBefore(btnContainer, salesList.nextSibling);
  }

  // Delegación de eventos para la lista de ventas (Eliminar, Exportar, Imprimir)
  salesList.addEventListener("click", async (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    if (target.classList.contains("delete-sale")) {
      const result = await Swal.fire({
          title: '¿Eliminar venta permanentemente?',
          text: "Esta acción borrará el registro de la base de datos y NO devolverá stock. Use esto solo para limpieza de datos antiguos.",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          confirmButtonText: 'Sí, eliminar'
      });
      if (!result.isConfirmed) return;

      await window.api.deleteSale(Number(target.dataset.id));
      await loadSales(false); // Recargar desde cero
      Swal.fire('Eliminada', 'La factura ha sido borrada del registro.', 'success');

    } else if (target.classList.contains("annul-sale")) {
      const result = await Swal.fire({
          title: '¿Anular factura?',
          text: "Esta acción marcará la factura como 'ANULADA', devolverá los productos al inventario y establecerá los montos en $0. Permanecerá en el historial para auditoría.",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#ffc107',
          confirmButtonText: 'Sí, anular',
          cancelButtonText: 'Cancelar'
      });
      if (!result.isConfirmed) return;

      const res = await window.api.annulSale(Number(target.dataset.id));
      if (res.success) {
        await loadSales(false); 
        Swal.fire('Anulada', res.message, 'success');
      } else {
        Swal.fire('Error', res.message, 'error');
      }

    } else if (target.classList.contains("view-invoice-detail")) {
      await handlePrintSale(Number(target.dataset.id), false);
    } else if (target.classList.contains("export-invoice")) {
      const id = Number(target.dataset.id);
      const result = await Swal.fire({
          title: 'Opciones de Exportación',
          text: "¿Incluir IVA 19% en la factura?",
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Sí, con IVA',
          cancelButtonText: 'No, sin IVA'
      });
      const withIva = result.isConfirmed;
      const res = await window.api.exportInvoicePDF(id, withIva);
      Swal.fire(res.success ? 'Éxito' : 'Error', res.message || JSON.stringify(res), res.success ? 'success' : 'error');
    } else if (target.classList.contains("print-sale")) {
      await handlePrintSale(Number(target.dataset.id));
    } else if (target.classList.contains("edit-sale")) {
        const saleId = Number(target.dataset.id);
        await handleEditSale(saleId);
    } else if (target.classList.contains("export-receipt")) {
        const saleId = Number(target.dataset.id);
        const currentUser = localStorage.getItem('user_name') || 'Usuario';
        
        // 1. Obtener datos actuales de la venta (para ver si ya tiene notas)
        const sale = await window.api.getSaleById(saleId);
        if (!sale) return;

        // 2. Mostrar modal para ingresar/editar observaciones
        const { value: observations } = await Swal.fire({
            title: 'Generar Recibo de Caja',
            input: 'textarea',
            inputLabel: 'Observaciones',
            inputValue: sale.notes || '', // Cargar notas existentes
            inputPlaceholder: 'Escriba aquí las observaciones del recibo...',
            showCancelButton: true,
            confirmButtonText: 'Guardar y Descargar',
            cancelButtonText: 'Cancelar'
        });

        if (observations !== undefined) { // Si el usuario no canceló
            const res = await window.api.exportSaleReceiptPDF(saleId, currentUser, observations);
            Swal.fire(res.success ? 'Éxito' : 'Error', res.message || (res.success ? "Recibo exportado" : "Error"), res.success ? 'success' : 'error');
        }
    }
  });

  async function handlePrintSale(id, showOptions = true) {
    const sale = await window.api.getSaleById(id);
    const items = await window.api.getSaleItems(id);
    const company = await window.api.getCompanySettings();
    const logoBase64 = await window.api.getCompanyLogo();
    const client = sale.client_id ? await window.api.getClientById(sale.client_id) : null;

    if (!sale || !items) {
      Swal.fire('Error', "No se encontró la información de la venta", 'error');
      return;
    }

    let printers = [];
    if (showOptions) {
      printers = await window.api.getPrinters();
      if (!printers || printers.length === 0) {
        Swal.fire('Error', "No se encontraron impresoras disponibles", 'error');
        return;
      }
    }

    const htmlContent = generateInvoiceHtml(sale, items, company, logoBase64, client, showOptions ? printers : null);
    await window.api.previewInvoice({ content: htmlContent });
  }

  async function loadSales(append = false) {
    if (!append) {
      currentOffset = 0;
      salesList.innerHTML = "";
      loadMoreBtn.style.display = "none";
    }
    const searchTerm = document.getElementById('search-sale-history')?.value || "";
    const statusFilter = document.getElementById("sales-filter-status")?.value || 'active';
    // If there's a search term, fetch all matching results (limit -1, offset 0)
    // Otherwise, use pagination (SALES_LIMIT, currentOffset)
    const sales = await window.api.getSales(searchTerm ? -1 : SALES_LIMIT, searchTerm ? 0 : currentOffset, null, searchTerm, statusFilter);
    
    if (!sales || sales.length === 0) {
      if (!append) salesList.innerHTML = '<div class="alert alert-secondary">No hay ventas</div>';
      else {
        Swal.fire('Info', "No hay más facturas.", 'info');
        loadMoreBtn.style.display = "none";
      }
      return;
    }

    const html = sales.map((s) => {
      const isAnnulled = s.status === 'annulled';
      const cardClass = isAnnulled ? 'card mb-2 p-2 bg-light text-muted border-danger' : 'card mb-2 p-2';
      const statusBadge = isAnnulled ? '<span class="badge bg-danger ms-2">ANULADA</span>' : '';
      const itemsHtml = (s.items || []).map(it => `<li>${it.product_name} x ${it.quantity} = ${formatCOP(it.subtotal)}</li>`).join("");
      return `
        <div class="${cardClass}">
          <div>
            <strong>${s.invoice_number || `FACT-${String(s.id).padStart(3,"0")}`}</strong> ${statusBadge}
            — ${s.sale_date} — ${formatCOP(s.total_amount)}
            <div class="float-end">
              <div class="dropdown">
                <button class="btn btn-sm btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                  Acciones
                </button>
                <ul class="dropdown-menu">
                  <li><button class="dropdown-item view-invoice-detail" data-id="${s.id}"><i class="fa fa-eye me-2 text-info"></i> Ver Detalle</button></li>
                  <li><button class="dropdown-item export-invoice" data-id="${s.id}"><i class="fa fa-file-pdf me-2 text-primary"></i> Descargar Factura</button></li>
                  <li><button class="dropdown-item print-sale" data-id="${s.id}"><i class="fa fa-print me-2 text-success"></i> Imprimir Factura</button></li>
                  <li><button class="dropdown-item export-receipt" data-id="${s.id}"><i class="fa fa-file-invoice-dollar me-2 text-info"></i> Recibo de Caja</button></li>
                  <li><hr class="dropdown-divider"></li>
                  <li><button class="dropdown-item edit-sale" data-id="${s.id}" ${isAnnulled ? 'disabled' : ''}><i class="fa fa-edit me-2 text-warning"></i> Editar</button></li>
                  <li><button class="dropdown-item annul-sale" data-id="${s.id}" ${isAnnulled ? 'disabled' : ''}><i class="fa fa-ban me-2 text-warning"></i> Anular Factura</button></li>
                  <li><button class="dropdown-item delete-sale" data-id="${s.id}"><i class="fa fa-trash me-2 text-danger"></i> Eliminar (Sin devolver stock)</button></li>
                </ul>
              </div>
            </div>
          </div>
          <ul>${itemsHtml}</ul>
        </div>
      `;
    }).join("");

    if (append) {
      salesList.insertAdjacentHTML('beforeend', html);
    } else {
      salesList.innerHTML = html;
    }

    // Restricción de roles
    const role = localStorage.getItem('user_role');
    if (role !== 'admin') {
      salesList.querySelectorAll('.delete-sale').forEach(btn => btn.closest('li').remove());
      salesList.querySelectorAll('.edit-sale').forEach(btn => btn.closest('li').remove());
      salesList.querySelectorAll('.annul-sale').forEach(btn => btn.closest('li').remove());
    }

    currentOffset += sales.length;

    // Mostrar botón solo si trajimos el límite completo (significa que puede haber más)
    if (sales.length === SALES_LIMIT) {
      loadMoreBtn.style.display = "inline-block";
    } else {
      loadMoreBtn.style.display = "none";
    }
  }

    async function handleEditSale(saleId) {
        const sale = await window.api.getSaleById(saleId);
        const items = await window.api.getSaleItems(saleId);
        if (!sale || !items) {
            Swal.fire('Error', "No se pudo cargar la venta para editar.", 'error');
            return;
        }

        if (sale.sale_type === 'paid' || sale.paid_amount > 0) {
            const result = await Swal.fire({
                title: 'Advertencia',
                text: "Esta factura ya tiene pagos registrados. Editarla modificará el inventario y podría requerir ajustes de caja (devoluciones o cobros adicionales).\n\n¿Está seguro de que desea continuar?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: 'Sí, editar'
            });
            if (!result.isConfirmed) {
                return;
            }
        }

        editingSaleId = saleId;
        clientSelect.value = sale.client_id || "";
        const client = allClients.find(c => c.id === sale.client_id); // Buscar el cliente por ID
        clientInput.value = client ? `${client.name} (${client.id_card_or_nit})` : "-- Sin cliente --"; // Mostrar el nombre en el input visible
        clientHiddenIdInput.value = sale.client_id || ""; // Establecer el ID en el campo oculto
        saleNotesInput.value = sale.notes || "";
        saleTypeSelect.value = sale.sale_type;
        saleTypeSelect.dispatchEvent(new Event('change'));
        if (sale.due_date) {
            const dueDateInput = document.getElementById('sale-due-date');
            if (dueDateInput) dueDateInput.value = sale.due_date;
        }
        
        const detailedItems = [];
        for (const item of items) {
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
        saleItems = detailedItems;

        renderSaleItems();

        finalizeBtn.textContent = "Guardar Cambios";
        finalizeBtn.classList.remove('btn-primary');
        finalizeBtn.classList.add('btn-warning');

        const cancelBtnHtml = `<button type="button" id="cancel-edit-btn" class="btn btn-secondary ms-2">Cancelar Edición</button>`;
        if(!document.getElementById('cancel-edit-btn')) finalizeBtn.insertAdjacentHTML('afterend', cancelBtnHtml);
        document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);

        window.scrollTo(0, 0);
        productInput.focus();

        // Activar la pestaña de Venta Rápida
        const quickSaleTab = document.getElementById('quick-sale-tab');
        if (quickSaleTab) quickSaleTab.click();
    }

    // -----------------------------
    // Generar HTML de factura
    // -----------------------------
    function generateInvoiceHtml(sale, items, company, logoBase64, client, printers) {
      const showPrintPanel = printers && printers.length > 0;
      const isAnnulled = sale.status === 'annulled';

      const printPanelHtml = showPrintPanel ? `
            <div class="print-options-panel">
              <label>Selecciona impresora:</label>
              <select id="printerSelect">
                ${printers.map(p => `<option value="${p.name}" ${p.isDefault ? "selected" : ""}>${p.name}${p.isDefault ? " (Predeterminada)" : ""}</option>`).join("")}
              </select>
              <label>Tamaño de papel:</label>
              <select id="paperSizeSelect">
                <option value="A4">A4</option>
                <option value="80mm" selected>80mm (Ticket)</option>
                <option value="57mm">57mm (Mini Ticket)</option>
                <option value="Letter">Carta</option>
                <option value="Legal">Oficio</option>
              </select>
              <label><input type="checkbox" id="includeIva"> Incluir IVA 19%</label>
              <button id="printButton">Imprimir</button>
              <button id="closePreview">Cerrar</button>
            </div>
      ` : '';

      const scriptHtml = showPrintPanel ? `
              <script>
                function formatCOP(value) { return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value); }
                let totalBase = ${Number(sale.total_amount || 0)};
                const currentPago = ${Number(sale.cash_payment || 0)} + ${Number(sale.transfer_payment || 0)};
                const totalAbonado = ${Number(sale.paid_amount || 0)};
                function updateTotals() {
                  const includeIvaEl = document.getElementById("includeIva");
                  const includeIva = includeIvaEl ? includeIvaEl.checked : false;
                  let iva = 0; let total = totalBase;
                  const extraTotalsBody = document.getElementById("extraTotals");
                  if (includeIva) {
                    iva = Math.round(totalBase * 0.19); total = totalBase + iva;
                    extraTotalsBody.innerHTML = 
                        '<tr><td>Total bruto:</td><td>' + formatCOP(totalBase) + '</td></tr>' +
                        '<tr><td>IVA (19%):</td><td>' + formatCOP(iva) + '</td></tr>' +
                        '<tr class="total-row"><td>Total neto:</td><td>' + formatCOP(total) + '</td></tr>';
                  } else {
                    extraTotalsBody.innerHTML = '<tr class="total-row"><td>TOTAL:</td><td>' + formatCOP(totalBase) + '</td></tr>';
                  }
                  const cambio = totalAbonado - total;
                  const cambioContainer = document.getElementById("cambioContainer");
                  if (cambio > 0) {
                    cambioContainer.innerHTML = '<tr><td>Cambio:</td><td>' + formatCOP(cambio) + '</td></tr>';
                  } else {
                    cambioContainer.innerHTML = "";
                  }
                }
                document.addEventListener("DOMContentLoaded", () => { updateTotals(); });
                const ivaCheck = document.getElementById("includeIva");
                if (ivaCheck) ivaCheck.addEventListener("change", updateTotals);
                const prntBtn = document.getElementById("printButton");
                if (prntBtn) prntBtn.addEventListener("click", () => { updateTotals(); window.print(); });
                const clsBtn = document.getElementById("closePreview");
                if (clsBtn) clsBtn.addEventListener("click", () => window.close());
              </script>
      ` : '';

      return `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              @page { margin: 6mm; } /* Margen de impresión */
              html, body { margin: 0; padding: 0; }
              body { 
                font-family: 'Arial', sans-serif; 
                font-size: 10px; /* Tamaño de fuente base */
                color: #0a0a0aff;
              }
              .invoice-box {
                width: 95%;
                box-sizing: border-box;
                margin: 0 auto; /* Centrar el contenido */
                position: relative; /* Ancla para la marca de agua absoluta */
                overflow: hidden; /* Evita que la rotación genere páginas extra */
              }
              .header, .footer {
                text-align: center;
                margin-bottom: 3mm;
              }
              .header h2 {
                margin: 2;
                font-size: 14px; /* Aumentado */
                font-weight: bold;
              }
              .header p {
                margin: 4px 0;
                font-size: 10px; /* Aumentado */
                font-weight: bold; /* Añadido */
              }
              .info {
                margin-bottom: 4mm;
                border-top: 4px dashed #ccc;
                border-bottom: 4px dashed #ccc;
                padding: 4mm 0;
              }
              .info p {
                margin: 4px ;
                font-size: 12px;
              }
              .items-table {
                width: 95%;
                border-collapse: collapse;
                margin-bottom: 5mm;
              }
              .items-table th {
                border-bottom: 2px solid #000;
                padding: 2mm 0;
                text-align: left;
                font-weight: bold;
                font-size: 10px;
              }
              .items-table td {
                padding: 0.8mm 0;
                border-bottom: 1px dotted #ccc;
                font-size: 11px;
                vertical-align: middle; /* Alinear al centro */
              }
              .items-table .col-align-right {
                text-align: right;
                vertical-align: middle; /* Alinear al centro */
              }
              .items-table .col-align-center {
                text-align: center;
                vertical-align: middle; /* Alinear al centro */
              }
              .totals-section, .payment-info-section {
                  margin-top: 4mm;
              }
              .totals-section table, .payment-info-section table {
                  width: 95%;
                  font-size: 11px;
              }
              .totals-section td:first-child, .payment-info-section td:first-child {
                  text-align: left;
              }
              .totals-section td:last-child, .payment-info-section td:last-child {
                  text-align: right;
              }
              .total-row td {
                font-weight: bold;
                font-size: 12px;
                padding-top: 2mm;
                border-top: 2px solid #000;
              }
              .footer {
                margin-top: 8mm;
                border-top: 3px solid #000;
                padding-top: 4mm;
                font-size: 11px;
              }
              .print-options-panel {
                position: fixed; bottom: 30px; right: 25px; background-color: white; padding: 20px;
                border: 4px solid #ccc; border-radius: 15px; box-shadow: 0 8px 12px rgba(0,0,0,0.1);
                display: flex; flex-direction: column; gap: 15px; z-index: 9999;
              }
              .watermark {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(-30deg);
                font-size: 60pt;
                color: rgba(255, 0, 0, 0.15);
                font-weight: bold;
                z-index: 9998;
                pointer-events: none;
                white-space: nowrap;
                border: 12px solid rgba(255, 0, 0, 0.15);
                padding: 15px 40px;
                border-radius: 20px;
                text-transform: uppercase;
                font-family: 'Arial Black', sans-serif;
              }
              @media print {
                .print-options-panel { display: none; }
                .watermark { -webkit-print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            ${printPanelHtml}
            ${scriptHtml}

            <div class="invoice-box">
              ${isAnnulled ? '<div class="watermark">ANULADA</div>' : ''}
              <div class="header">
                ${logoBase64 ? `<img src="${logoBase64}" style="max-height:120px; margin-bottom: 10px; filter: brightness(0.8) contrast(1.5);"><br>` : ""}
                <h2><strong>${company.company_name || ""}</strong></h2>
                <p>NIT: ${company.company_id_card_or_nit || ""}</p>
                <p>${company.company_address || ""}</p>
                <p>Tel: ${company.company_phone || ""}</p>
                <p>Correo: ${company.company_email || ""}</p>
              </div>

              <div class="info">
                <p><strong>Factura:</strong> ${sale.invoice_number || `FACT-${sale.id}`}</p>
                <p><strong>Fecha:</strong> ${sale.sale_date}</p>
                ${client ? `
                <p><strong>Cliente:</strong> ${client.name}</p>
                <p><strong>NIT/Cédula:</strong> ${client.id_card_or_nit}</p>
                <p><strong>Dirección:</strong> ${client.address}</p>
                <p><strong>Teléfono:</strong> ${client.phone}</p>
                ` : `
                <p><strong>Cliente:</strong> Consumidor final</p>
                `}
              </div>

              <table class="items-table">
                <colgroup>
                  <col style="width: 45%;">
                  <col style="width: 15%;">
                  <col style="width: 20%;">
                  <col style="width: 20%;">
                </colgroup>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th class="col-align-center">Cant</th>
                    <th class="col-align-right">Precio</th>
                    <th class="col-align-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(it => `
                    <tr>
                      <td style="word-break: break-word;">
                        ${it.product_name}
                        ${it.serial_number ? `<br><small style="color: #000;">Serial: ${it.serial_number}</small>` : ''}
                      </td>
                      <td class="col-align-center">${it.quantity}</td>
                      <td class="col-align-right">${formatCOP(it.price)}</td>
                      <td class="col-align-right">${formatCOP(it.subtotal)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>

              <div class="totals-section">
                <table style="width: 95%;">
                    <tbody id="extraTotals">
                        <tr class="total-row">
                            <td>TOTAL:</td>
                            <td>${formatCOP(sale.total_amount)}</td>
                        </tr>
                    </tbody>
                </table>
              </div>

              <div class="payment-info-section">
                <table style="width: 95%;">
                    <tbody>
                    ${sale.sale_type === "credit" ? `
                        <tr>
                            <td><strong>Forma de pago:</strong></td>
                            <td>
                                ${sale.paid_amount > 0 ? `Abonos previos: ${formatCOP(sale.paid_amount)}` : `Venta a crédito`}
                            </td>
                        </tr>
                        ${sale.outstanding_balance > 0 ? `
                            <tr>
                                <td><strong>Saldo pendiente a crédito:</strong></td>
                                <td>${formatCOP(sale.outstanding_balance)}</td>
                            </tr>
                        ` : ''}
                        ${sale.due_date ? `<tr><td><strong>Vencimiento:</strong></td><td>${sale.due_date}</td></tr>` : ""}
                    ` : `
                        <tr>
                            <td><strong>Forma de pago:</strong></td>
                            <td>${
                                sale.cash_payment > 0 && sale.transfer_payment > 0 ? "Mixto" : 
                                sale.cash_payment > 0 ? "Efectivo" : 
                                sale.transfer_payment > 0 ? "Transferencia" : 
                                ((sale.paid_amount || 0) > 0 ? "Abono / Anticipado" : "Otros")
                            }</td>
                        </tr>
                        ${sale.cash_payment > 0 ? `<tr><td>Efectivo:</td><td>${formatCOP(sale.cash_payment)}</td></tr>` : ""}
                        ${sale.transfer_payment > 0 ? `<tr><td>Transferencia:</td><td>${formatCOP(sale.transfer_payment)}</td></tr>` : ""}
                        ${((sale.paid_amount || 0) - ((sale.cash_payment || 0) + (sale.transfer_payment || 0))) > 0 ? `<tr><td>Abonos previos:</td><td>${formatCOP(sale.paid_amount - (sale.cash_payment + sale.transfer_payment))}</td></tr>` : ""}
                    `}
                    </tbody>
                </table>
                <table style="width: 95%;"><tbody id="cambioContainer"></tbody></table>
              </div>

              ${sale.notes ? `
              <div class="notes-section" style="margin-top: 6mm; border-top: 1px solid #ccc; padding-top: 3mm;">
                <p style="font-size: 9px; font-weight: bold; margin-bottom: 2px; color: #444;">NOTAS / OBSERVACIONES:</p>
                <p style="font-size: 9px; margin: 0; text-align: justify; line-height: 1.2;">${sale.notes}</p>
              </div>
              ` : ''}

              <div class="footer">
                <p>Gracias por su compra</p>
              </div>
            </div>
          </body>
        </html>
      `;
    }

  // Cargar créditos

  async function loadCredits(append = false) {
    if (!append) {
      currentCreditOffset = 0;
      creditsList.innerHTML = "";
    }

    const searchTerm = creditSearchInput.value.trim();
    const showPaid = document.getElementById('show-paid-credits')?.checked || false;

    // Inyectar controles de filtro y botón de carga si no existen
    if (!document.getElementById('credit-filter-container')) {
        const filterHtml = `
            <div id="credit-filter-container" class="mb-3 d-flex align-items-center gap-2">
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="show-paid-credits">
                    <label class="form-check-label" for="show-paid-credits">Ver créditos pagados</label>
                </div>
            </div>
        `;
        creditsList.parentNode.insertBefore(document.createRange().createContextualFragment(filterHtml), creditsList);
        document.getElementById('show-paid-credits').addEventListener('change', () => loadCredits(false));

        // Crear contenedor del botón "Cargar más"
        const btnContainer = document.createElement("div");
        btnContainer.className = "text-center mt-3 mb-3";
        loadMoreCreditsBtn = document.createElement("button");
        loadMoreCreditsBtn.className = "btn btn-outline-secondary btn-sm";
        loadMoreCreditsBtn.textContent = "Cargar más...";
        loadMoreCreditsBtn.style.display = "none";
        loadMoreCreditsBtn.addEventListener("click", () => loadCredits(true));
        btnContainer.appendChild(loadMoreCreditsBtn);
        creditsList.parentNode.insertBefore(btnContainer, creditsList.nextSibling);

        // Delegación de eventos para los botones de detalle
        creditsList.addEventListener("click", (e) => {
            const btn = e.target.closest('.view-credit-details');
            if (btn) showCreditDetails(Number(btn.dataset.id));
        });
    }

    const credits = await window.api.getCredits(searchTerm, !showPaid, CREDITS_LIMIT, currentCreditOffset);

    if (!credits || credits.length === 0) {
      if (!append) creditsList.innerHTML = `<div class="alert alert-secondary">No hay créditos ${showPaid ? 'pagados' : 'pendientes'}.</div>`;
      if (loadMoreCreditsBtn) loadMoreCreditsBtn.style.display = "none";
      return;
    }

    const html = credits.map(c => {
      const isPaid = c.outstanding_balance <= 0;

      let daysInfo = "";
      if (c.due_date && !isPaid) {
          const start = new Date(c.sale_date.split(' ')[0]);
          const end = new Date(c.due_date);
          const diffTime = end - start;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          daysInfo = `<div class="small text-muted mb-1">
                        Vence: <span class="fw-bold">${c.due_date}</span> 
                        (${diffDays > 0 ? diffDays : 0} días plazo)
                      </div>`;
      }

      return `
        <div class="card mb-2 p-2 credit-card" ${isPaid ? 'style="border-left: 5px solid #198754"' : ''}>
        <div>
          <strong>Factura #${c.invoice_number || c.id}</strong> — Cliente: ${c.client_name}
          ${daysInfo}
        </div>
        <div>
          Total: ${formatCOP(c.total_amount)} | Abonos: ${formatCOP(c.paid_amount)} | Saldo: <span class="fw-bold ${isPaid ? 'text-success' : 'text-danger'}">${formatCOP(c.outstanding_balance)}</span>
        </div>
        <div class="mt-2">
          <button class="btn btn-sm btn-info view-credit-details" data-id="${c.id}">Ver Detalle</button>
        </div>
        </div>
      `;
    }).join("");

    if (append) {
      creditsList.insertAdjacentHTML('beforeend', html);
    } else {
      creditsList.innerHTML = html;
    }

    currentCreditOffset += credits.length;
    if (loadMoreCreditsBtn) {
        loadMoreCreditsBtn.style.display = (credits.length === CREDITS_LIMIT) ? "inline-block" : "none";
    }
  }

 
  // Buscar créditos
  let creditSearchTimeout;
  creditSearchInput.addEventListener('input', () => {
    clearTimeout(creditSearchTimeout);
    creditSearchTimeout = setTimeout(() => loadCredits(false), 400);
  });

  creditSearchBtn.addEventListener("click", (e) => {
    e.preventDefault();
    loadCredits(false);
  });

  function showDifferenceModal(type, amount) {
      return new Promise((resolve) => {
          const title = type === 'pay' ? 'Pagar Diferencia' : 'Confirmar Devolución';
          const actionButtonText = type === 'pay' ? 'Confirmar Pago' : 'Confirmar Devolución';
          const amountText = type === 'pay' ? `Se debe pagar una diferencia de <strong>${formatCOP(amount)}</strong>.` : `Se debe devolver al cliente <strong>${formatCOP(amount)}</strong>.`;

          const modalHtml = `
          <div class="modal fade" id="differenceModal" tabindex="-1">
              <div class="modal-dialog">
              <div class="modal-content">
                  <div class="modal-header">
                      <h5 class="modal-title">${title}</h5>
                      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div class="modal-body">
                      <p>${amountText}</p>
                      <label class="form-label">Método de ${type === 'pay' ? 'pago' : 'devolución'}</label>
                      <select id="diff-method" class="form-select">
                          <option value="cash">Efectivo</option>
                          <option value="transfer">Transferencia</option>
                      </select>
                      <div id="diff-ref-container" style="display:none;" class="mt-2">
                          <label class="form-label">Referencia</label>
                          <input type="text" id="diff-ref" class="form-control">
                      </div>
                  </div>
                  <div class="modal-footer">
                      <button type="button" class="btn btn-secondary" id="cancel-diff-btn">Cancelar</button>
                      <button type="button" class="btn btn-primary" id="confirm-diff-btn">${actionButtonText}</button>
                  </div>
              </div>
              </div>
          </div>
          `;

          const existing = document.getElementById("differenceModal");
          if (existing) existing.remove();
          document.body.insertAdjacentHTML("beforeend", modalHtml);

          const modal = new bootstrap.Modal(document.getElementById("differenceModal"));
          modal.show();

          const methodSelect = document.getElementById('diff-method');
          const refContainer = document.getElementById('diff-ref-container');
          methodSelect.addEventListener('change', () => {
              refContainer.style.display = methodSelect.value === 'transfer' ? 'block' : 'none';
          });

          document.getElementById('confirm-diff-btn').addEventListener('click', () => {
              modal.hide();
              resolve({ method: methodSelect.value, reference: document.getElementById('diff-ref').value });
          });
          document.getElementById('cancel-diff-btn').addEventListener('click', () => { modal.hide(); resolve(null); });
          document.querySelector('#differenceModal .btn-close').addEventListener('click', () => resolve(null));
      });
  }

  // Modal de detalles de crédito

  window.downloadReceipt = async (id, type) => {
    const res = await window.api.exportPaymentReceiptPDF(id, type);
    if (res.success) {
      const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      Toast.fire({ icon: 'success', title: 'Recibo generado correctamente' });
    } else if (res.message) {
      Swal.fire('Error', res.message, 'error');
    }
  };

  async function showCreditDetails(saleId) {
    const sale = await window.api.getSaleById(saleId);
    if (!sale) {
      Swal.fire('Error', "Crédito no encontrado.", 'error');
      return;
    }

    let client = null;
    if (sale.client_id) {
      client = await window.api.getClientById(sale.client_id);
    }
    const clientName = client ? client.name : "Sin cliente";

    let daysRemainingInfo = "";
    if (sale.due_date && sale.outstanding_balance > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(sale.due_date);
        due.setHours(0, 0, 0, 0);
        const diffTime = due - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            daysRemainingInfo = `<span class="badge bg-danger">Vencido hace ${Math.abs(diffDays)} días</span>`;
        } else if (diffDays === 0) {
            daysRemainingInfo = `<span class="badge bg-warning text-dark">Vence hoy</span>`;
        } else {
            daysRemainingInfo = `<span class="badge bg-info">Vence en ${diffDays} días</span>`;
        }
    }

    const payments = await window.api.getSalePayments(saleId);
    const historyRows = payments.map(p => `
      <tr>
        <td><small>${p.created_at}</small></td>
        <td>${p.method === 'cash' ? 'Efe.' : 'Trf.'}</td>
        <td class="text-end fw-bold">${formatCOP(p.amount)}</td>
        <td class="text-center"><button class="btn btn-sm btn-outline-danger border-0 p-0" onclick="downloadReceipt(${p.id}, 'credit')"><i class="fas fa-file-pdf"></i></button></td>
      </tr>
    `).join('');

    const modalHtml = `
      <div class="modal fade" id="creditDetailsModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Detalles de Crédito - Factura #${sale.invoice_number || sale.id}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p><strong>Cliente:</strong> ${clientName}</p>
              <p><strong>Total de la Venta:</strong> ${formatCOP(sale.total_amount)}</p>
              <p><strong>Total Abonado:</strong> <span id="modal-paid-amount">${formatCOP(sale.paid_amount)}</span></p>
              <p><strong>Saldo Pendiente:</strong> <span id="modal-outstanding-balance" class="fw-bold text-danger">${formatCOP(sale.outstanding_balance)}</span></p>
              ${sale.due_date ? `<p><strong>Vencimiento:</strong> ${sale.due_date} ${daysRemainingInfo}</p>` : ''}

              <h6 class="mt-4 border-bottom pb-2">Historial de Abonos</h6>
              <div class="table-responsive" style="max-height: 150px;">
                <table class="table table-sm table-hover">
                  <thead class="table-light"><tr><th>Fecha</th><th>Medio</th><th class="text-end">Monto</th><th>PDF</th></tr></thead>
                  <tbody>${historyRows || '<tr><td colspan="4" class="text-center text-muted">No hay abonos</td></tr>'}</tbody>
                </table>
              </div>

              <h6 class="mt-4">Registrar Abono</h6>
              <div class="mb-2">
                <select class="form-select" id="abono-method">
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                </select>
              </div>
              <div class="mb-2" id="abono-ref-container" style="display:none;">
                <input type="text" class="form-control" id="abono-ref" placeholder="Banco / Referencia">
              </div>
              <div class="input-group">
                <input type="number" class="form-control" id="abono-amount" placeholder="Monto del abono">
                <button class="btn btn-primary" type="button" id="add-abono-btn">Abonar</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const existingModal = document.getElementById("creditDetailsModal");
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('creditDetailsModal'));
    modal.show();

    // Mostrar/ocultar referencia según método
    const methodSelect = document.getElementById('abono-method');
    const refContainer = document.getElementById('abono-ref-container');
    methodSelect.addEventListener('change', () => {
        refContainer.style.display = methodSelect.value === 'transfer' ? 'block' : 'none';
    });

    document.getElementById("add-abono-btn").addEventListener("click", async () => {
      const abonoAmount = Number(document.getElementById("abono-amount").value);
      const method = methodSelect.value;
      const reference = document.getElementById("abono-ref").value;

      if (abonoAmount <= 0 || abonoAmount > sale.outstanding_balance) {
        Swal.fire('Error', "Monto de abono inválido o superior al saldo pendiente.", 'error');
        return;
      }

      const res = await window.api.addCreditPayment(saleId, abonoAmount, method, reference);
      Swal.fire(res.success ? 'Éxito' : 'Error', res.message, res.success ? 'success' : 'error');
      modal.hide();
      await loadCredits();
    });
  }

  // Inicialización
  
  await loadSales();
  await loadCredits(); // Se mantiene la carga de créditos

  // Atajos de teclado
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
        e.preventDefault();
        productInput.focus();
    }
    if (e.key === 'F9') {
        e.preventDefault();
        finalizeBtn.click();
    }
  });

  // Foco automático en el campo de código de barras al cargar
  if (barcodeInput) barcodeInput.focus();
});