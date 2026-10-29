// Run with Electron's Node runtime (better-sqlite3 is built for Electron):
// $env:ELECTRON_RUN_AS_NODE='1'; & .\node_modules\electron\dist\electron.exe scripts/test-service-items.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// Optional portable verification when the native Electron binary cannot run.
if (process.argv.includes('--node-sqlite')) {
  const { DatabaseSync } = require('node:sqlite');
  const Module = require('node:module');
  const originalLoad = Module._load;
  class TestDatabase {
    constructor(filename) { this.connection = new DatabaseSync(filename); }
    pragma(sql) { this.connection.exec(`PRAGMA ${sql}`); }
    exec(sql) { this.connection.exec(sql); }
    close() { this.connection.close(); }
    prepare(sql) {
      const statement = this.connection.prepare(sql);
      return {
        run: (...args) => statement.run(...args),
        get: (...args) => { const row = statement.get(...args); return row ? { ...row } : undefined; },
        all: (...args) => statement.all(...args).map(row => ({ ...row }))
      };
    }
    transaction(callback) {
      return (...args) => {
        const savepoint = `test_transaction_${this.depth || 0}`;
        this.depth = (this.depth || 0) + 1;
        this.exec(`SAVEPOINT ${savepoint}`);
        try { const result = callback(...args); this.exec(`RELEASE ${savepoint}`); return result; }
        catch (error) { this.exec(`ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`); throw error; }
        finally { this.depth -= 1; }
      };
    }
  }
  Module._load = function(request, ...args) {
    return request === 'better-sqlite3' ? TestDatabase : originalLoad.call(this, request, ...args);
  };
}
const root = path.resolve(__dirname, '..', '.tools');
fs.mkdirSync(root, { recursive: true });
const directory = fs.mkdtempSync(path.join(root, 'test-services-'));
process.env.GESTORFX_DATABASE_PATH = path.join(directory, 'database.sqlite');
let api;
try {
  api = require('../src/database');
  const { db } = api;
  const { runMigrations } = require('../src/migrations');
  const { normalizeServiceItems } = require('../src/serviceItems');
  const base = { name: 'Instalaciones', description: 'Prueba', products: [] };
  const legacy = api.createService({ ...base, price: 75000 });
  assert.equal(legacy.success, true, legacy.message);

  // Simulate upgrading an installation with the old schema and existing data.
  db.exec('DROP TABLE service_items; DELETE FROM schema_migrations WHERE version = 14');
  const migrated = runMigrations(db, process.env.GESTORFX_DATABASE_PATH, path.join(directory, 'backups'));
  assert.deepEqual(migrated.applied, [14]);
  assert.deepEqual(api.getServiceById(legacy.id).items.map(({ id, ...item }) => item), [{ name: base.name, quantity: 1, price: 75000 }]);
  assert.equal(api.getServiceById(legacy.id).price, 75000);
  assert.deepEqual(runMigrations(db, process.env.GESTORFX_DATABASE_PATH).applied, []);

  db.prepare('INSERT INTO products (code, name, purchase_price, sale_price, stock) VALUES (?, ?, ?, ?, ?)')
    .run('TEST-MAT', 'Material de prueba', 5000, 10000, 10);
  const productId = db.prepare("SELECT id FROM products WHERE code = 'TEST-MAT'").get().id;
  const data = { ...base, price: 1, items: [
    { name: 'Instalación', quantity: 3, price: 50000 },
    { name: 'Configuración', quantity: 2, price: 20000 }
  ], products: [{ product_id: productId, quantity: 2, price: 10000 }] };
  const created = api.createService(data);
  assert.equal(created.success, true, created.message);
  let service = api.getServiceById(created.id);
  assert.equal(service.price, 190000, 'Backend must calculate labor instead of trusting client price');
  assert.equal(service.materials_cost, 20000);
  assert.equal(service.items.length, 2);
  assert.equal(api.getProductById(productId).stock, 8);
  assert.deepEqual(api.getServices().find(s => s.id === created.id).items, service.items);

  const edited = api.updateService({ ...data, id: created.id, items: [{ name: 'Instalación', quantity: 4, price: 60000 }] });
  assert.equal(edited.success, true, edited.message);
  service = api.getServiceById(created.id);
  assert.equal(service.price, 240000);
  assert.equal(service.items.length, 1);
  assert.equal(api.getProductById(productId).stock, 8, 'Labor edits must not consume materials again');

  const beforeCount = db.prepare('SELECT COUNT(*) AS n FROM services').get().n;
  for (const items of [[], [{ name: '', quantity: 1, price: 1 }], [{ name: 'X', quantity: 0, price: 1 }],
    [{ name: 'X', quantity: -1, price: 1 }], [{ name: 'X', quantity: 1, price: -1 }],
    [{ name: 'X', quantity: 1, price: 'incorrecto' }]]) {
    assert.equal(api.createService({ ...data, items }).success, false);
    assert.equal(api.updateService({ ...data, id: created.id, items }).success, false);
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM services').get().n, beforeCount);
  assert.equal(api.getServiceById(created.id).price, 240000);
  assert.equal(api.getProductById(productId).stock, 8);
  assert.equal(normalizeServiceItems({ items: [{ name: 'Fracción', quantity: 1.5, price: 10.25 }] }).price, 15.38);

  assert.equal(api.addServicePayment(created.id, 50000, 'cash', null).success, true);
  const receipt = api.getServicePaymentDetailsForPdf(db.prepare('SELECT MAX(id) AS id FROM service_payments').get().id);
  assert.equal(receipt.totalCost, 260000);
  assert.equal(receipt.balanceAfter, 210000);
  assert.equal(api.getServiceById(created.id).paid_amount, 50000);

  // Persist individual quantities/prices through quotes and sales; never consume reserved material twice.
  const items = service.items.map(item => ({ product_id: null, product_code: 'SERV', product_name: item.name,
    quantity: item.quantity, price: item.price, subtotal: item.quantity * item.price, service_id: created.id }));
  items.push({ product_id: productId, product_code: 'TEST-MAT', product_name: 'Material de prueba',
    quantity: 2, price: 10000, subtotal: 20000, skip_stock: true });
  const quote = api.createQuote({ items });
  assert.equal(quote.success, true, quote.message);
  const quoteItems = api.getQuoteItems(quote.id);
  assert.equal(quoteItems[0].quantity, 4);
  assert.equal(quoteItems[0].price, 60000);
  const sale = api.createSale({ items, service_id: created.id, cash_payment: 210000 });
  assert.equal(sale.success, true, sale.message);
  assert.equal(api.getSaleItems(sale.id)[0].quantity, 4);
  assert.equal(api.getSaleById(sale.id).total_amount, 260000);
  assert.equal(api.getProductById(productId).stock, 8);
  assert.equal(api.getServiceById(created.id).status, 'Finalizado');

  // Service-only controls: products keep their existing behavior.
  const commercial = require('../src/js/serviceCommercial');
  const productRow = { product_id: productId, quantity: 2, price: 10000 };
  assert.equal(commercial.edit(productRow, 'price', '123'), false);
  assert.equal(productRow.price, 10000);
  const commercialRow = { service_id: created.id, quantity: 2, price: 10000 };
  assert.equal(commercial.edit(commercialRow, 'quantity', '3'), true);
  assert.equal(commercialRow.subtotal, 30000);
  commercial.edit(commercialRow, 'price', '25000');
  assert.equal(commercialRow.subtotal, 75000);
  commercial.edit(commercialRow, 'quantity', '');
  assert.equal(commercial.inputsValid([commercialRow]), false);

  const linked = api.createService({ ...base, items: [
    { name: 'Instalación A', quantity: 2, price: 50000 },
    { name: 'Instalación B', quantity: 1, price: 25000 }
  ] });
  assert.equal(linked.success, true);
  const original = api.getServiceById(linked.id);
  const linkedItems = original.items.map(item => ({ service_id: linked.id, service_item_id: item.id,
    product_id: null, product_code: 'SERV', product_name: item.name, quantity: item.quantity, price: item.price, subtotal: item.quantity * item.price }));
  linkedItems[0].quantity = 3;
  linkedItems[0].price = 60000;
  assert.equal(api.getServiceById(linked.id).price, 125000, 'Unsaved draft must not change the service');
  const linkedQuote = api.createQuote({ items: linkedItems });
  assert.equal(linkedQuote.success, true, linkedQuote.message);
  assert.equal(api.getServiceById(linked.id).price, 205000);
  assert.equal(api.getServiceById(linked.id).status, 'Cotizado');
  const reloadedQuote = api.getQuoteById(linkedQuote.id);
  assert.equal(reloadedQuote.items[0].service_item_id, original.items[0].id);
  assert.equal(reloadedQuote.items[0].service_id, linked.id);
  reloadedQuote.items[1].quantity = 4;
  reloadedQuote.items[1].price = 30000;
  const requoted = api.updateQuoteDetails({ id: linkedQuote.id, client_id: null, notes: null, items: reloadedQuote.items });
  assert.equal(requoted.success, true, requoted.message);
  assert.equal(api.getServiceById(linked.id).price, 300000);
  assert.equal(api.getServiceById(linked.id).items[1].quantity, 4);

  const invalidQuoteItems = api.getQuoteById(linkedQuote.id).items;
  invalidQuoteItems[0].price = 99999;
  invalidQuoteItems.push({ product_id: -999, product_name: 'Inexistente', quantity: 1, price: 10 });
  assert.equal(api.createQuote({ items: invalidQuoteItems }).success, false);
  assert.equal(api.getServiceById(linked.id).price, 300000, 'Failed quote must roll back service edits');

  const finalItems = api.getQuoteById(linkedQuote.id).items;
  finalItems[0].quantity = 5;
  finalItems[0].price = 70000;
  const failedSale = api.createSale({ items: [...finalItems, { product_id: productId, product_name: 'Sin stock', quantity: 9999, price: 10000 }] });
  assert.equal(failedSale.success, false);
  assert.equal(api.getServiceById(linked.id).price, 300000, 'Failed sale must roll back service edits and status');
  assert.equal(api.getServiceById(linked.id).status, 'Cotizado');
  const linkedSale = api.createSale({ items: finalItems, cash_payment: 470000 });
  assert.equal(linkedSale.success, true, linkedSale.message);
  assert.equal(api.getServiceById(linked.id).price, 470000);
  assert.equal(api.getServiceById(linked.id).items[0].quantity, 5);
  assert.equal(api.getServiceById(linked.id).items[0].price, 70000);
  assert.equal(api.getServiceById(linked.id).status, 'Finalizado');
  assert.equal(api.getSaleItems(linkedSale.id)[0].service_item_id, original.items[0].id);
  assert.equal(api.getProductById(productId).stock, 8);
  assert.equal(api.createSale({ items: finalItems }).success, false, 'A service cannot be sold twice');

  // Reopened quotes retain the link when approved through the dedicated transaction.
  const approvalService = api.createService({ ...base, items: [{ name: 'Revisión', quantity: 1, price: 10000 }] });
  const approvalItem = api.getServiceById(approvalService.id).items[0];
  const approvalQuote = api.createQuote({ items: [{ service_id: approvalService.id, service_item_id: approvalItem.id,
    product_name: '[SERVICIO] Revisión', quantity: 2, price: 15000 }] });
  assert.equal(approvalQuote.success, true, approvalQuote.message);
  const approval = api.createSaleFromQuote({ quote_id: approvalQuote.id,
    items: api.getQuoteById(approvalQuote.id).items, cash_payment: 30000 });
  assert.equal(approval.success, true, approval.message);
  assert.equal(api.getQuoteById(approvalQuote.id).status, 'approved');
  assert.equal(api.getServiceById(approvalService.id).price, 30000);
  assert.equal(api.getServiceById(approvalService.id).status, 'Finalizado');

  const pending = api.createService({ ...base, price: 10000 });
  const pendingItem = api.getServiceById(pending.id).items[0];
  const invalidLinked = { service_id: pending.id, service_item_id: pendingItem.id,
    product_name: '[SERVICIO] Prueba', quantity: 0, price: 15000 };
  assert.equal(api.createQuote({ items: [invalidLinked] }).success, false);
  assert.equal(api.getServiceById(pending.id).status, 'Abierto');
  assert.equal(api.getServiceById(pending.id).price, 10000);
  assert.equal(api.createQuote({ items: [{ ...invalidLinked, quantity: 1, service_item_id: approvalItem.id }] }).success, false);
  assert.equal(api.getServiceById(pending.id).price, 10000, 'A foreign labor ID must never update another service');

  assert.equal(api.deleteService(legacy.id).success, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM service_items WHERE service_id = ?').get(legacy.id).n, 0);
  console.log('OK: migrations, legacy compatibility, editable service fields, atomic quote/sale synchronization, document links, validation, payments, quote approval and inventory.');
} finally {
  api?.db.close();
  if (path.dirname(directory) !== root || !path.basename(directory).startsWith('test-services-')) {
    throw new Error('Unexpected test directory');
  }
  fs.rmSync(directory, { recursive: true, force: true });
}
