console.log('sales.js cargado');

let saleItems = [];
let allProducts = [];
let editingSaleId = null;

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
  // Layout manejado por layout.js

  // Cargar carrito desde sessionStorage al iniciar
  const savedCart = sessionStorage.getItem('shoppingCart');
  if (savedCart) {
    saleItems = JSON.parse(savedCart);
  }
 
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
  const saleTypeSelect = document.getElementById("sale-type");
  const creditsList = document.getElementById("credits-list");
  const creditSearchInput = document.getElementById("credit-search-input");
  const creditSearchBtn = document.getElementById("credit-search-btn");
  const barcodeInput = document.getElementById("barcode-input");

  function cancelEdit() {
    editingSaleId = null;
    saleItems = [];
    renderSaleItems();
    clientSelect.value = "";
    saleTypeSelect.value = "cash";
    finalizeBtn.textContent = "Finalizar Venta";
    finalizeBtn.classList.remove('btn-warning');
    finalizeBtn.classList.add('btn-primary');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if(cancelBtn) cancelBtn.remove();
    productInput.focus();
  }

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
    clients.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.id_card_or_nit})`;
      clientSelect.appendChild(opt);
    });
  }

  // Renderizar items
  
  function renderSaleItems() {
    saleItemsTbody.innerHTML = "";
    let total = 0;

    saleItems.forEach((it, i) => {
      total += it.subtotal;
      const tr = document.createElement("tr");

      const isService = it.is_service || String(it.product_name).toLowerCase().startsWith('[servicio]');
      const isKgVariant = String(it.product_name).toLowerCase().includes("kg");

      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${it.product_code || '-'}</td>
        <td>${it.product_name}</td>
        <td>
          ${!isService && isKgVariant 
            ? `<input type="number" min="0.1" step="0.1" value="${it.quantity}" data-i="${i}" class="form-control form-control-sm qty-input">`
            : it.quantity}
        </td>
        <td>
          ${isService 
            ? formatCOP(it.price) 
            : `
            <select class="form-select form-select-sm price-selector">
              <option value="sale" data-price="${it.sale_price}" ${it.price === it.sale_price ? 'selected' : ''}>${formatCOP(it.sale_price)}</option>
              ${it.special_price > 0 ? `<option value="special" data-price="${it.special_price}" ${it.price === it.special_price ? 'selected' : ''}>${formatCOP(it.special_price)}</option>` : ''}
            </select>
          `}
        </td>
        <td>${formatCOP(it.price * it.quantity)}</td>
        <td><button class="btn btn-sm btn-danger remove" data-i="${i}">Eliminar</button></td>
      `;

      saleItemsTbody.appendChild(tr);

      // Cambiar precio desde el selector (solo para productos)
      if (!isService) {
        tr.querySelector('.price-selector')?.addEventListener('change', (e) => {
          const selectedOption = e.target.options[e.target.selectedIndex];
          const newPrice = parseFloat(selectedOption.getAttribute('data-price'));
          saleItems[i].price = newPrice;
          saleItems[i].subtotal = newPrice * saleItems[i].quantity;
          renderSaleItems();
        });
      }

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
    let itemPrice = variant ? variant.sale_price : prod.sale_price;
    let itemName = variant ? `${prod.name} (${variant.name})` : prod.name;
    let variantId = variant ? variant.id : null;

    // Calcular costo: prioriza el de la variante, si no, calcula desde el padre.
    let purchasePrice = 0;
    if (variant) {
        purchasePrice = variant.purchase_price > 0 ? variant.purchase_price : (prod.purchase_price || 0) * (variant.conversion_factor || 1);
    } else if (prod) {
        purchasePrice = prod.purchase_price || 0;
    }

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
        quantity: qty,
        price: itemPrice,
        sale_price: itemPrice,
        special_price: variant ? 0 : prod.special_price,
        subtotal: itemPrice * qty,
        variant_id: variantId,
        purchase_price: purchasePrice
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
 
  function showPaymentModal(totalAmount, clientId, saleType) {
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
      const change = totalPaid - totalAmount;
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

      if (totalPaid < totalAmount && saleType !== "credit") {
        Swal.fire('Error', "El monto pagado es insuficiente.", 'error');
        return;
      }

      const outstandingBalance = saleType === "credit" ? totalAmount : Math.max(0, totalAmount - totalPaid);
      const paidAmount = saleType === "credit" ? 0 : totalPaid;

      const saleData = {
        client_id: clientId,
        items: saleItems,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        outstanding_balance: outstandingBalance,
        sale_type: saleType,
        cash_payment: cash,
        transfer_payment: transfer,
        transfer_reference: transferRef
      };

      const res = await window.api.createSale(saleData);
      if (!res.success) {
        Swal.fire('Error', res.message, 'error');
        return;
      }

      if (cash > 0) {
        const activeSession = await window.api.getActiveCashSession();
        if (activeSession) {
          await window.api.addCashMovement(activeSession.id, "sale", cash, `Venta #${res.id}`);
        }
      }

      Swal.fire({
          title: 'Venta Exitosa',
          text: res.message || "Venta registrada exitosamente.",
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
      });
      sessionStorage.removeItem('shoppingCart'); // Limpiar carrito de la sesión
      saleItems = [];
      renderSaleItems();
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
      const clientId = clientSelect.value ? Number(clientSelect.value) : null;
      const saleType = saleTypeSelect.value;
      const totalAmount = saleItems.reduce((sum, item) => sum + item.subtotal, 0);

      if (saleType === 'credit') {
          if (!clientId) {
              Swal.fire('Atención', "Para una venta a crédito, debes seleccionar un cliente.", 'warning');
              return;
          }
          
          const result = await Swal.fire({
              title: 'Confirmar Crédito',
              text: `¿Confirmar venta a crédito por ${formatCOP(totalAmount)}?`,
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
                  paid_amount: 0,
                  outstanding_balance: totalAmount,
                  sale_type: saleType,
                  cash_payment: 0,
                  transfer_payment: 0,
                  transfer_reference: null
              };
              const res = await window.api.createSale(saleData);
              if (!res.success) {
                  Swal.fire('Error', res.message, 'error');
                  return;
              }
              Swal.fire('Éxito', res.message || "Venta a crédito registrada exitosamente.", 'success');
              sessionStorage.removeItem('shoppingCart');
              saleItems = [];
              renderSaleItems();
              await loadSales();
              await loadProducts();
              await loadCredits();
          }
          return;
      }
      showPaymentModal(totalAmount, clientId, saleType);
  }

  async function handleUpdateSale() {
      if (!editingSaleId) return;

      const originalSale = await window.api.getSaleById(editingSaleId);
      const newTotalAmount = saleItems.reduce((sum, item) => sum + item.subtotal, 0);
      const difference = newTotalAmount - originalSale.total_amount;

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
          saleId: editingSaleId,
          clientId: clientSelect.value ? Number(clientSelect.value) : null,
          items: saleItems,
          paymentAdjustment: paymentAdjustment,
          userName: localStorage.getItem('user_name') || 'system'
      };

      const res = await window.api.updateSale(updateData);
      Swal.fire(res.success ? 'Éxito' : 'Error', res.message, res.success ? 'success' : 'error');

      if (res.success) {
          cancelEdit();
          await loadSales(false);
          await loadProducts();
          await loadCredits();
      }
  }

  // Cargar ventas

  let currentOffset = 0;
  const SALES_LIMIT = 10;
  let loadMoreBtn;

  // --- FILTRO POR CLIENTE ---
  const filterContainer = document.createElement("div");
  filterContainer.className = "mb-3 d-flex align-items-center";
  filterContainer.innerHTML = `
    <label class="me-2 fw-bold">Filtrar por Cliente:</label>
    <select id="filter-client" class="form-select w-auto">
        <option value="">-- Todos --</option>
    </select>
  `;
  if (salesList && salesList.parentNode) {
      salesList.parentNode.insertBefore(filterContainer, salesList);
  }
  const filterClientSelect = document.getElementById('filter-client');
  // --------------------------

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
    const target = e.target;

    if (target.classList.contains("delete-sale")) {
      const result = await Swal.fire({
          title: '¿Eliminar venta?',
          text: "Esta acción no se puede deshacer y devolverá los productos al inventario.",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          confirmButtonText: 'Sí, eliminar'
      });
      if (!result.isConfirmed) return;

      await window.api.deleteSale(Number(target.dataset.id));
      await loadSales(false); // Recargar desde cero
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
        const res = await window.api.exportSaleReceiptPDF(saleId, currentUser);
        Swal.fire(res.success ? 'Éxito' : 'Error', res.message || (res.success ? "Recibo exportado" : "Error"), res.success ? 'success' : 'error');
    }
  });

  async function handlePrintSale(id) {
    const sale = await window.api.getSaleById(id);
    const items = await window.api.getSaleItems(id);
    const company = await window.api.getCompanySettings();
    const logoBase64 = await window.api.getCompanyLogo();
    const client = sale.client_id ? await window.api.getClientById(sale.client_id) : null;

    if (!sale || !items) {
      Swal.fire('Error', "No se encontró la información de la venta", 'error');
      return;
    }

    const printers = await window.api.getPrinters();
    if (!printers || printers.length === 0) {
      Swal.fire('Error', "No se encontraron impresoras disponibles", 'error');
      return;
    }

    const htmlContent = generateInvoiceHtml(sale, items, company, logoBase64, client, printers);
    await window.api.previewInvoice({ content: htmlContent });
  }

  // Cargar clientes en el filtro
  async function loadFilterClients() {
      const clients = await window.api.getClients();
      clients.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          filterClientSelect.appendChild(opt);
      });
  }
  filterClientSelect.addEventListener('change', () => loadSales(false));

  async function loadSales(append = false) {
    if (!append) {
      currentOffset = 0;
      salesList.innerHTML = "";
      loadMoreBtn.style.display = "none";
    }
    const selectedClientId = filterClientSelect.value ? Number(filterClientSelect.value) : null;
    const sales = await window.api.getSales(SALES_LIMIT, currentOffset, selectedClientId);
    
    if (!sales || sales.length === 0) {
      if (!append) salesList.innerHTML = '<div class="alert alert-secondary">No hay ventas</div>';
      else {
        Swal.fire('Info', "No hay más facturas.", 'info');
        loadMoreBtn.style.display = "none";
      }
      return;
    }

    const html = sales.map((s) => {
      const itemsHtml = (s.items || []).map(it => `<li>${it.product_name} x ${it.quantity} = ${formatCOP(it.subtotal)}</li>`).join("");
      return `
        <div class="card mb-2 p-2">
          <div>
            <strong>${s.invoice_number || `FACT-${String(s.id).padStart(3,"0")}`}</strong>
            — ${s.sale_date} — ${formatCOP(s.total_amount)}
            <div class="float-end">
              <button class="btn btn-sm btn-primary export-invoice" data-id="${s.id}">Descargar Factura</button>
              <button class="btn btn-sm btn-success ms-1 print-sale" data-id="${s.id}">Imprimir Factura</button>
              <button class="btn btn-sm btn-info ms-1 export-receipt" data-id="${s.id}" title="Generar Recibo de Caja"><i class="fa fa-file-invoice-dollar"></i> Recibo</button>
              <button class="btn btn-sm btn-warning ms-1 edit-sale" data-id="${s.id}">Editar</button>
              <button class="btn btn-sm btn-danger ms-1 delete-sale" data-id="${s.id}">Eliminar Factura</button>
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
      salesList.querySelectorAll('.delete-sale').forEach(btn => btn.remove());
      salesList.querySelectorAll('.edit-sale').forEach(btn => btn.remove()); // Solo admin puede editar por ahora
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
        saleTypeSelect.value = sale.sale_type;
        
        const detailedItems = [];
        for (const item of items) {
            if (item.product_id) {
                const product = allProducts.find(p => p.id === item.product_id);
                if (product) {
                    let basePrice = product.sale_price;
                    let specialPrice = product.special_price;
                    
                    if (item.variant_id && product.variants) {
                        const v = product.variants.find(v => v.id === item.variant_id);
                        if (v) {
                            basePrice = v.sale_price;
                            specialPrice = 0;
                        }
                    }
                    detailedItems.push({
                        ...item,
                        sale_price: basePrice,
                        special_price: specialPrice,
                    });
                }
            } else {
                // Servicios o ítems sin producto asociado
                detailedItems.push({ ...item, sale_price: item.price, special_price: 0 });
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
      return `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              @page { margin: 6mm; } /* Margen de impresión */
              body { 
                font-family: 'Arial', sans-serif; 
                font-size: 8px; /* Tamaño de fuente base */
                color: #0a0a0aff;
                padding: 0;
                margin: 0;
              }
              .invoice-box {
                width: 95%;
                box-sizing: border-box;
                margin: 0 auto; /* Centrar el contenido */
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
                font-size: 9px; /* Aumentado */
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
                font-size: 10px;
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
                  font-size: 10px;
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
                font-size: 10px;
              }
              .print-options-panel {
                position: fixed; bottom: 30px; right: 25px; background-color: white; padding: 20px;
                border: 4px solid #ccc; border-radius: 15px; box-shadow: 0 8px 12px rgba(0,0,0,0.1);
                display: flex; flex-direction: column; gap: 15px; z-index: 9999;
              }
              @media print {
                .print-options-panel { display: none; }
              }
            </style>
          </head>
          <body>
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
              <script>
                function formatCOP(value) { return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value); }
                const totalBase = ${Number(sale.total_amount || 0)};
                const pago = ${Number(sale.cash_payment || 0)} + ${Number(sale.transfer_payment || 0)};
                function updateTotals() {
                  const includeIva = document.getElementById("includeIva").checked;
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
                  const cambio = pago - total;
                  const cambioContainer = document.getElementById("cambioContainer");
                  if (cambio > 0) {
                    cambioContainer.innerHTML = '<tr><td>Cambio:</td><td>' + formatCOP(cambio) + '</td></tr>';
                  } else {
                    cambioContainer.innerHTML = "";
                  }
                }
                document.addEventListener("DOMContentLoaded", () => { updateTotals(); });
                document.getElementById("includeIva").addEventListener("change", updateTotals);
                document.getElementById("printButton").addEventListener("click", () => { updateTotals(); window.print(); });
                document.getElementById("closePreview").addEventListener("click", () => window.close());
              </script>
            </div>

            <div class="invoice-box">
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
                      <td style="word-break: break-word;">${it.product_name}</td>
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
                            <td>Venta a crédito</td>
                        </tr>
                    ` : `
                        <tr>
                            <td><strong>Forma de pago:</strong></td>
                            <td>${sale.cash_payment > 0 && sale.transfer_payment > 0 ? "Mixto" : sale.cash_payment > 0 ? "Efectivo" : "Transferencia"}</td>
                        </tr>
                        ${sale.cash_payment > 0 ? `<tr><td>Efectivo:</td><td>${formatCOP(sale.cash_payment)}</td></tr>` : ""}
                        ${sale.transfer_payment > 0 ? `<tr><td>Transferencia:</td><td>${formatCOP(sale.transfer_payment)}</td></tr>` : ""}
                    `}
                    </tbody>
                </table>
                <table style="width: 95%;"><tbody id="cambioContainer"></tbody></table>
              </div>

              <div class="footer">
                <p>Gracias por su compra</p>
              </div>
            </div>
          </body>
        </html>
      `;
    }

  // Cargar créditos

  async function loadCredits(searchTerm = "") {
    const credits = await window.api.getCredits(searchTerm);
    creditsList.innerHTML = "";

    if (!credits || credits.length === 0) {
      creditsList.innerHTML = `<div class="alert alert-secondary">No hay créditos pendientes.</div>`;
      return;
    }

    credits.forEach(c => {
      const creditCard = document.createElement("div");
      creditCard.classList.add("card", "mb-2", "p-2", "credit-card");
      creditCard.innerHTML = `
        <div>
          <strong>Factura #${c.invoice_number || c.id}</strong> — Cliente: ${c.client_name}
        </div>
        <div>
          Total: ${formatCOP(c.total_amount)} | Abonos: ${formatCOP(c.paid_amount)} | Saldo: <span class="fw-bold text-danger">${formatCOP(c.outstanding_balance)}</span>
        </div>
        <div class="mt-2">
          <button class="btn btn-sm btn-info view-credit-details" data-id="${c.id}">Ver Detalle</button>
        </div>
      `;
      creditsList.appendChild(creditCard);
    });

    creditsList.querySelectorAll(".view-credit-details").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const saleId = Number(e.target.dataset.id);
        showCreditDetails(saleId);
      });
    });
  }

 
  // Buscar créditos

  creditSearchBtn.addEventListener("click", () => {
    const searchTerm = creditSearchInput.value;
    loadCredits(searchTerm);
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
              <button class="btn btn-success w-100 mt-3" id="mark-paid-btn">Marcar como Crédito Pagado</button>
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

    document.getElementById("mark-paid-btn").addEventListener("click", async () => {
      const method = methodSelect.value;
      const reference = document.getElementById("abono-ref").value;
      const res = await window.api.markCreditAsPaid(saleId, method, reference);
      Swal.fire(res.success ? 'Éxito' : 'Error', res.message, res.success ? 'success' : 'error');
      modal.hide();
      await loadCredits();
    });
  }

  // Inicialización
  
  await loadProducts();
  await loadClients();
  await loadFilterClients();
  await loadSales();
  await loadCredits();

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