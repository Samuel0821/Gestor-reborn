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
  const clientSelect = document.getElementById("sale-client"); // nuevo

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
        <td>${formatCOP(it.price)}</td>
        <td>${formatCOP(it.subtotal)}</td>
        <td><button class="btn btn-sm btn-danger remove" data-i="${i}">Eliminar</button></td>
      `;
      saleItemsTbody.appendChild(tr);
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
    const price = prod.sale_price;
    saleItems.push({
      product_id: prod.id,
      product_code: prod.code,
      product_name: prod.name,
      quantity: qty,
      price,
      subtotal: price * qty,
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
                <button class="btn btn-sm btn-primary export-invoice" data-id="${s.id}">Facturar</button>
                <button class="btn btn-sm btn-danger ms-1 delete-sale" data-id="${s.id}">Eliminar</button>
              </div>
            </div>
            <ul>${itemsHtml}</ul>
          </div>
        `;
      })
      .join("");

    salesList
      .querySelectorAll(".delete-sale")
      .forEach((b) =>
        b.addEventListener("click", async (e) => {
          if (!confirm("Eliminar venta?")) return;
          await window.api.deleteSale(Number(e.target.dataset.id));
          await loadSales();
        })
      );

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
  }

  await loadProducts();
  await loadClients();
  await loadSales();
});
