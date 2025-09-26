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
  // -----------------------------
  // Referencias a elementos
  // -----------------------------
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

  // -----------------------------
  // Funciones de carga
  // -----------------------------
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

  // -----------------------------
  // Renderizar items
  // -----------------------------
  function renderSaleItems() {
    saleItemsTbody.innerHTML = "";
    let total = 0;

    saleItems.forEach((it, i) => {
      total += it.subtotal;
      const tr = document.createElement("tr");

      const isKgVariant = it.product_name.toLowerCase().includes("kg");

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
        tr.querySelector(".qty-input").addEventListener("input", (e) => {
          const newQty = parseFloat(e.target.value);
          if (!isNaN(newQty) && newQty > 0) {
            saleItems[i].quantity = newQty;
            saleItems[i].subtotal = saleItems[i].price * newQty;
            renderSaleItems();
          }
        });
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
  // Agregar producto a la venta
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
    
    // --- LÓGICA AGREGADA PARA VARIANTES ---
    if (prod.variants && prod.variants.length > 0) {
        showVariantSelectionModal(prod, qty);
        productInput.value = "";
        qtyInput.value = "1";
        return; 
    }
    // --- FIN DE LÓGICA AGREGADA ---

    if (prod.stock < qty) {
      alert("Stock insuficiente");
      return;
    }
    if (prod.stock <= prod.min_stock) {
      alert(`¡Advertencia! El producto '${prod.name}' está en stock mínimo (${prod.stock} unidades).`);
    }

    const initialPrice = prod.sale_price;

    saleItems.push({
      product_id: prod.id,
      product_code: prod.code,
      product_name: prod.name,
      quantity: qty,
      price: initialPrice,
      sale_price: prod.sale_price,
      special_price: prod.special_price,
      subtotal: initialPrice * qty,
      variant_id: null, 
    });

    renderSaleItems();
    productInput.value = "";
    qtyInput.value = "1";
  });

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

  function findProductByText(term) {
    return allProducts.find(p => `${p.name} (${p.code}) - Stock ${p.stock}` === term);
  }

  function showVariantSelectionModal(prod) {
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
                          ${prod.variants.map(v => 
                              `<option value="${v.id}" data-name="${v.name}" data-price="${v.sale_price}">${v.name} (${formatCOP(v.sale_price)})</option>`
                          ).join('')}
                      </select>
                  </div>
                  <div class="modal-footer">
                      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                      <button type="button" class="btn btn-primary" id="confirm-variant-btn">Agregar a Venta</button>
                  </div>
              </div>
          </div>
      </div>
    `;

    const existingModal = document.getElementById("variantModal");
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('variantModal'));
    modal.show();

    document.getElementById("confirm-variant-btn").addEventListener("click", () => {
        const select = document.getElementById("variant-select");
        const selectedOption = select.options[select.selectedIndex];
        if (!selectedOption.value) {
            alert("Por favor, selecciona una unidad de venta.");
            return;
        }

        const qty = Number(qtyInput.value) || 1;
        
        let selectedVariant = null;
        if (selectedOption.value !== "base") {
            const variantId = Number(selectedOption.value);
            selectedVariant = prod.variants.find(v => v.id === variantId);
        }

        addItemToSale(prod, qty, selectedVariant);
        modal.hide();
    });
  }

  // -----------------------------
  // Finalizar venta
  // -----------------------------
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

    const paidAmount = (saleType === 'credit') ? 0 : totalAmount;
    const outstandingBalance = (saleType === 'credit') ? totalAmount : 0;
    const saleData = {
      client_id: clientId,
      items: saleItems,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      outstanding_balance: outstandingBalance,
      sale_type: saleType
    };

    const res = await window.api.createSale(saleData);
    if (!res.success) {
      alert(res.message);
      return;
    }
    alert(res.message || "Venta registrada exitosamente.");

    saleItems = [];
    renderSaleItems();
    productInput.value = "";
    qtyInput.value = "1";
    clientSelect.value = "";
    saleTypeSelect.value = "cash";

    await loadSales();
    await loadProducts();
    await loadCredits(); 
  });

  // -----------------------------
  // Cargar ventas
  // -----------------------------
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

    salesList.querySelectorAll(".delete-sale").forEach((b) =>
      b.addEventListener("click", async (e) => {
        if (!confirm("Eliminar venta?")) return;
        await window.api.deleteSale(Number(e.target.dataset.id));
        await loadSales();
      })
    );

    salesList.querySelectorAll(".export-invoice").forEach((b) =>
      b.addEventListener("click", async (e) => {
        const id = Number(e.target.dataset.id);
        const withIva = confirm("¿Incluir IVA 19% en la factura? Aceptar = Sí, Cancelar = No");
        const res = await window.api.exportInvoicePDF(id, withIva);
        alert(res.message || JSON.stringify(res));
      })
    );

    function generateInvoiceHtml(sale, items, company, logoBase64, client, printers) {
        return `
          <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { font-family: Arial, sans-serif; font-size: 12px; margin: 15px; }
                h2 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                td, th { border: 1px solid #ccc; padding: 4px; text-align: left; }
                .total { text-align: right; font-weight: bold; }

                .print-options-panel {
                  position: fixed;
                  bottom: 20px;
                  right: 20px;
                  background-color: white;
                  padding: 15px;
                  border: 1px solid #ccc;
                  border-radius: 8px;
                  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                  display: flex;
                  flex-direction: column;
                  gap: 10px;
                  z-index: 9999;
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
                  <option value="80mm">80mm (Ticket)</option>
                  <option value="57mm">57mm (Mini Ticket)</option>
                  <option value="Letter">Carta</option>
                  <option value="Legal">Oficio</option>
                </select>
                <label><input type="checkbox" id="includeIva"> Incluir IVA 19%</label>
                <button id="printButton">Imprimir</button>
                <button id="closePreview">Cerrar</button>

                <script>
                  function formatCOP(value) {
                    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value);
                  }

                  document.getElementById("printButton").addEventListener("click", async () => {
                    const printer = document.getElementById("printerSelect").value;
                    const paperSize = document.getElementById("paperSizeSelect").value;
                    const includeIva = document.getElementById("includeIva").checked;

                    let total = ${sale.total_amount};
                    let ivaText = "";
                    if (includeIva) {
                      const iva = Math.round(total * 0.19);
                      total += iva;
                      ivaText = "<p>IVA (19%): " + formatCOP(iva) + "</p>";
                    }

                    let facturaHtml = document.getElementById("factura").innerHTML 
                                    + ivaText 
                                    + "<p class='total'>TOTAL: " + formatCOP(total) + "</p>"
                                    + "<p style='text-align:center'>Gracias por su compra</p>";

                    // 👉 Ajustes especiales si el tamaño es 57mm
                    if (paperSize === "57mm") {
                      facturaHtml = \`
                        <style>
                          @page { size: 57mm auto; margin: 0; }
                          body { width: 57mm; margin: 0; font-family: Arial, sans-serif; font-size: 8px; }
                          h2 { font-size: 10px; margin: 2px 0; }
                          table { width: 100%; border-collapse: collapse; font-size: 7px; }
                          td, th { border: 1px solid #ccc; padding: 0 1px; }
                          th:nth-child(1), td:nth-child(1) { width: 15%; } /* Código */
                          th:nth-child(2), td:nth-child(2) { width: 35%; font-size: 6.5px; } /* Producto */
                          th:nth-child(3), td:nth-child(3) { width: 10%; text-align: center; } /* Cant */
                          th:nth-child(4), td:nth-child(4) { width: 15%; } /* Precio reducido */
                          th:nth-child(5), td:nth-child(5) { width: 25%; } /* Subtotal ampliado */
                        </style>
                        \` + facturaHtml;
                    }

                    const result = await window.api.printInvoice({ printer, paperSize, htmlContent: facturaHtml });
                    if (result.success) alert(result.message);
                    else alert("Error: " + result.message);
                  });

                  document.getElementById("closePreview").addEventListener("click", () => window.close());
                </script>
              </div>

              <div id="factura">
                <div style="text-align:center; margin-bottom:15px;">
                  ${logoBase64 ? `<img src="${logoBase64}" style="max-height:80px;"><br>` : ""}
                  <h2>${company.company_name || ""}</h2>
                  <p>NIT: ${company.company_id_card_or_nit || ""}</p>
                  <p>${company.company_address || ""}</p>
                  <p>Tel: ${company.company_phone || ""} — ${company.company_email || ""}</p>
                </div>

                <h2>Factura ${sale.invoice_number || `FACT-${sale.id}`}</h2>
                <p>Fecha: ${sale.sale_date}</p>
                <p>Cliente: ${client ? client.name : "N/A"}</p>
                <p>NIT/Cédula: ${client ? client.id_card_or_nit : "N/A"}</p>
                <p>Dirección: ${client ? client.address : "N/A"}</p>
                <p>Teléfono: ${client ? client.phone : "N/A"}</p>

                <table>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Producto</th>
                      <th>Cant</th>
                      <th>Precio</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map(it => `
                      <tr>
                        <td>${it.product_code || ""}</td>
                        <td>${it.product_name}</td>
                        <td>${it.quantity}</td>
                        <td>${formatCOP(it.price)}</td>
                        <td>${formatCOP(it.subtotal)}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
                <p class="total">TOTAL: ${formatCOP(sale.total_amount)}</p>
              </div>
            </body>
          </html>
        `;
      }

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
        await window.api.previewInvoice({ content: htmlContent });
      });
    });
  }

  // -----------------------------
  // Cargar créditos
  // -----------------------------
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

  // -----------------------------
  // Buscar créditos
  // -----------------------------
  creditSearchBtn.addEventListener("click", () => {
    const searchTerm = creditSearchInput.value;
    loadCredits(searchTerm);
  });

  // -----------------------------
  // Modal de detalles de crédito
  // -----------------------------
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

  // -----------------------------
  // Inicialización al cargar la página
  // -----------------------------
  await loadProducts();
  await loadClients();
  await loadSales();
  await loadCredits();
});
