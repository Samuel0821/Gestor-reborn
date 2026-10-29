// Exercises the real quotes renderer across page reloads using an in-memory DOM/storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const renderer = fs.readFileSync(path.join(__dirname, '../src/js/quotes.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../src/views/quotes.html'), 'utf8');
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}
async function loadPage(localStorage, sessionStorage = storage(), overrides = {}) {
  const nodes = new Map();
  class Element {
    constructor() {
      this.value = ''; this.dataset = {}; this.children = []; this.listeners = {}; this.textContent = '';
      this.parentNode = { insertBefore() {} };
      const classes = new Set();
      this.classList = { add: name => classes.add(name), remove: name => classes.delete(name),
        contains: name => classes.has(name), toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) };
    }
    set innerHTML(value) {
      this.markup = value; this.children = [];
      for (const match of value.matchAll(/id="([^"]+)"/g)) if (!nodes.has(match[1])) nodes.set(match[1], new Element());
    }
    get innerHTML() { return this.markup || ''; }
    get options() { return this.children; }
    appendChild(node) { this.children.push(node); }
    querySelectorAll() { return []; }
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    async emit(type, target = this) {
      for (const handler of this.listeners[type] || []) await handler({ target, currentTarget: this, preventDefault() {} });
    }
    focus() {}
    remove() { for (const [id, node] of nodes) if (node === this) nodes.delete(id); }
  }
  for (const match of html.matchAll(/id="([^"]+)"/g)) nodes.set(match[1], new Element());
  nodes.get('quote-quantity').value = '1';
  const document = new Element();
  document.getElementById = id => nodes.get(id) || null;
  document.createElement = () => new Element();
  document.head = new Element();
  const client = { id: 7, name: 'Ana', id_card_or_nit: '123' };
  const product = { id: 1, code: 'P1', name: 'Cable', stock: 20, min_stock: 0, sale_price: 100, special_price: 80, special_price_2: 0 };
  const calls = [];
  const api = { getProducts: async () => [product], getClients: async () => [client], getQuotes: async () => [],
    getClientById: async () => client,
    createQuote: async data => { calls.push({ type: 'create', data }); return { success: true }; },
    updateQuoteDetails: async data => { calls.push({ type: 'update', data }); return { success: true }; }, ...overrides };
  const window = new Element();
  window.api = api;
  const modal = { visible: false };
  const context = { document, window, localStorage, sessionStorage, console, setTimeout, clearTimeout,
    ServiceCommercial: require('../src/js/serviceCommercial'),
    bootstrap: { Modal: class { show() { modal.visible = true; } hide() { modal.visible = false; nodes.get('quote-form-modal').emit('hide.bs.modal'); } } },
    Swal: { fire: async () => ({ isConfirmed: true }) } };
  vm.runInNewContext(renderer, context, { filename: 'quotes.js' });
  await document.emit('DOMContentLoaded');
  return { get: id => nodes.get(id), modal, calls, window };
}
async function main() {
  const local = storage();
  let page = await loadPage(local);
  assert.equal(page.modal.visible, false);
  assert.equal(local.getItem('persistentQuoteDraft'), null);
  await page.get('new-quote-btn').emit('click');
  page.get('quote-product-input').value = page.get('quote-products-list').options[0].value;
  page.get('quote-quantity').value = '2';
  await page.get('quote-form').emit('submit');
  assert.equal(page.get('quote-product-input').value, '');
  page.get('quote-client-input').value = 'Ana (123)';
  await page.get('quote-client-input').emit('input');
  page.get('quote-notes').value = 'Entrega el viernes';
  await page.get('quote-notes').emit('input');
  const priceTarget = { dataset: { i: '0' }, value: '80', classList: { contains: value => value === 'price-selector' } };
  await page.get('quote-items').emit('change', priceTarget);
  page.get('quote-product-input').value = 'Producto por buscar';
  await page.get('quote-product-input').emit('input');
  await page.window.emit('pagehide');
  const expected = JSON.parse(local.getItem('persistentQuoteDraft'));
  page = await loadPage(local);
  assert.equal(page.modal.visible, true, 'Returning to the module must reopen the draft');
  assert.equal(page.get('quote-client-id').value, 7);
  assert.equal(page.get('quote-notes').value, 'Entrega el viernes');
  assert.equal(page.get('quote-product-input').value, 'Producto por buscar');
  assert.equal(page.get('quote-items').children.length, 1);
  assert.equal(JSON.parse(local.getItem('persistentQuoteDraft')).items[0].price, 80, 'Catalog enrichment must preserve the selected price');
  await page.get('quote-form-modal').emit('hide.bs.modal');
  await page.get('new-quote-btn').emit('click');
  assert.deepEqual(JSON.parse(local.getItem('persistentQuoteDraft')), expected, 'Continue must not reset the draft');
  await page.get('finalize-quote').emit('click');
  assert.equal(page.calls[0].data.items[0].quantity, 2);
  assert.equal(page.calls[0].data.items[0].price, 80);
  assert.equal(page.calls[0].data.notes, 'Entrega el viernes');
  assert.equal(local.getItem('persistentQuoteDraft'), null, 'A successful save clears the draft');
  page = await loadPage(local);
  assert.equal(page.modal.visible, false);

  local.setItem('persistentQuoteCart', JSON.stringify([{ product_id: null, product_name: '[SERVICIO] Instalación',
    service_id: 9, service_item_id: 10, quantity: 3, price: 400, subtotal: 1200 }]));
  page = await loadPage(local);
  assert.equal(page.modal.visible, true, 'Legacy carts must migrate and reopen');
  assert.equal(local.getItem('persistentQuoteCart'), null);
  const subtotal = { textContent: '' };
  const serviceTarget = { dataset: { i: '0', field: 'quantity' }, value: '5',
    classList: { contains: value => value === 'service-commercial-input' },
    closest: () => ({ querySelector: () => subtotal }) };
  await page.get('quote-items').emit('input', serviceTarget);
  page = await loadPage(local, storage(), { createQuote: async () => ({ success: false, message: 'Fallo de prueba' }) });
  assert.equal(JSON.parse(local.getItem('persistentQuoteDraft')).items[0].quantity, 5);
  assert.equal(JSON.parse(local.getItem('persistentQuoteDraft')).items[0].service_item_id, 10);
  await page.get('finalize-quote').emit('click');
  assert.notEqual(local.getItem('persistentQuoteDraft'), null, 'A failed save preserves the draft');

  const editDraft = JSON.parse(local.getItem('persistentQuoteDraft'));
  editDraft.editingQuoteId = 42;
  local.setItem('persistentQuoteDraft', JSON.stringify(editDraft));
  page = await loadPage(local);
  assert.equal(page.get('finalize-quote').textContent, 'Actualizar Cotización');
  await page.get('finalize-quote').emit('click');
  assert.equal(page.calls[0].type, 'update', 'Restoring an edit must not create a duplicate quote');
  assert.equal(page.calls[0].data.id, 42);

  page = await loadPage(local);
  page.get('quote-notes').value = 'Borrador sin ítems';
  await page.get('quote-notes').emit('input');
  page = await loadPage(local);
  assert.equal(page.modal.visible, true);
  assert.equal(page.get('quote-notes').value, 'Borrador sin ítems');
  await page.get('discard-quote-draft').emit('click');
  assert.equal(local.getItem('persistentQuoteDraft'), null);
  console.log('OK: draft survives navigation, reopens, preserves client/notes/prices/service links, resumes edits, migrates legacy carts and clears only on save or discard.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
