document.addEventListener('DOMContentLoaded', async () => {
  const clientSelect = document.getElementById('quote-client');
  const quoteItemsDiv = document.getElementById('quote-items');
  const addBtn = document.getElementById('add-quote-item');
  const form = document.getElementById('quote-form');
  const quotesList = document.getElementById('quotes-list');

  let products = [];

  async function loadProducts() {
    products = await window.api.getProducts();
  }
  async function loadClients() {
    const clients = await window.api.getClients();
    clientSelect.innerHTML = '<option value="">Cliente no registrado</option>' + clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  function addRow(defaultProductId) {
    if (!products.length) { alert('No hay productos'); return; }
    const div = document.createElement('div');
    div.className = 'row mb-2 quote-row align-items-center';
    const options = products.map(p => `<option value="${p.id}" data-price="${p.sale_price}" data-code="${p.code}">${p.name} (${p.code})</option>`).join('');
    div.innerHTML = `
      <div class="col-6"><select class="form-select product-select">${options}</select></div>
      <div class="col-3"><input class="form-control quantity" type="number" min="1" value="1"></div>
      <div class="col-3"><button class="btn btn-danger remove">Eliminar</button></div>
    `;
    if (defaultProductId) div.querySelector('.product-select').value = defaultProductId;
    div.querySelector('.remove').addEventListener('click', () => div.remove());
    quoteItemsDiv.appendChild(div);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const items = Array.from(quoteItemsDiv.querySelectorAll('.quote-row')).map(r => {
      const sel = r.querySelector('.product-select');
      const qty = Number(r.querySelector('.quantity').value) || 1;
      const price = Number(sel.selectedOptions[0].dataset.price || 0);
      const code = sel.selectedOptions[0].dataset.code || '';
      const name = sel.selectedOptions[0].textContent.split(' (')[0];
      return { product_id: Number(sel.value), quantity: qty, price, product_code: code, product_name: name };
    }).filter(i => i.product_id && i.quantity > 0);
    // Alerta de stock mínimo
    for (const item of items) {
      const prod = products.find(p => p.id === item.product_id);
      if (prod && prod.stock <= prod.min_stock) {
        alert(`¡Advertencia! El producto '${prod.name}' está en stock mínimo (${prod.stock} unidades).`);
      }
    }
    if (!items.length) { alert('Agrega productos'); return; }
    const data = { client_id: clientSelect.value ? Number(clientSelect.value) : null, items };
    const res = await window.api.createQuote(data);
    alert(res.message || JSON.stringify(res));
    quoteItemsDiv.innerHTML = '';
    await loadQuotes();
  });

  async function loadQuotes() {
    const quotes = await window.api.getQuotes();
    if (!quotes.length) {
      quotesList.innerHTML = '<div class="alert alert-secondary">No hay cotizaciones</div>';
      return;
    }
    quotesList.innerHTML = quotes.map(q => {
      const itemsHtml = (q.items||[]).map(i => `<li>${i.product_name} x ${i.quantity} = ${i.subtotal}</li>`).join('');
      return `<div class="card mb-2 p-2">
        <div><strong>${q.quote_number || `COT-${String(q.id).padStart(3,'0')}`}</strong> — ${q.quote_date} — Total: ${q.total_amount}
          <div class="float-end">
            <button class="btn btn-sm btn-success export-quote" data-id="${q.id}" data-quote_number="${q.quote_number}">Exportar PDF</button>
            <button class="btn btn-sm btn-primary ms-1 approve-quote" data-id="${q.id}">Aprobar</button>
            <button class="btn btn-sm btn-danger ms-1 delete-quote" data-id="${q.id}">Eliminar</button>
          </div>
        </div><ul>${itemsHtml}</ul></div>`;
    }).join('');

    // Listeners fuera del .map()
    quotesList.querySelectorAll('.approve-quote').forEach(b => b.addEventListener('click', async (e) => {
      if (!confirm('¿Aprobar esta cotización y convertirla en venta?')) return;
      const quoteId = Number(e.target.dataset.id);
      const res = await window.api.approveQuote(quoteId);
      alert(res.message || JSON.stringify(res));
      await loadQuotes();
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

  addBtn.addEventListener('click', () => addRow());
  await loadProducts();
  await loadClients();
  loadQuotes();
  addRow();
});
