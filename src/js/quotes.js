document.addEventListener('DOMContentLoaded', async () => {
    console.log('quotes.js cargado');

    // Ahora, todas las variables del DOM se definen dentro del evento
    const clientSelect = document.getElementById('quote-client');
    const productSelect = document.getElementById('quote-product');
    const qtyInput = document.getElementById('quote-quantity');
    const form = document.getElementById('quote-form');
    const quotesList = document.getElementById('quotes-list');
    const quoteItemsTbody = document.getElementById('quote-items');
    const totalDiv = document.getElementById('quote-total');
    const finalizeBtn = document.getElementById('finalize-quote');
    
    let quoteItems = [];

    // Función para formatear valores a pesos colombianos
    function formatCOP(value) {
      return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
      }).format(value);
    }

    // --- Cargar productos
    async function loadProducts() {
      const products = await window.api.getProducts();
      productSelect.innerHTML = "";
      products.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.code}) - Stock ${p.stock}`;
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

    // --- Renderizar ítems de la cotización
    function renderQuoteItems() {
      quoteItemsTbody.innerHTML = "";
      let total = 0;
      quoteItems.forEach((it, i) => {
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
          <td>
            <button class="btn btn-sm btn-danger remove" data-i="${i}">Eliminar</button>
          </td>
        `;
        quoteItemsTbody.appendChild(tr);

        // Agrega el event listener para cambiar el precio
        tr.querySelector('.price-selector')?.addEventListener('change', (e) => {
          const selectedOption = e.target.options[e.target.selectedIndex];
          const newPrice = parseFloat(selectedOption.getAttribute('data-price'));
          quoteItems[i].price = newPrice;
          quoteItems[i].subtotal = newPrice * quoteItems[i].quantity;
          renderQuoteItems();
        });
      });
      totalDiv.textContent = `TOTAL: ${formatCOP(total)}`;
      quoteItemsTbody
        .querySelectorAll(".remove")
        .forEach((b) =>
          b.addEventListener("click", (e) => {
            const i = Number(e.target.dataset.i);
            quoteItems.splice(i, 1);
            renderQuoteItems();
          })
        );
    }
    
    // --- Agregar producto a la cotización
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const prodId = Number(productSelect.value);
        const qty = Number(qtyInput.value) || 1;
        const prod = await window.api.getProductById(prodId);

        if (!prod) {
            alert("Producto no encontrado");
            return;
        }

        if (prod.stock <= prod.min_stock) {
            alert(`¡Advertencia! El producto '${prod.name}' está en stock mínimo (${prod.stock} unidades).`);
        }

        const initialPrice = prod.sale_price;

        quoteItems.push({
            product_id: prod.id,
            product_code: prod.code,
            product_name: prod.name,
            quantity: qty,
            price: initialPrice,
            sale_price: prod.sale_price,
            special_price: prod.special_price,
            subtotal: initialPrice * qty,
        });

        renderQuoteItems();
    });

    // --- Finalizar cotización
    finalizeBtn.addEventListener("click", async () => {
      if (quoteItems.length === 0) {
        alert("No hay items");
        return;
      }
      const clientId = clientSelect.value ? Number(clientSelect.value) : null;
      const res = await window.api.createQuote({ client_id: clientId, items: quoteItems });
      if (!res.success) {
        alert(res.message);
        return;
      }
      alert(res.message || "Cotización creada");
      quoteItems = [];
      renderQuoteItems();
      await loadQuotes();
      await loadProducts(); // Vuelve a cargar productos para actualizar stock si es necesario
    });

    // --- Cargar cotizaciones
    async function loadQuotes() {
      const quotes = await window.api.getQuotes();
      if (!quotes.length) {
        quotesList.innerHTML = '<div class="alert alert-secondary">No hay cotizaciones</div>';
        return;
      }
      quotesList.innerHTML = quotes.map(q => {
        const itemsHtml = (q.items || []).map(i => `<li>${i.product_name} x ${i.quantity} = ${formatCOP(i.subtotal)}</li>`).join('');
        return `<div class="card mb-2 p-2">
          <div><strong>${q.quote_number || `COT-${String(q.id).padStart(3, '0')}`}</strong> — ${q.quote_date} — Total: ${formatCOP(q.total_amount)}
            <div class="float-end">
              <button class="btn btn-sm btn-success export-quote" data-id="${q.id}" data-quote_number="${q.quote_number}">Exportar PDF</button>
              <button class="btn btn-sm btn-primary ms-1 approve-quote" data-id="${q.id}">Aprobar</button>
              <button class="btn btn-sm btn-danger ms-1 delete-quote" data-id="${q.id}">Eliminar</button>
            </div>
          </div><ul>${itemsHtml}</ul></div>`;
      }).join('');

      quotesList.querySelectorAll('.approve-quote').forEach(b => b.addEventListener('click', async (e) => {
        if (!confirm('¿Aprobar esta cotización y convertirla en venta?')) return;
        const quoteId = Number(e.target.dataset.id);
        const res = await window.api.approveQuote(quoteId);
        alert(res.message || JSON.stringify(res));
        await loadQuotes();
        await loadProducts(); // Vuelve a cargar productos para actualizar stock
      }));
      quotesList.querySelectorAll('.delete-quote').forEach(b => b.addEventListener('click', async (e) => {
        if (!confirm('Eliminar cotización?')) return;
        await window.api.deleteQuote(Number(e.target.dataset.id));
        loadQuotes();
      }));
      quotesList.querySelectorAll('.export-quote').forEach(b => b.addEventListener('click', async (e) => {
        const includeIva = confirm('¿Incluir IVA 19% en la cotización?\nAceptar = Sí, Cancelar = No');
        const res = await window.api.exportQuotePDF(Number(e.target.dataset.id), e.target.dataset.quote_number, includeIva);
        alert(res.message || JSON.stringify(res));
      }));
    }

    // Se llaman las funciones de carga solo después de que el DOM esté listo
    await loadProducts();
    await loadClients();
    await loadQuotes();
});