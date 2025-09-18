
const Database = require("better-sqlite3");
const path = require("node:path");
const fs = require("fs");
let dbPath;

// Detectar si la app está empaquetada
let isPackaged = false;
try {
  isPackaged = require('electron').app.isPackaged;
} catch (e) {}

if (isPackaged) {
  // Carpeta de usuario para la base de datos
  const userData = require('electron').app.getPath('userData');
  dbPath = path.join(userData, "database.sqlite");
  // Si no existe, copiar desde el paquete
  if (!fs.existsSync(dbPath)) {
    const packagedDb = path.join(process.resourcesPath, "app.asar.unpacked", "database.sqlite");
    if (fs.existsSync(packagedDb)) {
      fs.copyFileSync(packagedDb, dbPath);
    } else {
      // fallback: copiar desde el origen del código
      const devDb = path.join(__dirname, "../database.sqlite");
      if (fs.existsSync(devDb)) fs.copyFileSync(devDb, dbPath);
    }
  }
} else {
  dbPath = path.join(__dirname, "../database.sqlite");
}
const db = new Database(dbPath);

// activar foreign keys
db.pragma("foreign_keys = ON");

// ---------------------
// CREAR TABLAS
// MIGRACIÓN: Agregar min_stock si no existe
try {
  const columns = db.prepare("PRAGMA table_info(products)").all();
  if (!columns.some(c => c.name === "min_stock")) {
    db.prepare("ALTER TABLE products ADD COLUMN min_stock INTEGER NOT NULL DEFAULT 0").run();
  }
} catch (e) { /* ignorar errores si ya existe */ }
// ---------------------
db.prepare(`
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  id_card_or_nit TEXT NOT NULL UNIQUE,
  address TEXT,
  email TEXT,
  phone TEXT
)`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  purchase_price REAL,
  sale_price REAL NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0
)`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  sale_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_amount REAL NOT NULL DEFAULT 0,
  invoice_number TEXT UNIQUE,
  FOREIGN KEY (client_id) REFERENCES clients(id)
)`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER,
  product_id INTEGER,
  product_name TEXT,
  product_code TEXT,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  subtotal REAL NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
)`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  quote_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_amount REAL NOT NULL DEFAULT 0,
  quote_number TEXT UNIQUE,
  FOREIGN KEY (client_id) REFERENCES clients(id)
)`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS quote_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER,
  product_id INTEGER,
  product_name TEXT,
  product_code TEXT,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  subtotal REAL NOT NULL,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
)`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS company_settings (
  id INTEGER PRIMARY KEY,
  company_name TEXT,
  company_id_card_or_nit TEXT,
  company_address TEXT,
  company_email TEXT,
  company_phone TEXT,
  logo_path TEXT
)`).run();

// asegurarse fila settings
const countRow = db.prepare("SELECT COUNT(*) as c FROM company_settings").get();
if (countRow.c === 0) db.prepare("INSERT INTO company_settings (id) VALUES (1)").run();

// ---------------------
// HELPERS GENERICOS
// ---------------------
function padNumber(n, len = 3) {
  return String(n).padStart(len, "0");
}

function nextConsecutive(prefix, column, table) {
  // busca última fila con prefix-column y devuelve prefix-XXX incrementado
  const row = db.prepare(`SELECT ${column} as num FROM ${table} WHERE ${column} IS NOT NULL ORDER BY id DESC LIMIT 1`).get();
  if (!row || !row.num) {
    return `${prefix}-${padNumber(1)}`;
  }
  const m = row.num.match(/-(\d+)$/);
  let last = 0;
  if (m) last = parseInt(m[1], 10);
  return `${prefix}-${padNumber(last + 1)}`;
}

// ---------------------
// CLIENTES
// ---------------------
function getClients() {
  return db.prepare("SELECT * FROM clients ORDER BY name").all();
}
function getClientById(id) {
  return db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
}
function saveClient(client) {
  try {
    db.prepare(`INSERT INTO clients (name, id_card_or_nit, address, email, phone) VALUES (?, ?, ?, ?, ?)`)
      .run(client.name, client.id_card_or_nit, client.address, client.email, client.phone);
    return { success: true, message: "Cliente registrado" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}
function updateClient(client) {
  try {
    db.prepare(`UPDATE clients SET name=?, id_card_or_nit=?, address=?, email=?, phone=? WHERE id=?`)
      .run(client.name, client.id_card_or_nit, client.address, client.email, client.phone, client.id);
    return { success: true, message: "Cliente actualizado" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}
function deleteClient(id) {
  try {
    db.prepare("DELETE FROM clients WHERE id=?").run(id);
    return { success: true, message: "Cliente eliminado" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

// ---------------------
// PRODUCTOS
// ---------------------
function getProducts() {
  return db.prepare("SELECT * FROM products ORDER BY name").all();
}
function getProductById(id) {
  return db.prepare("SELECT * FROM products WHERE id = ?").get(id);
}
function addProduct(p) {
  try {
    db.prepare(`INSERT INTO products (code, name, category, purchase_price, sale_price, stock, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(p.code, p.name, p.category || null, p.purchase_price || 0, p.sale_price || 0, p.stock || 0, p.min_stock || 0);
    return { success: true, message: "Producto registrado" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}
function updateProduct(p) {
  try {
    db.prepare(`UPDATE products SET code=?, name=?, category=?, purchase_price=?, sale_price=?, stock=?, min_stock=? WHERE id=?`)
      .run(p.code, p.name, p.category || null, p.purchase_price || 0, p.sale_price || 0, p.stock || 0, p.min_stock || 0, p.id);
    return { success: true, message: "Producto actualizado" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}
function deleteProduct(id) {
  try {
    db.prepare("DELETE FROM products WHERE id=?").run(id);
    return { success: true, message: "Producto eliminado" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}
function getCategories() {
  return db.prepare("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category <> ''").all().map(r => r.category);
}

// ---------------------
// VENTAS
// ---------------------
function createSale({ client_id = null, items = [] }) {
  const insertSale = db.prepare("INSERT INTO sales (client_id, total_amount) VALUES (?, ?)");
  const insertItem = db.prepare("INSERT INTO sale_items (sale_id, product_id, product_name, product_code, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const updateStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
  const getProduct = db.prepare("SELECT id, code, name, stock, sale_price FROM products WHERE id = ?");

  const trx = db.transaction((client_id, items) => {
    const saleRes = insertSale.run(client_id || null, 0);
    const saleId = saleRes.lastInsertRowid;
    let total = 0;
    for (const it of items) {
      const prod = getProduct.get(it.product_id);
      if (!prod) throw new Error(`Producto con id=${it.product_id} no existe`);
      if (prod.stock < it.quantity)
        throw new Error(`Stock insuficiente para ${prod.name}`);
      const price = it.price != null ? it.price : prod.sale_price;
      const subtotal = price * it.quantity;
      total += subtotal;
      insertItem.run(
        saleId,
        prod.id,
        prod.name,
        prod.code,
        it.quantity,
        price,
        subtotal
      );
      updateStock.run(it.quantity, prod.id);
    }
    db.prepare("UPDATE sales SET total_amount = ? WHERE id = ?").run(total, saleId);

    // generar invoice number automático tipo FACT-001
    const last = getLastInvoiceNumber();
    let next;
    if (!last) next = `FACT-${padNumber(1)}`;
    else {
      const m = last.match(/-(\d+)$/);
      const lastNum = m ? parseInt(m[1], 10) : 0;
      next = `FACT-${padNumber(lastNum + 1)}`;
    }
    db.prepare("UPDATE sales SET invoice_number = ? WHERE id = ?").run(next, saleId);

    return saleId;
  });

  try {
    const id = trx(client_id || null, items);
    return { success: true, message: "Venta registrada", id };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function getSales() {
  const sales = db.prepare("SELECT id, client_id, sale_date, total_amount, invoice_number FROM sales ORDER BY sale_date DESC").all();
  const itemsStmt = db.prepare("SELECT id, product_id, product_name, product_code, quantity, price, subtotal FROM sale_items WHERE sale_id = ?");
  for (const s of sales) s.items = itemsStmt.all(s.id);
  return sales;
}

function getSaleById(id) {
  return db.prepare("SELECT * FROM sales WHERE id = ?").get(id);
}
function getSaleItems(saleId) {
  return db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(saleId);
}
function getLastInvoiceNumber() {
  const row = db.prepare("SELECT invoice_number FROM sales WHERE invoice_number IS NOT NULL ORDER BY id DESC LIMIT 1").get();
  return row ? row.invoice_number : null;
}
function setInvoiceNumber(id, invoiceNumber) {
  db.prepare("UPDATE sales SET invoice_number = ? WHERE id = ?").run(invoiceNumber, id);
}

function deleteSale(id) {
  try {
    const items = db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(id);
    for (const it of items) {
      if (it.product_id) db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(it.quantity, it.product_id);
    }
    db.prepare("DELETE FROM sale_items WHERE sale_id = ?").run(id);
    db.prepare("DELETE FROM sales WHERE id = ?").run(id);
    return { success: true, message: "Venta eliminada y stock restaurado" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function deleteSaleItem(id) {
  const item = db.prepare("SELECT * FROM sale_items WHERE id = ?").get(id);
  if (!item) return { success: false, message: "Item no encontrado" };
  const trx = db.transaction((itemId) => {
    if (item.product_id) db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(item.quantity, item.product_id);
    db.prepare("DELETE FROM sale_items WHERE id = ?").run(itemId);
    const newTotalRow = db.prepare("SELECT SUM(subtotal) as total FROM sale_items WHERE sale_id = ?").get(item.sale_id);
    db.prepare("UPDATE sales SET total_amount = ? WHERE id = ?").run(newTotalRow.total || 0, item.sale_id);
  });
  try {
    trx(id);
    return { success: true, message: "Item eliminado y stock restaurado" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

// ---------------------
// COTIZACIONES
// ---------------------
function createQuote({ client_id = null, items = [] }) {
  const insertQuote = db.prepare("INSERT INTO quotes (client_id, total_amount) VALUES (?, ?)");
  const insertItem = db.prepare("INSERT INTO quote_items (quote_id, product_id, product_name, product_code, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const getProduct = db.prepare("SELECT id, code, name, sale_price FROM products WHERE id = ?");

  const trx = db.transaction((client_id, items) => {
    const q = insertQuote.run(client_id || null, 0);
    const quoteId = q.lastInsertRowid;
    let total = 0;
    for (const it of items) {
      const prod = getProduct.get(it.product_id);
      const prodName = prod ? prod.name : (it.product_name || "Producto eliminado");
      const prodCode = prod ? prod.code : (it.product_code || "");
      const price = (it.price != null) ? it.price : (prod ? prod.sale_price : 0);
      const subtotal = price * it.quantity;
      total += subtotal;
      insertItem.run(quoteId, it.product_id, prodName, prodCode, it.quantity, price, subtotal);
    }
    db.prepare("UPDATE quotes SET total_amount = ? WHERE id = ?").run(total, quoteId);

    // asignar número consecutivo a la cotización
    const last = getLastQuoteNumber();
    let next;
    if (!last) next = `COT-${padNumber(1)}`;
    else {
      const m = last.match(/-(\d+)$/);
      const lastNum = m ? parseInt(m[1], 10) : 0;
      next = `COT-${padNumber(lastNum + 1)}`;
    }
    db.prepare("UPDATE quotes SET quote_number = ? WHERE id = ?").run(next, quoteId);

    return quoteId;
  });

  try {
    const id = trx(client_id || null, items);
    return { success: true, message: "Cotización registrada", id };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function getQuotes() {
  const quotes = db.prepare("SELECT id, client_id, quote_date, total_amount, quote_number FROM quotes ORDER BY quote_date DESC").all();
  const itemsStmt = db.prepare("SELECT id, product_id, product_name, product_code, quantity, price, subtotal FROM quote_items WHERE quote_id = ?");
  for (const q of quotes) q.items = itemsStmt.all(q.id);
  return quotes;
}

function getQuoteById(id) { return db.prepare("SELECT * FROM quotes WHERE id = ?").get(id); }
function getQuoteItems(quoteId) { return db.prepare("SELECT * FROM quote_items WHERE quote_id = ?").all(quoteId); }
function getLastQuoteNumber() {
  const row = db.prepare("SELECT quote_number FROM quotes WHERE quote_number IS NOT NULL ORDER BY id DESC LIMIT 1").get();
  return row ? row.quote_number : null;
}
function setQuoteNumber(id, quoteNumber) { db.prepare("UPDATE quotes SET quote_number = ? WHERE id = ?").run(quoteNumber, id); }

function deleteQuote(id) {
  try {
    db.prepare("DELETE FROM quote_items WHERE quote_id = ?").run(id);
    db.prepare("DELETE FROM quotes WHERE id = ?").run(id);
    return { success: true, message: "Cotización eliminada" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

// ---------------------
// DASHBOARD
// ---------------------
function getDashboardData() {
  const clients = db.prepare("SELECT COUNT(*) as c FROM clients").get().c;
  const products = db.prepare("SELECT COUNT(*) as c FROM products").get().c;
  const sales = db.prepare("SELECT COUNT(*) as c FROM sales").get().c;
  const quotes = db.prepare("SELECT COUNT(*) as c FROM quotes").get().c;
  return { clients, products, sales, quotes };
}

// ---------------------
// SETTINGS (company)
// ---------------------
function getCompanySettings() {
  return db.prepare("SELECT * FROM company_settings WHERE id = 1").get();
}
function saveCompanySettings(data) {
  try {
    db.prepare(`UPDATE company_settings SET company_name=?, company_id_card_or_nit=?, company_address=?, company_email=?, company_phone=?, logo_path=? WHERE id = 1`)
      .run(data.company_name, data.company_id_card_or_nit, data.company_address, data.company_email, data.company_phone, data.logo_path || null);
    return { success: true, message: "Ajustes guardados correctamente" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

// ---------------------
// REPORTES DE VENTAS
// ---------------------
function getSalesReport(startDate, endDate) {
  const sales = db.prepare(`
    SELECT id, client_id, sale_date, total_amount, invoice_number
    FROM sales
    WHERE DATE(sale_date) BETWEEN DATE(?) AND DATE(?)
    ORDER BY sale_date ASC
  `).all(startDate, endDate);

  const itemsStmt = db.prepare(`
    SELECT product_name, product_code, quantity, price, subtotal
    FROM sale_items WHERE sale_id = ?
  `);

  for (const s of sales) {
    s.items = itemsStmt.all(s.id);
  }

  const totalGeneral = sales.reduce((acc, s) => acc + s.total_amount, 0);

  return { sales, totalGeneral };
}

// ---------------------
// RESET DB (solo datos, para pruebas)
// ---------------------
function resetDatabase() {
  const trx = db.transaction(() => {
    db.prepare("DELETE FROM sale_items").run();
    db.prepare("DELETE FROM sales").run();
    db.prepare("DELETE FROM quote_items").run();
    db.prepare("DELETE FROM quotes").run();
    db.prepare("DELETE FROM clients").run();
    db.prepare("DELETE FROM products").run();
    db.prepare("UPDATE company_settings SET company_name=NULL, company_id_card_or_nit=NULL, company_address=NULL, company_email=NULL, company_phone=NULL, logo_path=NULL WHERE id = 1").run();
    db.prepare("VACUUM").run();
  });
  try {
    trx();
    return { success: true, message: "Base de datos reiniciada" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}


module.exports = {
  // clients
  getClients, getClientById, saveClient, updateClient, deleteClient,
  // products
  getProducts, getProductById, addProduct, updateProduct, deleteProduct, getCategories,
  // sales
  createSale, getSales, getSaleById, getSaleItems, deleteSale, deleteSaleItem, getLastInvoiceNumber, setInvoiceNumber,
  // quotes
  createQuote, getQuotes, getQuoteById, getQuoteItems, deleteQuote, getLastQuoteNumber, setQuoteNumber,
  // dashboard
  getDashboardData,
  // settings
  getCompanySettings, saveCompanySettings,
  // reset
  resetDatabase,
  //reporte
  getSalesReport
};
