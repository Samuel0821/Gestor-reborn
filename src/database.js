const Database = require("better-sqlite3");
const path = require("node:path");
const fs = require("fs");
let dbPath;

// Detectar si la app está empaquetada
let isPackaged = false;
try {
  isPackaged = require('electron').app.isPackaged;
} catch (e) {
  // Manejo de error si no se está en un entorno de Electron (por ejemplo, en un script de prueba)
}

if (isPackaged) {
  // Ruta de la base de datos en la carpeta de datos del usuario
  const userData = require('electron').app.getPath('userData');
  dbPath = path.join(userData, "database.sqlite");
  // Si no existe, copiar desde el paquete empaquetado
  if (!fs.existsSync(dbPath)) {
    // La base de datos empaquetada se encuentra en process.resourcesPath en la raíz del paquete
    const packagedDb = path.join(process.resourcesPath, "database.sqlite");
    // Si la base de datos empaquetada existe, la copiamos.
    if (fs.existsSync(packagedDb)) {
      fs.copyFileSync(packagedDb, dbPath);
    }
  }
} else {
  // Modo de desarrollo
  dbPath = path.join(__dirname, "../database.sqlite");
}

const db = new Database(dbPath);

// activar foreign keys
db.pragma("foreign_keys = ON");

//MIGRACIONES

// MIGRACIÓN: Agregar min_stock si no existe
try {
  const columns = db.prepare("PRAGMA table_info(products)").all();
  if (!columns.some(c => c.name === "min_stock")) {
    db.prepare("ALTER TABLE products ADD COLUMN min_stock INTEGER NOT NULL DEFAULT 0").run();
  }
} catch (e) { /* ignorar errores si ya existe */ }

//Migración para agregar pagos en sales
try {
  const salesColumns = db.prepare("PRAGMA table_info(sales)").all();
  if (!salesColumns.some(c => c.name === "cash_payment")) {
    db.prepare("ALTER TABLE sales ADD COLUMN cash_payment REAL NOT NULL DEFAULT 0").run();
  }
  if (!salesColumns.some(c => c.name === "transfer_payment")) {
    db.prepare("ALTER TABLE sales ADD COLUMN transfer_payment REAL NOT NULL DEFAULT 0").run();
  }
} catch (e) { /* ignorar */ }

// TABLAS
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
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
)`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  category_id INTEGER,
  purchase_price REAL,
  sale_price REAL NOT NULL,
  special_price REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
)`).run();

// 1. Crear tabla de proveedores (similar a la de clientes)
db.prepare(`
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  nit TEXT UNIQUE,
  address TEXT,
  email TEXT,
  phone TEXT
)`).run();

// Añadir la tabla de variantes de productos
db.prepare(`
CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sale_price REAL NOT NULL,
  conversion_factor REAL NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
)`).run();

// 2. Añadir columna para relacionar producto con proveedor
try {
  const productCols = db.prepare("PRAGMA table_info(products)").all();
  if (!productCols.some(c => c.name === "supplier_id")) {
    db.prepare("ALTER TABLE products ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL").run();
  }
} catch(e) { /* ignorar si ya existe */ }

db.prepare(`
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_amount REAL NOT NULL DEFAULT 0,
  po_number TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
)`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT,
  product_code TEXT,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL, -- purchase_price
  subtotal REAL NOT NULL,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
)`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  sale_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  outstanding_balance REAL NOT NULL DEFAULT 0,
  sale_type TEXT NOT NULL DEFAULT 'cash',
  invoice_number TEXT UNIQUE,
  cash_payment REAL NOT NULL DEFAULT 0,
  transfer_payment REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
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

// CAJA REGISTRADORA
// Sesiones de caja (apertura/cierre)
db.prepare(`
  CREATE TABLE IF NOT EXISTS cash_register_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TEXT,
    opening_balance REAL NOT NULL,
    closing_balance REAL,
    expected_balance REAL,
    difference REAL,
    status TEXT NOT NULL DEFAULT 'open'
  )
`).run();

// Movimientos de caja (ventas, entradas/salidas manuales)
db.prepare(`
  CREATE TABLE IF NOT EXISTS cash_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'sale', 'in', 'out'
    description TEXT,
    amount REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES cash_register_sessions(id)
  )
`).run();

// Pagos por venta (para manejar efectivo/transferencia/mixto)
db.prepare(`
  CREATE TABLE IF NOT EXISTS sale_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    method TEXT NOT NULL, -- 'cash', 'transfer'
    amount REAL NOT NULL,
    received REAL, -- solo aplica si es efectivo
    change REAL,   -- solo aplica si es efectivo
    FOREIGN KEY (sale_id) REFERENCES sales(id)
  )
`).run();

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

// HELPERS GENERICOS
function padNumber(n, len = 3) {
  return String(n).padStart(len, "0");
}

function nextConsecutive(prefix, column, table) {
  const row = db.prepare(`SELECT ${column} as num FROM ${table} WHERE ${column} IS NOT NULL ORDER BY id DESC LIMIT 1`).get();
  if (!row || !row.num) {
    return `${prefix}-${padNumber(1)}`;
  }
  const m = row.num.match(/-(\d+)$/);
  let last = 0;
  if (m) last = parseInt(m[1], 10);
  return `${prefix}-${padNumber(last + 1)}`;
}

// CLIENTES
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

// PROVEEDORES
function getSuppliers() {
  return db.prepare("SELECT * FROM suppliers ORDER BY name").all();
}

function getSupplierById(id) {
  return db.prepare("SELECT * FROM suppliers WHERE id = ?").get(id);
}

function saveSupplier(supplier) {
  try {
    const res = db.prepare(`INSERT INTO suppliers (name, nit, address, email, phone) VALUES (?, ?, ?, ?, ?)`).run(supplier.name, supplier.nit, supplier.address, supplier.email, supplier.phone);
    return { success: true, message: "Proveedor registrado", id: res.lastInsertRowid };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function updateSupplier(supplier) {
  try {
    db.prepare(`UPDATE suppliers SET name=?, nit=?, address=?, email=?, phone=? WHERE id=?`).run(supplier.name, supplier.nit, supplier.address, supplier.email, supplier.phone, supplier.id);
    return { success: true, message: "Proveedor actualizado" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function deleteSupplier(id) {
  db.prepare("DELETE FROM suppliers WHERE id=?").run(id);
  return { success: true, message: "Proveedor eliminado" };
}

function getSuppliersCount() {
  return db.prepare("SELECT COUNT(*) as c FROM suppliers").get().c;
}

// CATEGORÍAS
function getCategories() {
  return db.prepare("SELECT * FROM categories ORDER BY name").all();
}

function addCategory(name) {
  try {
    db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
    return { success: true, message: "Categoría agregada" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function updateCategory(id, name) {
  try {
    db.prepare("UPDATE categories SET name=? WHERE id=?").run(name, id);
    return { success: true, message: "Categoría actualizada" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function deleteCategory(id) {
  try {
    db.prepare("DELETE FROM categories WHERE id=?").run(id);
    return { success: true, message: "Categoría eliminada" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

// PRODUCTOS
function getProducts() {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name, s.name as supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN suppliers s ON p.supplier_id = s.id
    ORDER BY p.name
  `).all();
  // Obtener variantes para cada producto
  const getVariants = db.prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY name");
  for (const p of products) {
      p.variants = getVariants.all(p.id);
  }
  return products;
}

function getProductById(id) {
  return db.prepare("SELECT * FROM products WHERE id = ?").get(id);
}

// Helper: asegura que exista la categoría y devuelve su id
function ensureCategoryId(categoryName) {
  if (!categoryName) return null;
  let row = db.prepare("SELECT id FROM categories WHERE name=?").get(categoryName);
  if (row) return row.id;
  const res = db.prepare("INSERT INTO categories (name) VALUES (?)").run(categoryName);
  return res.lastInsertRowid;
}

function addProduct(p) {
  try {
    const catId = ensureCategoryId(p.category);
    const result = db.transaction(() => {
        const productRes = db.prepare(`
            INSERT INTO products (code, name, category, category_id, purchase_price, sale_price, special_price, stock, min_stock, supplier_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            p.code,
            p.name,
            p.category || null,
            catId,
            p.purchase_price || 0,
            p.sale_price || 0,
            p.special_price || 0,
            p.stock || 0,
            p.min_stock || 0,
            p.supplier_id || null
        );
        const productId = productRes.lastInsertRowid;
        if (p.variants && p.variants.length > 0) {
            const insertVariant = db.prepare(`
                INSERT INTO product_variants (product_id, name, sale_price, conversion_factor)
                VALUES (?, ?, ?, ?)
            `);
            for (const v of p.variants) {
                insertVariant.run(productId, v.name, v.sale_price, v.conversion_factor);
            }
        }
        return productId;
    })();
    return { success: true, message: "Producto registrado", id: result };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function updateProduct(p) {
  try {
    const catId = ensureCategoryId(p.category);
    db.transaction(() => {
        db.prepare(`
            UPDATE products
            SET code=?, name=?, category=?, category_id=?, purchase_price=?, sale_price=?, special_price=?, stock=?, min_stock=?, supplier_id=?
            WHERE id=?
        `).run(
            p.code,
            p.name,
            p.category || null,
            catId,
            p.purchase_price || 0,
            p.sale_price || 0,
            p.special_price || 0,
            p.stock || 0,
            p.min_stock || 0,
            p.supplier_id || null,
            p.id
        );
        // Borrar variantes antiguas e insertar nuevas
        db.prepare("DELETE FROM product_variants WHERE product_id=?").run(p.id);
        if (p.variants && p.variants.length > 0) {
            const insertVariant = db.prepare(`
                INSERT INTO product_variants (product_id, name, sale_price, conversion_factor)
                VALUES (?, ?, ?, ?)
            `);
            for (const v of p.variants) {
                insertVariant.run(p.id, v.name, v.sale_price, v.conversion_factor);
            }
        }
    })();
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

// Ajuste createSale para registrar pagos
function createSale({ 
  client_id = null, 
  items = [], 
  sale_type = "cash", 
  paid_amount = 0, 
  outstanding_balance = 0, 
  cash_payment = 0, 
  transfer_payment = 0 
}) {
  const insertSale = db.prepare(`
    INSERT INTO sales (
      client_id, total_amount, sale_date, sale_type, paid_amount, outstanding_balance,
      cash_payment, transfer_payment
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPayment = db.prepare(`
    INSERT INTO sale_payments (sale_id, method, amount, received, change)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO sale_items (sale_id, product_id, product_name, product_code, quantity, price, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const updateStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
  const getProduct = db.prepare("SELECT id, code, name, stock FROM products WHERE id = ?");
  const getVariant = db.prepare("SELECT * FROM product_variants WHERE id = ?");

  const trx = db.transaction((client_id, items, cash_payment, transfer_payment) => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;

    let total = 0;
    for (const it of items) {
      let price, stockToDecrement;
      const prod = getProduct.get(it.product_id);
      if (!prod) throw new Error(`Producto con id=${it.product_id} no existe`);

      if (it.variant_id) {
        const variant = getVariant.get(it.variant_id);
        if (!variant) throw new Error(`Variante con id=${it.variant_id} no existe`);
        price = it.price ?? variant.sale_price;
        stockToDecrement = it.quantity * variant.conversion_factor;
      } else {
        price = it.price ?? prod.sale_price;
        stockToDecrement = it.quantity;
      }

      if (prod.stock < stockToDecrement) throw new Error(`Stock insuficiente para ${prod.name}`);
      total += price * it.quantity;
    }

    const finalPaid = (sale_type === 'credit') ? paid_amount : (cash_payment + transfer_payment);
    const finalOutstanding = (sale_type === 'credit') ? outstanding_balance : 0;

    const saleRes = insertSale.run(
      client_id || null,
      total,
      formattedDate,
      sale_type,
      finalPaid,
      finalOutstanding,
      cash_payment,
      transfer_payment
    );
    const saleId = saleRes.lastInsertRowid;

    for (const it of items) {
      const prod = getProduct.get(it.product_id);
      insertItem.run(
        saleId,
        it.product_id,
        it.product_name,
        prod ? prod.code : "",
        it.quantity,
        it.price,
        it.subtotal
      );

      if (it.variant_id) {
        const variant = getVariant.get(it.variant_id);
        if (variant) updateStock.run(it.quantity * variant.conversion_factor, it.product_id);
      } else {
        updateStock.run(it.quantity, it.product_id);
      }
    }

    // registrar pagos
    if (cash_payment > 0) {
      const change = Math.max((cash_payment + transfer_payment) - total, 0);
      insertPayment.run(saleId, "cash", cash_payment, cash_payment, change);
    }
    if (transfer_payment > 0) {
      insertPayment.run(saleId, "transfer", transfer_payment, null, null);
    }
    // consecutivo factura
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
    const id = trx(client_id, items, cash_payment, transfer_payment);
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
    db.transaction(() => {
      const items = db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(id);
      for (const it of items) {
        if (it.product_id) {
          db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(it.quantity, it.product_id);
        }
      }
      // Eliminar pagos asociados a la venta
      db.prepare("DELETE FROM sale_payments WHERE sale_id = ?").run(id);
      
      // Eliminar movimiento de caja asociado
      db.prepare("DELETE FROM cash_movements WHERE type = 'sale' AND description = ?").run(`Venta #${id}`);

      // Eliminar la venta (esto deberÃ­a disparar el borrado en cascada de sale_items)
      db.prepare("DELETE FROM sales WHERE id = ?").run(id);
    })();
    return { success: true, message: "Venta eliminada completamente y stock restaurado" };
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

    // GESTIÓN DE CRÉDITOS
    // Obtiene todos los créditos pendientes, opcionalmente filtrados por cliente.
    function getCredits(searchTerm) {
        let query = `
            SELECT
                s.id, s.invoice_number, s.sale_date, s.total_amount, s.paid_amount, s.outstanding_balance,
                c.name as client_name
            FROM sales s
            LEFT JOIN clients c ON s.client_id = c.id
            WHERE s.sale_type = 'credit' AND s.outstanding_balance > 0
        `;
        const params = [];

        if (searchTerm) {
            query += ` AND c.name LIKE ?`;
            params.push(`%${searchTerm}%`);
        }

        return db.prepare(query).all(params);
    }

     // Registra un abono a un crédito.
    function addCreditPayment(saleId, amount) {
        try {
            const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId);
            if (!sale) {
                return { success: false, message: "Venta no encontrada." };
            }

            if (amount > sale.outstanding_balance) {
                return { success: false, message: "El monto del abono es mayor que el saldo pendiente." };
            }

            const newPaidAmount = sale.paid_amount + amount;
            let newOutstandingBalance = sale.outstanding_balance - amount;
            let newSaleType = sale.sale_type;

            if (newOutstandingBalance <= 0) {
                newOutstandingBalance = 0;
                newSaleType = 'paid';
            }

            db.prepare("UPDATE sales SET paid_amount = ?, outstanding_balance = ?, sale_type = ? WHERE id = ?")
                .run(newPaidAmount, newOutstandingBalance, newSaleType, saleId);

            return { success: true, message: "Abono registrado exitosamente." };
        } catch (err) {
            return { success: false, message: `Error al registrar abono: ${err.message}` };
        }
    }

    // Marca un crédito como pagado.
    function markCreditAsPaid(saleId) {
        try {
            const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId);
            if (!sale) {
                return { success: false, message: "Venta no encontrada." };
            }

            db.prepare("UPDATE sales SET paid_amount = total_amount, outstanding_balance = 0, sale_type = 'paid' WHERE id = ?")
                .run(saleId);

            return { success: true, message: "Crédito marcado como pagado." };
        } catch (err) {
            return { success: false, message: `Error al marcar crédito como pagado: ${err.message}` };
        }
    }

// COTIZACIONES
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
      const prodName = it.product_name || (prod ? prod.name : "Producto eliminado");
      const prodCode = prod ? prod.code : (it.product_code || "");
      const price = (it.price != null) ? it.price : (prod ? prod.sale_price : 0);
      const subtotal = price * it.quantity;
      total += subtotal;
      insertItem.run(quoteId, it.product_id, prodName, prodCode, it.quantity, price, subtotal);
    }
    db.prepare("UPDATE quotes SET total_amount = ? WHERE id = ?").run(total, quoteId);
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

//  Actualiza el estado de una cotización
function updateQuote({ id, status }) {
  try {
    const stmt = db.prepare("ALTER TABLE quotes ADD COLUMN status TEXT DEFAULT 'pending'");
    // Intentamos agregar columna, pero puede fallar si ya existe
    stmt.run();
  } catch (e) {
    // ignorar si ya existe
  }

  const update = db.prepare("UPDATE quotes SET status = ? WHERE id = ?");
  const info = update.run(status, id);
  return info.changes > 0;
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

// DASHBOARD
function getDashboardData() {
  const clients = db.prepare("SELECT COUNT(*) as c FROM clients").get().c;
  const products = db.prepare("SELECT COUNT(*) as c FROM products").get().c;
  const sales = db.prepare("SELECT COUNT(*) as c FROM sales").get().c;
  const quotes = db.prepare("SELECT COUNT(*) as c FROM quotes").get().c;
  return { clients, products, sales, quotes };
}

// SETTINGS (company)
function getCompanySettings() {
  return db.prepare("SELECT * FROM company_settings WHERE id = 1").get();
}

function updateCompanySettings(s) {
  try {
    db.prepare(`
      UPDATE company_settings SET
        company_name = ?,
        company_id_card_or_nit = ?,
        company_address = ?,
        company_email = ?,
        company_phone = ?,
        logo_path = ?
      WHERE id = 1
    `).run(
      s.company_name || null,
      s.company_id_card_or_nit || null,
      s.company_address || null,
      s.company_email || null,
      s.company_phone || null,
      s.logo_path || null
    );
    return { success: true, message: "Datos de la empresa actualizados correctamente" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

// Función adicional para compatibilidad con llamadas previas
function saveCompanySettings(s) {
  return updateCompanySettings(s);
}

// INVENTARIO Y REPORTES
// Función para obtener el valor total del inventario
function getInventoryTotalValue() {
  const result = db.prepare("SELECT SUM(stock * purchase_price) as total FROM products").get();
  return result.total || 0;
}

function getInventory() {
  const products = db.prepare("SELECT * FROM products ORDER BY name").all();
  const totalValue = getInventoryTotalValue();
  return { products, totalValue };
}

// generar reportes de ventas (diario, semanal, mensual)
function getSalesReport({ startDate, endDate, reportType = "daily" }) {
  try {
    let groupByClause;
    if (reportType === "weekly") {
      groupByClause = "strftime('%Y-%W', sale_date)";
    } else if (reportType === "monthly") {
      groupByClause = "strftime('%Y-%m', sale_date)";
    } else {
      groupByClause = "date(sale_date)"; // daily por defecto
    }

    const start = startDate + " 00:00:00";
    const end = endDate + " 23:59:59";

    const salesStmt = db.prepare(`
      SELECT GROUP_CONCAT(id) as sale_ids
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ?
      GROUP BY ${groupByClause}
      ORDER BY ${groupByClause} DESC
    `);
    const rows = salesStmt.all(start, end);

    const itemsStmt = db.prepare(`
      SELECT product_name, quantity, price, subtotal
      FROM sale_items
      WHERE sale_id = ?
    `);

    const paymentsStmt = db.prepare(`
      SELECT method, amount, received, change
      FROM sale_payments
      WHERE sale_id = ?
    `);

    const detailedSales = rows.flatMap(r => {
      const saleIds = r.sale_ids.split(",").map(id => parseInt(id));
      return saleIds.map(sid => {
        const sale = db.prepare(`
          SELECT id, invoice_number, sale_date, total_amount,
                 paid_amount, outstanding_balance, sale_type
          FROM sales WHERE id = ?
        `).get(sid);

        const items = itemsStmt.all(sid);
        const payments = paymentsStmt.all(sid);

        let cash_payment = 0;
        let transfer_payment = 0;

        for (const p of payments) {
          if (p.method === "cash") {
            // efectivo real = recibido - cambio
            cash_payment += (p.received || 0) - (p.change || 0);
          } else if (p.method === "transfer") {
            transfer_payment += p.amount || 0;
          }
        }

        return {
          ...sale,
          items,
          cash_payment,
          transfer_payment
        };
      });
    });

    const totalGeneral = detailedSales.reduce((acc, s) => acc + s.total_amount, 0);
    const totalCash = detailedSales.reduce((acc, s) => acc + (s.cash_payment || 0), 0);
    const totalTransfer = detailedSales.reduce((acc, s) => acc + (s.transfer_payment || 0), 0);
    const totalCredit = detailedSales.reduce((acc, s) => acc + (s.outstanding_balance || 0), 0);

    return { 
      sales: detailedSales, 
      totalGeneral, 
      totalCash, 
      totalTransfer, 
      totalCredit 
    };
  } catch (err) {
    console.error("Error en getSalesReport:", err);
    return { sales: [], totalGeneral: 0, totalCash: 0, totalTransfer: 0, totalCredit: 0 };
  }
}

// ORDENES DE COMPRA (Purchase Orders)
function createPurchaseOrder({ supplier_id, items = [] }) {
  const insertPO = db.prepare("INSERT INTO purchase_orders (supplier_id, total_amount) VALUES (?, ?)");
  const insertItem = db.prepare("INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, product_code, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const getProduct = db.prepare("SELECT id, code, name, purchase_price FROM products WHERE id = ?");

  const trx = db.transaction((supplier_id, items) => {
    const po = insertPO.run(supplier_id, 0);
    const poId = po.lastInsertRowid;
    let total = 0;
    for (const it of items) {
      const prod = getProduct.get(it.product_id);
      const prodName = prod ? prod.name : "Producto no encontrado";
      const prodCode = prod ? prod.code : "";
      const price = (it.price != null) ? it.price : (prod ? prod.purchase_price : 0);
      const subtotal = price * it.quantity;
      total += subtotal;
      insertItem.run(poId, it.product_id, prodName, prodCode, it.quantity, price, subtotal);
    }
    db.prepare("UPDATE purchase_orders SET total_amount = ? WHERE id = ?").run(total, poId);
    
    // Generar número consecutivo para la orden de compra
    const poNumber = nextConsecutive("OC", "po_number", "purchase_orders");
    db.prepare("UPDATE purchase_orders SET po_number = ? WHERE id = ?").run(poNumber, poId);
    
    return poId;
  });

  try {
    const id = trx(supplier_id, items);
    return { success: true, message: "Orden de Compra creada", id };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function getPurchaseOrders() {
  const orders = db.prepare(`
    SELECT po.*, s.name as supplier_name 
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    ORDER BY po.order_date DESC
  `).all();
  const itemsStmt = db.prepare("SELECT * FROM purchase_order_items WHERE purchase_order_id = ?");
  for (const o of orders) {
    o.items = itemsStmt.all(o.id);
  }
  return orders;
}

function getPurchaseOrderById(id) {
  const order = db.prepare("SELECT po.*, s.name as supplier_name, s.address as supplier_address, s.phone as supplier_phone, s.email as supplier_email FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.id WHERE po.id = ?").get(id);
  if (order) order.items = db.prepare("SELECT * FROM purchase_order_items WHERE purchase_order_id = ?").all(id);
  return order;
}

function receivePurchaseOrder(orderId) {
  const getOrder = db.prepare("SELECT * FROM purchase_orders WHERE id = ?");
  const getOrderItems = db.prepare("SELECT * FROM purchase_order_items WHERE purchase_order_id = ?");
  const updateProductStock = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
  const updateOrderStatus = db.prepare("UPDATE purchase_orders SET status = 'completed' WHERE id = ?");

  const trx = db.transaction((id) => {
    const order = getOrder.get(id);
    if (!order) {
      throw new Error("Orden de compra no encontrada.");
    }
    if (order.status !== 'pending') {
      throw new Error("La orden de compra ya ha sido procesada.");
    }

    const items = getOrderItems.all(id);
    for (const item of items) {
      updateProductStock.run(item.quantity, item.product_id);
    }

    updateOrderStatus.run(id);
    return { success: true, message: "Orden de compra recibida y stock actualizado." };
  });

  try {
    return trx(orderId);
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function deletePurchaseOrder(id) {
  try {
    db.prepare("DELETE FROM purchase_order_items WHERE purchase_order_id = ?").run(id);
    db.prepare("DELETE FROM purchase_orders WHERE id = ?").run(id);
    return { success: true, message: "Orden de compra eliminada" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function updatePurchaseOrder({ id, supplier_id, order_date, items = [] }) {
    const updatePO = db.prepare("UPDATE purchase_orders SET supplier_id = ?, order_date = ?, total_amount = ? WHERE id = ?");
    const deleteItems = db.prepare("DELETE FROM purchase_order_items WHERE purchase_order_id = ?");
    const insertItem = db.prepare("INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, product_code, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)");
    const getProduct = db.prepare("SELECT id, code, name FROM products WHERE id = ?");

    const trx = db.transaction((id, supplier_id, order_date, items) => {
        let total = 0;
        for (const it of items) {
            total += it.subtotal;
        }
        updatePO.run(supplier_id, order_date, total, id);
        deleteItems.run(id);
        for (const it of items) {
            const prod = getProduct.get(it.product_id);
            const prodName = prod ? prod.name : "Producto no encontrado";
            const prodCode = prod ? prod.code : "";
            insertItem.run(id, it.product_id, prodName, prodCode, it.quantity, it.price, it.subtotal);
        }
        return id;
    });

    try {
        const updatedId = trx(id, supplier_id, order_date, items);
        return { success: true, message: "Orden de Compra actualizada", id: updatedId };
    } catch (err) {
        return { success: false, message: String(err) };
    }
}

module.exports = {
  db, 
  // clientes
  getClients, getClientById, saveClient, updateClient, deleteClient,
  // proveedores
  getSuppliers,
  getSupplierById,
  saveSupplier,
  updateSupplier,
  deleteSupplier,
  getSuppliersCount,
  // categorias
  getCategories, addCategory, updateCategory, deleteCategory,
  // productos
  getProducts, getProductById, addProduct, updateProduct, deleteProduct,
  // ventas
  createSale, getSales, getSaleById, getSaleItems, deleteSale, deleteSaleItem,
  getLastInvoiceNumber, setInvoiceNumber,
  // creditos
  getCredits, addCreditPayment, markCreditAsPaid,
  // cotizaciones
  createQuote, getQuotes, getQuoteById, getQuoteItems, deleteQuote, updateQuote,
  getLastQuoteNumber, setQuoteNumber,
  // dashboard
  getDashboardData,
  // company
  getCompanySettings, updateCompanySettings, saveCompanySettings,
  // inventario
  getInventory, getInventoryTotalValue,
  // reportes
  getSalesReport
  // Ordenes de compra,
  ,createPurchaseOrder, getPurchaseOrders, getPurchaseOrderById, receivePurchaseOrder, deletePurchaseOrder, updatePurchaseOrder
};