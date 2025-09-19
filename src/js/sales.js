console.log('sales.js cargado');

let saleItems = [];

function formatCOP(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);
}

document.addEventListener("DOMContentLoaded", async () => {
  const productSelect = document.getElementById("sale-product");
  const qtyInput = document.getElementById("sale-quantity");
  const saleForm = document.getElementById("sale-form");
  const saleItemsTbody = document.getElementById("sale-items");
  const totalDiv = document.getElementById("sale-total");
  const finalizeBtn = document.getElementById("finalize-sale");
  const salesList = document.getElementById("sales-list");
  const clientSelect = document.getElementById("sale-client");

  // --- Cargar productos
  async function loadProducts() {
    const products = await window.api.getProducts();
    productSelect.innerHTML = "";
    products.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.code}) - Stock ${p.stock}`;
      opt.dataset.price = p.sale_price;
      opt.dataset.stock = p.stock;
      productSelect.appendChild(opt);
    });
  }

  // --- Cargar clientes
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

  // --- Render items
  function renderSaleItems() {
    saleItemsTbody.innerHTML = "";
    let total = 0;

    saleItems.forEach((it, i) => {
      total += it.subtotal;
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${it.product_code}</td>
        <td>${it.product_name}</td>
        <td>${it.quantity}</td>
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

      tr.querySelector('.price-selector')?.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const newPrice = parseFloat(selectedOption.getAttribute('data-price'));
        saleItems[i].price = newPrice;
        saleItems[i].subtotal = newPrice * saleItems[i].quantity;
        renderSaleItems();
      });
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

  // --- Agregar producto
  saleForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const prodId = Number(productSelect.value);
    const qty = Number(qtyInput.value) || 1;
    const prod = await window.api.getProductById(prodId);
    if (!prod) {
      alert("Producto no encontrado");
      return;
    }
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
    });

    renderSaleItems();
  });

  // --- Finalizar venta
  finalizeBtn.addEventListener("click", async () => {
    if (saleItems.length === 0) {
      alert("No hay items");
      return;
    }
    const clientId = clientSelect.value ? Number(clientSelect.value) : null;
    const res = await window.api.createSale({ client_id: clientId, items: saleItems });
    if (!res.success) {
      alert(res.message);
      return;
    }
    alert(res.message || "Venta creada");
    saleItems = [];
    renderSaleItems();
    await loadSales();
    await loadProducts();
  });

  // --- Cargar ventas
  async function loadSales() {
    const sales = await window.api.getSales();
    if (!sales || sales.length === 0) {
      salesList.innerHTML =
        '<div class="alert alert-secondary">No hay ventas</div>';
      return;
    }
    salesList.innerHTML = sales
      .map((s) => {
        const itemsHtml = (s.items || [])
          .map(
            (it) =>
              `<li>${it.product_name} x ${it.quantity} = ${formatCOP(
                it.subtotal
              )}</li>`
          )
          .join("");
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
      })
      .join("");

    // --- Eliminar factura
    salesList
      .querySelectorAll(".delete-sale")
      .forEach((b) =>
        b.addEventListener("click", async (e) => {
          if (!confirm("Eliminar venta?")) return;
          await window.api.deleteSale(Number(e.target.dataset.id));
          await loadSales();
        })
      );

    // --- Exportar factura PDF
    salesList
      .querySelectorAll(".export-invoice")
      .forEach((b) =>
        b.addEventListener("click", async (e) => {
          const id = Number(e.target.dataset.id);
          const withIva = confirm(
            "¿Incluir IVA 19% en la factura? Aceptar = Sí, Cancelar = No"
          );
          const res = await window.api.exportInvoicePDF(id, withIva);
          alert(res.message || JSON.stringify(res));
        })
      );

    // --- Imprimir factura
    salesList
      .querySelectorAll(".print-sale")
      .forEach((b) =>
        b.addEventListener("click", async (e) => {
          const id = Number(e.target.dataset.id);
          const sale = await window.api.getSaleById(id);
          const items = await window.api.getSaleItems(id);

          if (!sale || !items) {
            alert("No se encontró la información de la venta");
            return;
          }

          // 1. Obtener impresoras disponibles
          const printers = await window.api.getPrinters();
          if (!printers || printers.length === 0) {
            alert("No se encontraron impresoras disponibles");
            return;
          }

          // Crear selector de impresoras y tamaño
          const container = document.createElement("div");
          container.style.position = "fixed";
          container.style.top = "0";
          container.style.left = "0";
          container.style.width = "100%";
          container.style.height = "100%";
          container.style.background = "rgba(0,0,0,0.5)";
          container.style.display = "flex";
          container.style.alignItems = "center";
          container.style.justifyContent = "center";
          container.style.zIndex = "9999";

          const modal = document.createElement("div");
          modal.classList.add("bg-white", "p-3", "rounded");
          modal.style.minWidth = "300px";
          modal.innerHTML = `
            <h5>Imprimir factura</h5>
            <label class="form-label mt-2">Selecciona impresora:</label>
            <select class="form-select" id="printerSelect">
              ${printers.map(p => `<option value="${p.name}" ${p.isDefault ? "selected" : ""}>${p.name}${p.isDefault ? " (Predeterminada)" : ""}</option>`).join("")}
            </select>
            <label class="form-label mt-3">Tamaño de papel:</label>
            <select class="form-select" id="paperSizeSelect">
              <option value="A4">A4</option>
              <option value="80mm">80mm</option>
            </select>
            <div class="text-end mt-3">
              <button class="btn btn-secondary me-2" id="cancelPrint">Cancelar</button>
              <button class="btn btn-success" id="confirmPrint">Imprimir</button>
            </div>
          `;
          container.appendChild(modal);
          document.body.appendChild(container);

          // Eventos botones
          modal.querySelector("#cancelPrint").addEventListener("click", () => {
            document.body.removeChild(container);
          });

          modal.querySelector("#confirmPrint").addEventListener("click", async () => {
            const printer = modal.querySelector("#printerSelect").value;
            const paperSize = modal.querySelector("#paperSizeSelect").value;

            const htmlContent = `
              <html>
                <head>
                  <meta charset="UTF-8">
                  <style>
                    body { font-family: Arial, sans-serif; font-size: 12px; }
                    h2 { text-align: center; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    td, th { border: 1px solid #ccc; padding: 4px; text-align: left; }
                    .total { text-align: right; font-weight: bold; }
                  </style>
                </head>
                <body>
                  <h2>Factura ${sale.invoice_number || `FACT-${sale.id}`}</h2>
                  <p>Fecha: ${sale.sale_date}</p>
                  <p>Cliente: ${sale.client_name || "N/A"}</p>
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cant</th>
                        <th>Precio</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${items.map(it => `
                        <tr>
                          <td>${it.product_name}</td>
                          <td>${it.quantity}</td>
                          <td>${formatCOP(it.price)}</td>
                          <td>${formatCOP(it.subtotal)}</td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                  <p class="total">TOTAL: ${formatCOP(sale.total_amount)}</p>
                </body>
              </html>
            `;

            const result = await window.api.printInvoice({
              printer,
              paperSize,
              htmlContent,
            });

            alert(result.message || "Factura enviada a imprimir");
            document.body.removeChild(container);
          });
        })
      );
  }

  await loadProducts();
  await loadClients();
  await loadSales();
});
