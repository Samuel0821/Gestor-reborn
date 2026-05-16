document.addEventListener('DOMContentLoaded', async () => {
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
  // ---------------------------------------------------------------------------------------

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
  let currentOffset = 0;
  const SERVICES_LIMIT = 10;

  // --- INYECTAR SELECTOR DE CLIENTE ---
  const clientContainer = document.createElement('div');
  clientContainer.className = 'mb-3';
  clientContainer.innerHTML = `
    <label class="form-label" for="service-client-input">Cliente Asociado</label>
    <div class="input-group">
        <span class="input-group-text"><i class="fa fa-user"></i></span>
        <input type="text" id="service-client-input" class="form-control" list="service-clients-datalist" placeholder="Escriba el nombre o NIT/Cédula del cliente...">
        <datalist id="service-clients-datalist"></datalist>
        <input type="hidden" id="service-client">
    </div>
  `;
  // Insertar antes del campo de nombre
  form.prepend(clientContainer);
  const clientInput = document.getElementById('service-client-input');
  const clientHiddenIdInput = document.getElementById('service-client');
  const clientsDatalist = document.getElementById('service-clients-datalist');
  // ------------------------------------

  // --- INYECTAR FECHA PROGRAMADA ---
  const dateContainer = document.createElement('div');
  dateContainer.className = 'mb-3';
  dateContainer.innerHTML = `
    <label class="form-label">Fecha Programada</label>
    <input type="date" class="form-control" id="service-scheduled-date">
  `;
  clientContainer.after(dateContainer);
  const scheduledDateInput = document.getElementById('service-scheduled-date');
  // ------------------------------------

  // --- INYECTAR FILTRO DE ESTADO ---
  const filterContainer = document.createElement('div');
  filterContainer.className = 'mb-3 d-flex align-items-center flex-wrap gap-3';
  filterContainer.innerHTML = `
    <div class="d-flex align-items-center">
        <label class="me-2 fw-bold">Estado:</label>
        <select id="filter-status" class="form-select w-auto">
            <option value="all">-- Todos --</option>
            <option value="Abierto">Abierto</option>
            <option value="Cotizado">Cotizado</option>
            <option value="Finalizado">Finalizado</option>
        </select>
    </div>
    <div class="d-flex align-items-center">
        <label class="me-2 fw-bold">Ejecución:</label>
        <select id="filter-execution" class="form-select w-auto">
            <option value="all">-- Todos --</option>
            <option value="pending">Pendientes</option>
            <option value="performed">Realizados</option>
        </select>
    </div>
  `;

  const cardBody = servicesTable.closest('.card-body');
  const tableResponsive = servicesTable.closest('.table-responsive');
  if (cardBody) {
    cardBody.insertBefore(filterContainer, tableResponsive);
  } else {
    const target = tableResponsive || servicesTable;
    if (target.parentNode) target.parentNode.insertBefore(filterContainer, target);
  }

  const statusFilter = document.getElementById('filter-status');
  const executionFilter = document.getElementById('filter-execution');

  statusFilter.addEventListener('change', () => loadServices(false));
  executionFilter.addEventListener('change', () => loadServices(false));
  // ------------------------------------

  function formatCOP(value) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value);
  }

  // --- PERSISTENCIA DEL BORRADOR (DRAFT) ---
  function saveDraft() {
    // No guardar si estamos editando un servicio existente (tiene ID)
    if (idInput.value) return; 

    const draft = {
        name: nameInput.value,
        price: priceInput.value,
        description: descInput.value,
        client_id: clientHiddenIdInput.value,
        scheduled_date: scheduledDateInput.value,
        products: currentServiceProducts
    };
    sessionStorage.setItem('service_draft', JSON.stringify(draft));
  }

  async function loadDraft() {
    const draftStr = sessionStorage.getItem('service_draft');
    if (draftStr && !idInput.value) { // Solo cargar si no estamos editando
        try {
            const draft = JSON.parse(draftStr);
            nameInput.value = draft.name || "";
            priceInput.value = draft.price || "";
            descInput.value = draft.description || "";
            clientHiddenIdInput.value = draft.client_id || "";
            
            if (draft.client_id) {
                const client = await window.api.getClientById(draft.client_id);
                clientInput.value = client ? `${client.name} (${client.id_card_or_nit})` : "";
            } else {
                clientInput.value = "";
            }

            scheduledDateInput.value = draft.scheduled_date || "";
            currentServiceProducts = draft.products || [];
            renderServiceProducts();
        } catch (e) {
            console.error("Error cargando borrador de servicio", e);
        }
    }
  }

  function clearDraft() {
    sessionStorage.removeItem('service_draft');
  }

  // Event listener para el input del cliente: actualiza el campo oculto con el ID
  clientInput.addEventListener('input', () => {
    const selectedOption = Array.from(clientsDatalist.options).find(
      opt => opt.value === clientInput.value
    );
    if (selectedOption) {
      clientHiddenIdInput.value = selectedOption.dataset.id;
    } else {
      clientHiddenIdInput.value = ""; 
    }
    saveDraft();
  });

  // Listeners para guardar borrador en campos de texto
  [nameInput, priceInput, descInput, clientHiddenIdInput, scheduledDateInput].forEach(el => {
      el.addEventListener('input', saveDraft);
      el.addEventListener('change', saveDraft);
  });
  // -----------------------------------------

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
      clientsDatalist.innerHTML = '';
      
      const noClientOpt = document.createElement("option");
      noClientOpt.value = "-- Ninguno --";
      noClientOpt.dataset.id = "";
      clientsDatalist.appendChild(noClientOpt);

      clients.forEach(c => {
          const optDL = document.createElement('option');
          optDL.value = `${c.name} (${c.id_card_or_nit})`;
          optDL.dataset.id = c.id;
          clientsDatalist.appendChild(optDL);
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
      const source = variant || prod;
      let itemPrice = source.sale_price;
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
          variant_id: variantId,
          sale_price: source.sale_price || 0,
          special_price: source.special_price || 0,
          special_price_2: source.special_price_2 || 0
        });
      }
      renderServiceProducts();
      saveDraft(); // Guardar cambios en borrador
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

    currentServiceProducts.forEach((p, index) => {
      const tr = document.createElement("tr");
      const priceDisplay = (p.sale_price !== undefined) 
        ? `<select class="form-select form-select-sm price-selector" data-index="${index}">${generatePriceOptions(p)}</select>`
        : formatCOP(p.price);

      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.quantity}</td>
        <td>${priceDisplay}</td>
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
        saveDraft(); // Guardar cambios en borrador
      });
    });
  }

  // Delegación de eventos para el cambio de precios en la tabla de servicios
  productsTable.addEventListener('change', (e) => {
    if (e.target.classList.contains('price-selector')) {
        const index = Number(e.target.dataset.index);
        const newPrice = parseFloat(e.target.value);
        if (!isNaN(newPrice) && currentServiceProducts[index]) {
            currentServiceProducts[index].price = newPrice;
            renderServiceProducts();
            saveDraft(); // Guardar cambios en borrador
        }
    }
  });

  // Guardar Servicio
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // --- VALIDACIÓN DE STOCK ---
    const noStockItems = [];
    currentServiceProducts.forEach(item => {
        const prod = allProducts.find(p => p.id === item.product_id);
        if (prod) {
            // Validar si el stock es insuficiente (o 0)
            let requiredQty = item.quantity;
            
            // Si es variante, convertir a unidad base para comparar con stock global del producto
            if (item.variant_id && prod.variants) {
                const variant = prod.variants.find(v => v.id === item.variant_id);
                if (variant) {
                    requiredQty = item.quantity * variant.conversion_factor;
                }
            }

            // Usamos una pequeña tolerancia para flotantes
            if (prod.stock < (requiredQty - 0.0001)) {
                noStockItems.push(`${item.name} (Disponible: ${prod.stock})`);
            }
        }
    });

    if (noStockItems.length > 0) {
        Swal.fire({
            title: 'Stock Insuficiente',
            html: `No se puede guardar el servicio porque los siguientes productos no tienen stock suficiente:<br><ul class="text-start mt-2">${noStockItems.map(n => `<li>${n}</li>`).join('')}</ul><br>Por favor, actualice el inventario antes de continuar.`,
            icon: 'error'
        });
        return; // Detener guardado, NO limpiar formulario
    }
    // ---------------------------

    const data = {
      id: idInput.value ? Number(idInput.value) : null,
      name: nameInput.value,
      price: Number(priceInput.value) || 0,
      client_id: clientHiddenIdInput.value ? Number(clientHiddenIdInput.value) : null,
      scheduled_date: scheduledDateInput.value || null,
      description: descInput.value,
      products: currentServiceProducts
    };

    if (data.id) {
      await window.api.updateService(data);
    } else {
      await window.api.createService(data);
    }

    Swal.fire({ icon: 'success', title: 'Servicio guardado', timer: 1500, showConfirmButton: false });
    clearDraft(); // Limpiar borrador al guardar exitosamente
    resetForm();
    loadServices();
    window.scrollTo(0, document.body.scrollHeight); // Ir abajo para ver la lista
    loadProducts(); // Recargar lista de productos para actualizar stock en memoria
  });

  function resetForm() {
    form.reset();
    idInput.value = "";
    clientHiddenIdInput.value = "";
    clientInput.value = "";
    scheduledDateInput.value = "";
    currentServiceProducts = [];
    renderServiceProducts();
    cancelBtn.style.display = "none";
    clearDraft(); // Asegurar limpieza
  }

  cancelBtn.addEventListener("click", resetForm);

  // Cargar Servicios
  // Botón Cargar Más
  const loadMoreBtn = document.createElement('button');
  loadMoreBtn.className = 'btn btn-outline-primary d-block mx-auto my-3';
  loadMoreBtn.textContent = 'Cargar más servicios';
  loadMoreBtn.style.display = 'none';
  servicesTable.closest('.table-responsive').after(loadMoreBtn);

  loadMoreBtn.addEventListener('click', () => loadServices(true));

  async function loadServices(append = false) {
    if (!append) {
        currentOffset = 0;
        servicesTable.innerHTML = "";
        loadMoreBtn.style.display = 'none';
    }

    const status = statusFilter.value;
    const executionStatus = executionFilter.value;
    const newServices = await window.api.getServices(SERVICES_LIMIT, currentOffset, status, executionStatus);
    
    if (newServices.length > 0) {
        renderServicesTable(newServices, append);
        currentOffset += newServices.length;
        if (newServices.length === SERVICES_LIMIT) {
            loadMoreBtn.style.display = 'block';
        } else {
            loadMoreBtn.style.display = 'none';
        }
    } else if (!append) {
        servicesTable.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay servicios registrados.</td></tr>';
    }
  }

  function renderServicesTable(list, append) {
    // Inyectar encabezados si no existen
    const tableEl = servicesTable.closest('table');
    if(tableEl) {
        const thead = tableEl.querySelector('thead tr');
        if(thead && !thead.querySelector('.th-client')) {
            const th = document.createElement('th');
            th.className = 'th-client';
            th.textContent = 'Cliente';
            if(thead.children.length > 0) thead.insertBefore(th, thead.children[1]); // Insertar después de Nombre
        }
        // Inyectar encabezado Programado
        if(thead && !thead.querySelector('.th-scheduled')) {
            const th = document.createElement('th');
            th.className = 'th-scheduled';
            th.textContent = 'Programado';
            if(thead.children.length > 2) thead.insertBefore(th, thead.children[2]); // Insertar después de Cliente
        }
        // Inyectar encabezado Estado después de Total Sugerido
        if(thead && !thead.querySelector('.th-status')) {
            const th = document.createElement('th');
            th.className = 'th-status';
            th.textContent = 'Estado';
            // Asumiendo orden: Nombre, Cliente, Desc, Precio, Costo Mat, Total Sug, Acciones
            // Insertar antes de Acciones (último hijo)
            thead.insertBefore(th, thead.lastElementChild);
        }
        // Inyectar encabezado Ejecución
        if(thead && !thead.querySelector('.th-execution')) {
            const th = document.createElement('th');
            th.className = 'th-execution';
            th.textContent = 'Ejecución';
            thead.insertBefore(th, thead.lastElementChild);
        }
    }

    if (!append) servicesTable.innerHTML = "";

    list.forEach(s => {
      const materialsCost = Number(s.materials_cost) || 0;
      const totalSuggested = (s.price || 0) + materialsCost;
      
      // Badges de estado
      let statusBadge = '<span class="badge bg-secondary">Desconocido</span>';
      if (s.status === 'Abierto') statusBadge = '<span class="badge bg-primary">Abierto</span>';
      else if (s.status === 'Cotizado') statusBadge = '<span class="badge bg-info text-dark">Cotizado</span>';
      else if (s.status === 'Finalizado') statusBadge = '<span class="badge bg-success">Finalizado</span>';
      else if (s.status === 'Anulado') statusBadge = '<span class="badge bg-danger">Anulado</span>';

      // Badge de Ejecución
      let executionBadge = '<span class="badge bg-secondary">Pendiente</span>';
      if (s.performed_at) {
          const datePerf = new Date(s.performed_at).toLocaleDateString();
          executionBadge = `<span class="badge bg-success" title="Realizado el ${s.performed_at}">Realizado (${datePerf})</span>`;
      }

      // Bloqueo de botones
      const isFinalized = s.status === 'Finalizado';
      const isQuoted = s.status === 'Cotizado';
      const isAnulado = s.status === 'Anulado';
      
      const disabledEdit = (isFinalized || isAnulado) ? 'disabled' : '';
      const disabledDelete = isFinalized ? 'disabled' : '';
      const disabledQuote = (isFinalized || isQuoted || isAnulado) ? 'disabled' : '';
      const disabledSale = (isFinalized || isAnulado) ? 'disabled' : '';
      const disabledCancel = (isFinalized || isAnulado) ? 'disabled' : '';
      const disabledPayment = (isFinalized || isAnulado) ? 'disabled' : '';
      const disabledPerform = (s.performed_at || isAnulado) ? 'disabled' : '';

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${s.name}</strong></td>
        <td>${s.client_name || '<span class="text-muted">-</span>'}</td>
        <td>${s.scheduled_date || '<span class="text-muted">-</span>'}</td>
        <td>${s.description || '-'}</td>
        <td>${formatCOP(s.price)}</td>
        <td>${formatCOP(materialsCost)}</td>
        <td><strong>${formatCOP(totalSuggested)}</strong></td>
        <td>${statusBadge}</td>
        <td>${executionBadge}</td>
        <td>
          <div class="dropdown">
            <button class="btn btn-sm btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
              Acciones
            </button>
            <ul class="dropdown-menu">
              <li><button class="dropdown-item mark-performed" data-id="${s.id}" ${disabledPerform}><i class="fa fa-check me-2 text-success"></i> Marcar Realizado</button></li>
              <li><button class="dropdown-item view-payments" data-id="${s.id}"><i class="fa fa-history me-2"></i> Ver Pagos</button></li>
              <li><button class="dropdown-item add-payment" data-id="${s.id}" ${disabledPayment}><i class="fa fa-hand-holding-usd me-2 text-success"></i> Registrar Abono</button></li>
              <li><hr class="dropdown-divider"></li>
              <li><button class="dropdown-item to-sale" data-id="${s.id}" ${disabledSale}><i class="fa fa-shopping-cart me-2 text-info"></i> Enviar a Venta</button></li>
              <li><button class="dropdown-item to-quote" data-id="${s.id}" ${disabledQuote}><i class="fa fa-file-invoice-dollar me-2 text-secondary"></i> Enviar a Cotización</button></li>
              <li><hr class="dropdown-divider"></li>
              <li><button class="dropdown-item edit" data-id="${s.id}" ${disabledEdit}><i class="fa fa-edit me-2 text-primary"></i> Editar</button></li>
              <li><button class="dropdown-item cancel" data-id="${s.id}" ${disabledCancel}><i class="fa fa-ban me-2 text-warning"></i> Anular</button></li>
              <li><button class="dropdown-item del" data-id="${s.id}" ${disabledDelete}><i class="fa fa-trash me-2 text-danger"></i> Eliminar</button></li>
            </ul>
          </div>
        </td>
      `;
      servicesTable.appendChild(tr);

      // Restricción de roles
      const role = localStorage.getItem('user_role');
      if (role !== 'admin') {
        ['.del', '.cancel', '.add-payment', '.mark-performed'].forEach(selector => {
            tr.querySelectorAll(selector).forEach(btn => {
                const li = btn.closest('li');
                if (li) li.remove();
                else btn.remove();
            });
        });
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

    servicesTable.querySelectorAll(".add-payment").forEach(b => b.addEventListener("click", async (e) => {
        const id = Number(e.currentTarget.dataset.id);
        showServicePaymentModal(id);
    }));

    servicesTable.querySelectorAll(".view-payments").forEach(b => b.addEventListener("click", async (e) => {
        const id = Number(e.currentTarget.dataset.id);
        showPaymentHistoryModal(id);
    }));

    servicesTable.querySelectorAll(".mark-performed").forEach(b => b.addEventListener("click", async (e) => {
        const id = Number(e.currentTarget.dataset.id);
        markAsPerformed(id);
    }));

    servicesTable.querySelectorAll(".cancel").forEach(b => b.addEventListener("click", async (e) => {
        const id = Number(e.currentTarget.dataset.id);
        const result = await Swal.fire({
            title: '¿Anular servicio?',
            text: "El servicio pasará a estado Anulado y los materiales se devolverán al inventario.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ffc107',
            confirmButtonText: 'Sí, anular',
            cancelButtonText: 'Cancelar'
        });
        if (result.isConfirmed) {
            const res = await window.api.cancelService(id);
            if (res.success) {
                loadServices();
                Swal.fire('Anulado', res.message, 'success');
            } else {
                Swal.fire('Error', res.message, 'error');
            }
        }
    }));

    servicesTable.querySelectorAll(".edit").forEach(b => b.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id;
      const service = await window.api.getServiceById(id);

      // Lógica de reapertura si está cotizado
      if (service.status === 'Cotizado') {
          const result = await Swal.fire({
              title: 'Servicio Cotizado',
              text: "Este servicio ya fue enviado a cotización. ¿Deseas reabrirlo para editarlo? Esto cambiará su estado a 'Abierto'.",
              icon: 'question',
              showCancelButton: true,
              confirmButtonText: 'Sí, reabrir',
              cancelButtonText: 'Cancelar'
          });

          if (!result.isConfirmed) return;

          // Cambiar estado a Abierto
          await window.api.updateServiceStatus(id, 'Abierto');
          // Continuar con la carga...
      }

      idInput.value = service.id;
      nameInput.value = service.name;
      priceInput.value = service.price;
      descInput.value = service.description;
      clientHiddenIdInput.value = service.client_id || "";
      const client = await window.api.getClientById(service.client_id);
      clientInput.value = client ? `${client.name} (${client.id_card_or_nit})` : "";
      scheduledDateInput.value = service.scheduled_date || "";
      
      currentServiceProducts = service.products.map(p => ({
        product_id: p.product_id,
        name: p.variant_name ? `${p.name} (${p.variant_name})` : p.name,
        price: p.price || p.sale_price,
        quantity: p.quantity,
        variant_id: p.variant_id,
        sale_price: p.sale_price,
        special_price: p.special_price,
        special_price_2: p.special_price_2
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
        service_id: service.id, // ID para actualizar estado al vender
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
          price: p.price || p.sale_price,
          sale_price: p.sale_price,
          special_price: p.special_price || 0,
          special_price_2: p.special_price_2 || 0,
          subtotal: (p.price || p.sale_price) * p.quantity,
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

      // Actualizar estado a Cotizado
      await window.api.updateServiceStatus(id, 'Cotizado');
      
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
          price: p.price || p.sale_price,
          sale_price: p.sale_price,
          special_price: p.special_price || 0,
          special_price_2: p.special_price_2 || 0,
          subtotal: (p.price || p.sale_price) * p.quantity,
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
    // La búsqueda en tiempo real con paginación es compleja si no se hace en backend.
    // Por simplicidad, recargamos todo sin filtro de estado, o implementamos búsqueda en backend.
    // Dado que getServices ahora pagina, el filtro local solo funciona sobre lo cargado.
    // Lo ideal es recargar.
    // NOTA: Para mantenerlo simple y funcional con la paginación, deshabilitamos la búsqueda local
    // y sugerimos implementar búsqueda en backend en el futuro, o cargar todo si son pocos.
    // Aquí simplemente no hacemos nada o advertimos.
    // O mejor, recargamos la tabla filtrando visualmente solo lo que hay (limitado a 10).
    // Para cumplir con el requerimiento de paginación, la búsqueda debería ser server-side.
    // Dejaremos la búsqueda visual sobre los elementos renderizados por ahora.
    const term = e.target.value.toLowerCase();
    const rows = servicesTable.querySelectorAll('tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
  });

  // --- MODAL DE ABONOS ---
  async function showServicePaymentModal(serviceId) {
      // Obtener detalles del servicio directamente del backend para asegurar que esté actualizado
      const service = await window.api.getServiceById(serviceId);
      if (!service) {
          Swal.fire('Error', 'Servicio no encontrado.', 'error');
          return;
      }
      const totalServiceCost = (service.price || 0) + (service.materials_cost || 0);
      const totalPaid = service.paid_amount || 0; // Asumiendo que service.paid_amount ya está disponible o se calcula
      const outstandingBalance = totalServiceCost - totalPaid;

      const modalHtml = `
      <div class="modal fade" id="servicePaymentModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Registrar Abono a Servicio</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="bg-light p-3 rounded mb-3 border">
                <p class="mb-1"><strong>Valor Total del Servicio:</strong> ${formatCOP(totalServiceCost)}</p>
                <p class="mb-1"><strong>Total Abonado:</strong> ${formatCOP(totalPaid)}</p>
                <p class="mb-0 fw-bold text-danger"><strong>Saldo Pendiente Actual:</strong> ${formatCOP(outstandingBalance)}</p>
              </div>
              <div class="mb-3">
                <label class="form-label">Monto del Abono</label>
                <input type="number" id="sp-amount" class="form-control" min="0" placeholder="Ingrese el valor a abonar">
              </div>
              <div class="mb-3">
                <label class="form-label">Método de Pago</label>
                <select id="sp-method" class="form-select">
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                </select>
              </div>
              <div class="mb-3" id="sp-ref-container" style="display:none;">
                <label class="form-label">Referencia / Banco</label>
                <input type="text" id="sp-reference" class="form-control">
              </div>
              <div id="sp-new-balance-info" class="mt-2 fw-bold text-primary"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-success" id="btn-save-sp">Guardar Abono</button>
            </div>
          </div>
        </div>
      </div>`;

      const existing = document.getElementById('servicePaymentModal');
      if (existing) existing.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      const modal = new bootstrap.Modal(document.getElementById('servicePaymentModal'));
      modal.show();

      const amountInput = document.getElementById('sp-amount');
      const newBalanceInfo = document.getElementById('sp-new-balance-info');

      // Calcular saldo proyectado en tiempo real
      amountInput.addEventListener('input', () => {
          const abono = parseFloat(amountInput.value) || 0;
          const newBalance = outstandingBalance - abono;
          if (abono > 0) {
              newBalanceInfo.textContent = `Saldo después del abono: ${formatCOP(Math.max(0, newBalance))}`;
              if (newBalance < 0) {
                  newBalanceInfo.textContent += ` (Excedente: ${formatCOP(Math.abs(newBalance))})`;
              }
          } else {
              newBalanceInfo.textContent = "";
          }
      });

      document.getElementById('sp-method').addEventListener('change', (e) => {
          document.getElementById('sp-ref-container').style.display = e.target.value === 'transfer' ? 'block' : 'none';
      });

      document.getElementById('btn-save-sp').addEventListener('click', async () => {
          const amount = parseFloat(document.getElementById('sp-amount').value);
          const method = document.getElementById('sp-method').value;
          const reference = document.getElementById('sp-reference').value;

          if (!amount || amount <= 0) {
              return Swal.fire('Error', 'Monto inválido', 'error');
          }
          if (amount > outstandingBalance) {
              return Swal.fire('Error', `El monto del abono no puede superar el saldo pendiente (${formatCOP(outstandingBalance)}).`, 'error');
          }
          const res = await window.api.addServicePayment({ serviceId, amount, method, reference });
          if (res.success) { Swal.fire('Éxito', res.message, 'success'); modal.hide(); } else { Swal.fire('Error', res.message, 'error'); }
      });
  }

   window.downloadServiceReceipt = async (id) => {
    const res = await window.api.exportPaymentReceiptPDF(id, 'service');
    if (res.success) {
      const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
      Toast.fire({ icon: 'success', title: 'Recibo generado correctamente' });
    } else if (res.message) {
      Swal.fire('Error', res.message, 'error');
    }
  };

  // --- MODAL HISTORIAL DE PAGOS ---
  async function showPaymentHistoryModal(serviceId) {
      const payments = await window.api.getServicePayments(serviceId);
      const service = await window.api.getServiceById(serviceId);
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      
      let rows = '';
      if (payments.length === 0) {
          rows = '<tr><td colspan="5" class="text-center text-muted">No hay pagos registrados</td></tr>';
      } else {
          rows = payments.map(p => {
            const dateStr = p.date;
            return `
            <tr>
                <td>${new Date(dateStr).toLocaleString()}</td>
                <td>${p.method === 'cash' ? 'Efectivo' : 'Transferencia'}</td>
                <td>${p.reference || '-'}</td>
                <td class="text-end fw-bold">${formatCOP(p.amount)}</td>
                <td class="text-center"><button class="btn btn-sm btn-outline-danger border-0 p-0" onclick="downloadServiceReceipt(${p.id})"><i class="fas fa-file-pdf"></i></button></td>
            </tr>`;
          }).join('');
      }

      const modalHtml = `
      <div class="modal fade" id="paymentHistoryModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Historial de Pagos - ${service.name}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <table class="table table-sm table-striped">
                <thead><tr><th>Fecha</th><th>Método</th><th>Ref</th><th class="text-end">Monto</th><th>PDF</th></tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr><th colspan="3" class="text-end">Total Abonado:</th><th class="text-end">${formatCOP(totalPaid)}</th><th></th></tr></tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>`;

      const existing = document.getElementById('paymentHistoryModal');
      if (existing) existing.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      new bootstrap.Modal(document.getElementById('paymentHistoryModal')).show();
  }

  async function markAsPerformed(id) {
      const result = await Swal.fire({
          title: '¿Marcar como Realizado?',
          text: "Esto indicará que el trabajo operativo ha sido completado.",
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Sí, marcar',
          cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
          const res = await window.api.markServicePerformed(id);
          if (res.success) {
              Swal.fire('Actualizado', res.message, 'success');
              loadServices();
          } else {
              Swal.fire('Error', res.message, 'error');
          }
      }
  }

  await loadProducts();
  await loadClients();

  // Verificar filtro desde Dashboard
  const storedStatus = sessionStorage.getItem('serviceFilterStatus');
  if (storedStatus) {
      const statusFilter = document.getElementById('filter-status');
      if (statusFilter) {
          statusFilter.value = storedStatus;
      }
      sessionStorage.removeItem('serviceFilterStatus');
  }

  await loadServices();
  loadDraft(); // Cargar borrador si existe al iniciar
});