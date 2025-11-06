console.log('sales.js cargado');

let saleItems = [];
let allProducts = [];

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
  const saleTypeSelect = document.getElementById("sale-type");
  const creditsList = document.getElementById("credits-list");
  const creditSearchInput = document.getElementById("credit-search-input");
  const creditSearchBtn = document.getElementById("credit-search-btn");
  const barcodeInput = document.getElementById("barcode-input");

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

      const isKgVariant = String(it.product_name).toLowerCase().includes("kg");

      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${it.product_code}</td>
        <td>${it.product_name}</td>
        <td>
          ${isKgVariant 
            ? `<input type="number" min="0.1" step="0.1" value="${it.quantity}" data-i="${i}" class="form-control form-control-sm qty-input">`
            : it.quantity}
        </td>
        <td>
          <select class="form-select form-select-sm price-selector">
            <option value="sale" data-price="${it.sale_price}" ${it.price === it.sale_price ? 'selected' : ''}>${formatCOP(it.sale_price)}</option>
            ${it.special_price > 0 ? `<option value="special" data-price="${it.special_price}" ${it.price === it.special_price ? 'selected' : ''}>${formatCOP(it.special_price)}</option>` : ''}
          </select>
        </td>
        <td>${formatCOP(it.price * it.quantity)}</td>
        <td><button class="btn btn-sm btn-danger remove" data-i="${i}">Eliminar</button></td>
      `;

      saleItemsTbody.appendChild(tr);

      // Cambiar precio desde el selector
      tr.querySelector('.price-selector')?.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const newPrice = parseFloat(selectedOption.getAttribute('data-price'));
        saleItems[i].price = newPrice;
        saleItems[i].subtotal = newPrice * saleItems[i].quantity;
        renderSaleItems();
      });

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
  }

  // -----------------------------
  // Agregar producto manual (formulario)
  // -----------------------------
  saleForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectedProductText = productInput.value;
    const selectedProductOption = Array.from(productDatalist.options).find(
      (opt) => opt.value === selectedProductText
    );

    if (!selectedProductOption) {
      alert("Producto no válido. Selecciona uno de la lista.");
      return;
    }

    const prodId = Number(selectedProductOption.dataset.id);
    const qty = Number(qtyInput.value) || 1;
    const prod = allProducts.find((p) => p.id === prodId);

    if (!prod) {
      alert("Producto no encontrado");
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
      alert("Stock insuficiente");
      return;
    }
    if (prod.stock <= prod.min_stock) {
      alert(`¡Advertencia! El producto '${prod.name}' está en stock mínimo (${prod.stock} unidades).`);
    }

    addItemToSale(prod, qty, null);

    productInput.value = "";
    qtyInput.value = "1";
  });

  // Lector de código (campo visible)
  
  if (barcodeInput) {
    barcodeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const code = barcodeInput.value.trim();
        if (!code) return;

        const prod = allProducts.find((p) => String(p.code) === String(code));
        if (!prod) {
          if (confirm(`Producto con código "${code}" no encontrado. ¿Deseas registrarlo?`)) {
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
    const imageHtml = hasImage ? `<img src="${prod.image_base64}" style="max-width:120px; display:block; margin-bottom:8px;">` : `<div style="width:120px;height:60px;display:flex;align-items:center;justify-content:center;background:#f0f0f0;margin-bottom:8px;color:#666;font-size:12px;">Sin imagen</div>`;

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
        alert("Stock insuficiente");
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
        sale_price: prod.sale_price,
        special_price: prod.special_price,
        subtotal: itemPrice * qty,
        variant_id: variantId
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
        alert("Por favor, selecciona una unidad de venta.");
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
    }
    cashInput.addEventListener("input", updateChange);
    transferInput.addEventListener("input", updateChange);
    updateChange();

    document.getElementById("confirmPaymentBtn").addEventListener("click", async () => {
      const cash = parseFloat(cashInput.value) || 0;
      const transfer = parseFloat(transferInput.value) || 0;
      const totalPaid = cash + transfer;

      if (totalPaid < totalAmount && saleType !== "credit") {
        alert("El monto pagado es insuficiente.");
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
        transfer_payment: transfer
      };

      const res = await window.api.createSale(saleData);
      if (!res.success) {
        alert(res.message);
        return;
      }

      if (cash > 0) {
        const activeSession = await window.api.getActiveCashSession();
        if (activeSession) {
          await window.api.addCashMovement(activeSession.id, "sale", cash, `Venta #${res.id}`);
        }
      }

      alert(res.message || "Venta registrada exitosamente.");
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
    if (saleItems.length === 0) {
      alert("No hay items en la venta.");
      return;
    }
    const clientId = clientSelect.value ? Number(clientSelect.value) : null;
    const saleType = saleTypeSelect.value;
    const totalAmount = saleItems.reduce((sum, item) => sum + item.subtotal, 0);

    if (saleType === 'credit' && !clientId) {
      alert("Para una venta a crédito, debes seleccionar un cliente.");
      return;
    }

    showPaymentModal(totalAmount, clientId, saleType);
  });

  // Cargar ventas

  async function loadSales() {
    const sales = await window.api.getSales();
    if (!sales || sales.length === 0) {
      salesList.innerHTML = '<div class="alert alert-secondary">No hay ventas</div>';
      return;
    }
    salesList.innerHTML = sales.map((s) => {
      const itemsHtml = (s.items || []).map(it => `<li>${it.product_name} x ${it.quantity} = ${formatCOP(it.subtotal)}</li>`).join("");
      return `
        <div class="card mb-2 p-2">
          <div>
            <strong>${s.invoice_number || `FACT-${String(s.id).padStart(3,"0")}`}</strong>
            — ${s.sale_date} — ${formatCOP(s.total_amount)}
            <div class="float-end">
              <button class="btn btn-sm btn-primary export-invoice" data-id="${s.id}">Descargar Factura</button>
              <button class="btn btn-sm btn-success ms-1 print-sale" data-id="${s.id}">Imprimir Factura</button>
              <button class="btn btn-sm btn-danger ms-1 delete-sale" data-id="${s.id}">Eliminar Factura</button>
            </div>
          </div>
          <ul>${itemsHtml}</ul>
        </div>
      `;
    }).join("");

    // eliminar
    salesList.querySelectorAll(".delete-sale").forEach((b) =>
      b.addEventListener("click", async (e) => {
        if (!confirm("Eliminar venta?")) return;
        await window.api.deleteSale(Number(e.target.dataset.id));
        await loadSales();
      })
    );

    // exportar PDF
    salesList.querySelectorAll(".export-invoice").forEach((b) =>
      b.addEventListener("click", async (e) => {
        const id = Number(e.target.dataset.id);
        const withIva = confirm("¿Incluir IVA 19% en la factura? Aceptar = Sí, Cancelar = No");
        const res = await window.api.exportInvoicePDF(id, withIva);
        alert(res.message || JSON.stringify(res));
      })
    );

    // INICIO ajuste impresión
    salesList.querySelectorAll(".print-sale").forEach((b) => {
      b.addEventListener("click", async (e) => {
        const id = Number(e.target.dataset.id);
        const sale = await window.api.getSaleById(id);
        const items = await window.api.getSaleItems(id);
        const company = await window.api.getCompanySettings();
        const logoBase64 = await window.api.getCompanyLogo();
        const client = sale.client_id ? await window.api.getClientById(sale.client_id) : null;

        if (!sale || !items) {
          alert("No se encontró la información de la venta");
          return;
        }

        const printers = await window.api.getPrinters();
        if (!printers || printers.length === 0) {
          alert("No se encontraron impresoras disponibles");
          return;
        }

        const htmlContent = generateInvoiceHtml(sale, items, company, logoBase64, client, printers);

        // Mostrar vista previa primero
        await window.api.previewInvoice({ content: htmlContent });

        // Preguntar impresora
        const printerChoice = prompt(
          `Selecciona impresora:\n${printers.map((p, i) => `${i + 1}. ${p.name}${p.isDefault ? " (Predeterminada)" : ""}`).join("\n")}\n\nEscribe el número o deja vacío para usar la predeterminada:`
        );

        let selectedPrinter = null;
        if (printerChoice) {
          const idx = parseInt(printerChoice, 10) - 1;
          if (printers[idx]) selectedPrinter = printers[idx].name;
        }

        // Imprimir
        await window.api.printInvoice({
          printer: selectedPrinter,
          paperSize: "A4",
          htmlContent,
        });
      });
    });
    // FIN ajuste impresión
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
              @page { margin: 0mm; }
              body { 
                font-family: 'Arial', sans-serif; 
                font-size: 7px;
                color: #333;
                padding: 0;
              }
              .invoice-box {
                padding: 0;
              }
              .header, .footer {
                text-align: center;
                margin-bottom: 2px;
              }
              .header h2 {
                margin: 0;
                font-size: 11px;
                font-weight: bold;
              }
              .header p {
                margin: 1px 0;
                font-size: 8px;
              }
              .info {
                margin-bottom: 2px;
                border-top: 1px dashed #ccc;
                border-bottom: 1px dashed #ccc;
                padding: 2px 0;
              }
              .info p {
                margin: 1px 0;
                font-size: 8px;
              }
              .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 2px;
              }
              .items-table th {
                border-bottom: 1px solid #000;
                padding: 0 1px;
                text-align: left;
                font-weight: bold;
                font-size: 8px;
                line-height: 1.2;
              }
              .items-table td {
                padding: 0 1px;
                border-bottom: 1px dotted #ccc;
                font-size: 8px;
                line-height: 1.2;
              }
              .items-table .col-align-right {
                text-align: right;
              }
              .totals-section, .payment-info-section {
                  margin-top: 1px;
              }
              .totals-section table, .payment-info-section table {
                  font-size: 7px;
              }
              .total-row td {
                font-weight: bold;
                font-size: 8px;
              }
              .footer {
                margin-top: 5px;
                border-top: 1px solid #000;
                padding-top: 2px;
              }
              .print-options-panel {
                position: fixed; bottom: 20px; right: 20px; background-color: white; padding: 15px;
                border: 2px solid #ccc; border-radius: 10px; box-shadow: 0 6px 10px rgba(0,0,0,0.1);
                display: flex; flex-direction: column; gap: 12px; z-index: 9999;
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
              <label>TamaÃ±o de papel:</label>
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
                        '<tr><td>Total bruto:</td><td style="text-align: right;">' + formatCOP(totalBase) + '</td></tr>' +
                        '<tr><td>IVA (19%):</td><td style="text-align: right;">' + formatCOP(iva) + '</td></tr>' +
                        '<tr class="total-row"><td>Total neto:</td><td style="text-align: right;">' + formatCOP(total) + '</td></tr>';
                  } else {
                    extraTotalsBody.innerHTML = '<tr class="total-row"><td>TOTAL:</td><td style="text-align: right;">' + formatCOP(totalBase) + '</td></tr>';
                  }
                  const cambio = pago - total;
                  const cambioContainer = document.getElementById("cambioContainer");
                  if (cambio > 0) {
                    cambioContainer.innerHTML = '<tr><td>Cambio:</td><td style="text-align: right;">' + formatCOP(cambio) + '</td></tr>';
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
                ${logoBase64 ? `<img src="${logoBase64}" style="max-height:70px; margin-bottom: 10px;"><br>` : ""}
                <h2>${company.company_name || ""}</h2>
                <p>NIT: ${company.company_id_card_or_nit || ""}</p>
                <p>${company.company_address || ""}</p>
                <p>Tel: ${company.company_phone || ""} â€” ${company.company_email || ""}</p>
              </div>

              <div class="info">
                <p><strong>Factura:</strong> ${sale.invoice_number || `FACT-${sale.id}`}</p>
                <p><strong>Fecha:</strong> ${sale.sale_date}</p>
                ${client ? `
                <p><strong>Cliente:</strong> ${client.name}</p>
                <p><strong>NIT/Cédula:</strong> ${client.id_card_or_nit}</p>
                <p><strong>Dirección:</strong> ${client.address}</p>
                <p><strong>Teléfono:</strong> ${client.phone}</p>
                ` : ''}
              </div>

              <table class="items-table">
                <colgroup>
                  <col style="width: 10%;">
                  <col style="width: 20%;">
                  <col style="width: 10%;">
                  <col style="width: 25%;">
                  <col style="width: 25%;">
                </colgroup>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th class="col-align-right">Cant</th>
                    <th class="col-align-right">Precio</th>
                    <th class="col-align-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(it => `
                    <tr>
                      <td>${it.product_code || ""}</td>
                      <td style="word-break: break-word;">${it.product_name}</td>
                      <td class="col-align-right">${it.quantity}</td>
                      <td class="col-align-right">${formatCOP(it.price)}</td>
                      <td class="col-align-right">${formatCOP(it.subtotal)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>

              <div class="totals-section">
                <table style="width: 30%;">
                    <tbody id="extraTotals">
                        <tr class="total-row">
                            <td>TOTAL:</td>
                            <td style="text-align: right;">${formatCOP(sale.total_amount)}</td>
                        </tr>
                    </tbody>
                </table>
              </div>

              <div class="payment-info-section">
                <table style="width: 30%;">
                    <tbody>
                    ${sale.sale_type === "credit" ? `
                        <tr>
                            <td><strong>Forma de pago:</strong></td>
                            <td style="text-align: right;">Venta a crédito</td>
                        </tr>
                    ` : `
                        <tr>
                            <td><strong>Forma de pago:</strong></td>
                            <td style="text-align: right;">${sale.sale_type === "cash" ? "Efectivo" : sale.sale_type === "transfer" ? "Transferencia" : "Mixto"}</td>
                        </tr>
                        ${sale.cash_payment > 0 ? `<tr><td>Efectivo:</td><td style="text-align: right;">${formatCOP(sale.cash_payment)}</td></tr>` : ""}
                        ${sale.transfer_payment > 0 ? `<tr><td>Transferencia:</td><td style="text-align: right;">${formatCOP(sale.transfer_payment)}</td></tr>` : ""}
                    `}
                    </tbody>
                </table>
                <table style="width: 30%;"><tbody id="cambioContainer"></tbody></table>
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


  // Modal de detalles de crédito

  async function showCreditDetails(saleId) {
    const sale = await window.api.getSaleById(saleId);
    if (!sale) {
      alert("Crédito no encontrado.");
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

    document.getElementById("add-abono-btn").addEventListener("click", async () => {
      const abonoAmount = Number(document.getElementById("abono-amount").value);
      if (abonoAmount <= 0 || abonoAmount > sale.outstanding_balance) {
        alert("Monto de abono inválido o superior al saldo pendiente.");
        return;
      }

      const res = await window.api.addCreditPayment(saleId, abonoAmount);
      alert(res.message);
      modal.hide();
      await loadCredits();
    });

    document.getElementById("mark-paid-btn").addEventListener("click", async () => {
      const res = await window.api.markCreditAsPaid(saleId);
      alert(res.message);
      modal.hide();
      await loadCredits();
    });
  }

  // Inicialización
  
  await loadProducts();
  await loadClients();
  await loadSales();
  await loadCredits();
});