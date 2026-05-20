const Database = require("better-sqlite3");
const path = require("node:path");
const fs = require("fs");
const crypto = require("crypto");
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
    db.prepare("ALTER TABLE products ADD COLUMN min_stock REAL NOT NULL DEFAULT 0").run();
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

// MIGRACIÓN: Agregar referencia (banco) a pagos de venta
try {
  const spColumns = db.prepare("PRAGMA table_info(sale_payments)").all();
  if (!spColumns.some(c => c.name === "reference")) {
    db.prepare("ALTER TABLE sale_payments ADD COLUMN reference TEXT").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar purchase_price a product_variants para cálculo correcto de utilidad
try {
  const pvColumns = db.prepare("PRAGMA table_info(product_variants)").all();
  if (!pvColumns.some(c => c.name === "purchase_price")) {
    db.prepare("ALTER TABLE product_variants ADD COLUMN purchase_price REAL DEFAULT 0").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar skip_stock a quote_items para evitar doble descuento en servicios
try {
  const qiColumns = db.prepare("PRAGMA table_info(quote_items)").all();
  if (!qiColumns.some(c => c.name === "skip_stock")) {
    db.prepare("ALTER TABLE quote_items ADD COLUMN skip_stock INTEGER DEFAULT 0").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar variant_id a quote_items para que se guarde la referencia a la variante
try {
  const qiColumns = db.prepare("PRAGMA table_info(quote_items)").all();
  if (!qiColumns.some(c => c.name === "variant_id")) {
    db.prepare("ALTER TABLE quote_items ADD COLUMN variant_id INTEGER").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar variant_id a service_products para soportar variantes en servicios
try {
  const spColumns = db.prepare("PRAGMA table_info(service_products)").all();
  if (!spColumns.some(c => c.name === "variant_id")) {
    db.prepare("ALTER TABLE service_products ADD COLUMN variant_id INTEGER").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar price a service_products para guardar el precio seleccionado
try {
  const spColumns = db.prepare("PRAGMA table_info(service_products)").all();
  if (!spColumns.some(c => c.name === "price")) {
    db.prepare("ALTER TABLE service_products ADD COLUMN price REAL DEFAULT 0").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar notes a quotes
try {
  const qCols = db.prepare("PRAGMA table_info(quotes)").all();
  if (!qCols.some(c => c.name === "notes")) {
    db.prepare("ALTER TABLE quotes ADD COLUMN notes TEXT").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar status a services
try {
  const sCols = db.prepare("PRAGMA table_info(services)").all();
  if (!sCols.some(c => c.name === "status")) {
    db.prepare("ALTER TABLE services ADD COLUMN status TEXT DEFAULT 'Abierto'").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar scheduled_date y performed_at a services
try {
  const sCols = db.prepare("PRAGMA table_info(services)").all();
  if (!sCols.some(c => c.name === "scheduled_date")) {
    db.prepare("ALTER TABLE services ADD COLUMN scheduled_date DATE").run();
  }
  if (!sCols.some(c => c.name === "performed_at")) {
    db.prepare("ALTER TABLE services ADD COLUMN performed_at DATETIME").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Tabla de pagos de servicios (Abonos)
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS service_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      method TEXT NOT NULL, -- 'cash', 'transfer'
      reference TEXT,
      date DATETIME DEFAULT (DATETIME('now', 'localtime')),
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
    )
  `).run();
} catch (e) { console.error("Error migración service_payments:", e); }

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
  special_price_2 REAL NOT NULL DEFAULT 0,
  stock REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0,
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
  special_price REAL NOT NULL DEFAULT 0,
  special_price_2 REAL NOT NULL DEFAULT 0,
  conversion_factor REAL NOT NULL,
  purchase_price REAL DEFAULT 0,
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
  status TEXT NOT NULL DEFAULT 'pending', 
  notes TEXT,
  supplier_invoice_number TEXT,
  payment_status TEXT DEFAULT 'pending',
  paid_amount REAL DEFAULT 0,
  outstanding_balance REAL DEFAULT 0,
  include_iva INTEGER DEFAULT 0,
  due_date DATE,
  discount_amount REAL DEFAULT 0,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
)`).run();

// MIGRACIÓN: Agregar notas a órdenes de compra (Ejecutar DESPUÉS de crear la tabla)
try {
  const poColumns = db.prepare("PRAGMA table_info(purchase_orders)").all();
  if (!poColumns.some(c => c.name === "notes")) {
    db.prepare("ALTER TABLE purchase_orders ADD COLUMN notes TEXT").run();
  }
} catch (e) { /* ignorar */ }

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
  receipt_number TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active', 
  due_date DATE,
  notes TEXT,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
)`).run();

// MIGRACIÓN: Agregar receipt_number a sales para recibos de caja
try {
  const sCols = db.prepare("PRAGMA table_info(sales)").all();
  if (!sCols.some(c => c.name === "receipt_number")) {
    db.prepare("ALTER TABLE sales ADD COLUMN receipt_number TEXT").run();
    try { db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_receipt_number ON sales(receipt_number)").run(); } catch(e) {}
  }
} catch (e) { console.error("Error migración receipt_number:", e); }

// MIGRACIÓN: Agregar notes a sales para observaciones en recibos
try {
  const sCols = db.prepare("PRAGMA table_info(sales)").all();
  if (!sCols.some(c => c.name === "notes")) {
    db.prepare("ALTER TABLE sales ADD COLUMN notes TEXT").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Tabla de pagos de compras y columnas financieras en purchase_orders
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS purchase_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_id INTEGER,
      date TEXT,
      amount REAL,
      method TEXT,
      reference TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT (DATETIME('now', 'localtime')),
      FOREIGN KEY(purchase_order_id) REFERENCES purchase_orders(id)
    )
  `).run();

  const poColumns = db.prepare("PRAGMA table_info(purchase_orders)").all();
  if (!poColumns.some(c => c.name === 'supplier_invoice_number')) {
    db.prepare("ALTER TABLE purchase_orders ADD COLUMN supplier_invoice_number TEXT").run();
  }
  if (!poColumns.some(c => c.name === 'payment_status')) {
    db.prepare("ALTER TABLE purchase_orders ADD COLUMN payment_status TEXT DEFAULT 'pending'").run(); // pending, partial, paid
  }
  if (!poColumns.some(c => c.name === 'paid_amount')) {
    db.prepare("ALTER TABLE purchase_orders ADD COLUMN paid_amount REAL DEFAULT 0").run();
  }
  if (!poColumns.some(c => c.name === 'outstanding_balance')) {
    db.prepare("ALTER TABLE purchase_orders ADD COLUMN outstanding_balance REAL DEFAULT 0").run();
  }
} catch (e) { console.error("Error migración purchase_payments:", e); }

// MIGRACIÓN: Agregar include_iva a purchase_orders
try {
  const poColumns = db.prepare("PRAGMA table_info(purchase_orders)").all();
  if (!poColumns.some(c => c.name === "include_iva")) {
    db.prepare("ALTER TABLE purchase_orders ADD COLUMN include_iva INTEGER DEFAULT 0").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar retenciones a purchase_payments
try {
  const ppColumns = db.prepare("PRAGMA table_info(purchase_payments)").all();
  if (!ppColumns.some(c => c.name === "retention_amount")) {
    db.prepare("ALTER TABLE purchase_payments ADD COLUMN retention_amount REAL DEFAULT 0").run();
    db.prepare("ALTER TABLE purchase_payments ADD COLUMN retention_type TEXT").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar due_date a purchase_orders
try {
  const poColumns = db.prepare("PRAGMA table_info(purchase_orders)").all();
  if (!poColumns.some(c => c.name === "due_date")) {
    db.prepare("ALTER TABLE purchase_orders ADD COLUMN due_date DATE").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar descuento a órdenes de compra
try {
  const poCols = db.prepare("PRAGMA table_info(purchase_orders)").all();
  if (!poCols.some(c => c.name === "discount_amount")) {
    db.prepare("ALTER TABLE purchase_orders ADD COLUMN discount_amount REAL DEFAULT 0").run();
  }
} catch (e) { console.error("Error migración discount_amount:", e); }

// GASTOS (EXPENSES) - Se crea aquí para asegurar que exista antes de la migración de la columna 'details'
db.prepare(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT,
    amount REAL,
    category TEXT,
    date TEXT,
    details TEXT,
    created_at DATETIME DEFAULT (DATETIME('now', 'localtime'))
  )
`).run();

// MIGRACIÓN: Agregar created_at a expenses si no existe y poblar con localtime
try {
  const expCols = db.prepare("PRAGMA table_info(expenses)").all();
  if (!expCols.some(c => c.name === "created_at")) {
    db.prepare("ALTER TABLE expenses ADD COLUMN created_at DATETIME").run();
    // Para registros existentes, usar la columna 'date' si solo tiene fecha, o CURRENT_TIMESTAMP si no hay nada
    db.prepare("UPDATE expenses SET created_at = DATETIME(date || ' 00:00:00', 'localtime') WHERE created_at IS NULL AND date IS NOT NULL").run();
    db.prepare("UPDATE expenses SET created_at = DATETIME('now', 'localtime') WHERE created_at IS NULL").run();
  }
} catch (e) { console.error("Error migración created_at en expenses:", e); }

// MIGRACIÓN: Agregar detalles (JSON) a gastos para devoluciones
try {
  const expCols = db.prepare("PRAGMA table_info(expenses)").all();
  if (!expCols.some(c => c.name === "details")) {
    db.prepare("ALTER TABLE expenses ADD COLUMN details TEXT").run();
  }
} catch (e) { console.error("Error migración details en expenses:", e); }

// MIGRACIÓN: Agregar método y referencia a expenses (efectivo / transferencia)
try {
  const expCols2 = db.prepare("PRAGMA table_info(expenses)").all();
  if (!expCols2.some(c => c.name === "method")) {
    db.prepare("ALTER TABLE expenses ADD COLUMN method TEXT DEFAULT 'cash'").run();
  }
  if (!expCols2.some(c => c.name === "reference")) {
    db.prepare("ALTER TABLE expenses ADD COLUMN reference TEXT").run();
  }
} catch (e) { console.error("Error migración method/reference en expenses:", e); }

// MIGRACIÓN: Agregar special_price_2 y special_price_3 a products
try {
  const pColumns = db.prepare("PRAGMA table_info(products)").all();
  if (!pColumns.some(c => c.name === "special_price_2")) {
    db.prepare("ALTER TABLE products ADD COLUMN special_price_2 REAL NOT NULL DEFAULT 0").run();
  }
  // special_price_3 ha sido eliminado por solicitud.
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar special_price y special_price_2 a product_variants
try {
  const pvColumns = db.prepare("PRAGMA table_info(product_variants)").all();
  if (!pvColumns.some(c => c.name === "special_price")) {
    db.prepare("ALTER TABLE product_variants ADD COLUMN special_price REAL NOT NULL DEFAULT 0").run();
  }
  if (!pvColumns.some(c => c.name === "special_price_2")) {
    db.prepare("ALTER TABLE product_variants ADD COLUMN special_price_2 REAL NOT NULL DEFAULT 0").run();
  }
} catch (e) { /* ignorar */ }

db.prepare(`
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER,
  product_id INTEGER,
  product_name TEXT,
  product_code TEXT,
  serial_number TEXT,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  subtotal REAL NOT NULL,
  variant_id INTEGER,
  conversion_factor REAL DEFAULT 1,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
)`).run();

// MIGRACIÓN: Agregar conversion_factor a sale_items (Ejecutar DESPUÉS de crear la tabla)
try {
  const siColumns = db.prepare("PRAGMA table_info(sale_items)").all();
  if (!siColumns.some(c => c.name === "conversion_factor")) {
    db.prepare("ALTER TABLE sale_items ADD COLUMN conversion_factor REAL DEFAULT 1").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar variant_id a sale_items (Ejecutar DESPUÉS de crear la tabla)
try {
  const siColumns = db.prepare("PRAGMA table_info(sale_items)").all();
  if (!siColumns.some(c => c.name === "variant_id")) {
    db.prepare("ALTER TABLE sale_items ADD COLUMN variant_id INTEGER").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar status a sales (active, annulled)
try {
  const sCols = db.prepare("PRAGMA table_info(sales)").all();
  if (!sCols.some(c => c.name === "status")) {
    db.prepare("ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'active'").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar due_date a sales para créditos
try {
  const sCols = db.prepare("PRAGMA table_info(sales)").all();
  if (!sCols.some(c => c.name === "due_date")) {
    db.prepare("ALTER TABLE sales ADD COLUMN due_date DATE").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar serial_number a sale_items para control de garantías
try {
  const siCols = db.prepare("PRAGMA table_info(sale_items)").all();
  if (!siCols.some(c => c.name === "serial_number")) {
    db.prepare("ALTER TABLE sale_items ADD COLUMN serial_number TEXT").run();
  }
} catch (e) { /* ignorar */ }

// MIGRACIÓN: Agregar skip_stock a sale_items para evitar doble descuento en servicios
try {
  const siColumns = db.prepare("PRAGMA table_info(sale_items)").all();
  if (!siColumns.some(c => c.name === "skip_stock")) {
    db.prepare("ALTER TABLE sale_items ADD COLUMN skip_stock INTEGER DEFAULT 0").run();
  }
} catch (e) { /* ignorar */ }

// CAJA REGISTRADORA
// Sesiones de caja (apertura/cierre)
db.prepare(`
  CREATE TABLE IF NOT EXISTS cash_register_sessions ( 
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opened_at TEXT NOT NULL DEFAULT (DATETIME('now', 'localtime')),
    closed_at TEXT, 
    opening_balance REAL NOT NULL,
    closing_balance REAL,
    expected_balance REAL,
    difference REAL, 
    status TEXT NOT NULL DEFAULT 'open',
    user_id INTEGER,
    user_name TEXT,
    opening_notes TEXT,
    closing_notes TEXT,
    closed_by_user_id INTEGER,
    closed_by_user_name TEXT,
    opening_ip TEXT,
    closing_ip TEXT
  )
`).run();

// MIGRACIÓN: Agregar columnas de usuario y notas a cash_register_sessions
try {
  const sessionCols = db.prepare("PRAGMA table_info(cash_register_sessions)").all();
  if (!sessionCols.some(c => c.name === "user_id")) {
    db.prepare("ALTER TABLE cash_register_sessions ADD COLUMN user_id INTEGER").run();
  }
  if (!sessionCols.some(c => c.name === "user_name")) {
    db.prepare("ALTER TABLE cash_register_sessions ADD COLUMN user_name TEXT").run();
  }
  if (!sessionCols.some(c => c.name === "opening_notes")) {
    db.prepare("ALTER TABLE cash_register_sessions ADD COLUMN opening_notes TEXT").run();
  }
  if (!sessionCols.some(c => c.name === "closing_notes")) {
    db.prepare("ALTER TABLE cash_register_sessions ADD COLUMN closing_notes TEXT").run();
  }
  if (!sessionCols.some(c => c.name === "closed_by_user_id")) {
    db.prepare("ALTER TABLE cash_register_sessions ADD COLUMN closed_by_user_id INTEGER").run();
  }
  if (!sessionCols.some(c => c.name === "closed_by_user_name")) {
    db.prepare("ALTER TABLE cash_register_sessions ADD COLUMN closed_by_user_name TEXT").run();
  }
  if (!sessionCols.some(c => c.name === "opening_ip")) {
    db.prepare("ALTER TABLE cash_register_sessions ADD COLUMN opening_ip TEXT").run();
  }
  if (!sessionCols.some(c => c.name === "closing_ip")) {
    db.prepare("ALTER TABLE cash_register_sessions ADD COLUMN closing_ip TEXT").run();
  }
} catch (e) { console.error("Error migración cash_register_sessions:", e); }

// Nueva tabla para detalles de arqueo de caja
db.prepare(`
  CREATE TABLE IF NOT EXISTS cash_reconciliation_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    denomination INTEGER NOT NULL, -- 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50
    count INTEGER NOT NULL DEFAULT 0,
    amount REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES cash_register_sessions(id) ON DELETE CASCADE
  )
`).run();

// Movimientos de caja (ventas, entradas/salidas manuales)
db.prepare(`
  CREATE TABLE IF NOT EXISTS cash_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'in', 'out'
    sub_type TEXT, -- 'sale_cash', 'credit_payment', 'service_payment', 'manual_in', 'expense', 'purchase_payment', 'manual_out', 'refund'
    description TEXT,
    amount REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now', 'localtime')),
    related_id INTEGER, -- ID de la venta, gasto, pago, etc.
    FOREIGN KEY (session_id) REFERENCES cash_register_sessions(id)
  )
`).run();

// MIGRACIÓN: Agregar sub_type y related_id a cash_movements para reportes detallados
try {
  const movCols = db.prepare("PRAGMA table_info(cash_movements)").all();
  if (!movCols.some(c => c.name === "sub_type")) {
    db.prepare("ALTER TABLE cash_movements ADD COLUMN sub_type TEXT").run();
    // Normalizar datos antiguos: tipo 'sale' pasa a ser 'in' con sub_tipo 'sale_cash'
    db.prepare("UPDATE cash_movements SET sub_type = 'sale_cash', type = 'in' WHERE type = 'sale'").run();
    db.prepare("UPDATE cash_movements SET sub_type = 'manual_in' WHERE type = 'in' AND sub_type IS NULL").run();
    db.prepare("UPDATE cash_movements SET sub_type = 'manual_out' WHERE type = 'out' AND sub_type IS NULL").run();
  }
  if (!movCols.some(c => c.name === "related_id")) {
    db.prepare("ALTER TABLE cash_movements ADD COLUMN related_id INTEGER").run();
  }
} catch (e) { console.error("Error migración cash_movements:", e); }
// Pagos por venta (para manejar efectivo/transferencia/mixto)
db.prepare(`
  CREATE TABLE IF NOT EXISTS sale_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    method TEXT NOT NULL, -- 'cash', 'transfer'
    amount REAL NOT NULL,
    received REAL, -- solo aplica si es efectivo
    change REAL,   -- solo aplica si es efectivo
    reference TEXT, -- banco o referencia
    created_at DATETIME DEFAULT (DATETIME('now', 'localtime')),
    FOREIGN KEY (sale_id) REFERENCES sales(id)
  )
`).run();

// MIGRACIÓN: Agregar created_at a sale_payments (Ejecutar DESPUÉS de crear la tabla para evitar errores)
try {
  const spColumns = db.prepare("PRAGMA table_info(sale_payments)").all();
  if (!spColumns.some(c => c.name === "created_at")) {
    // SQLite restringe el uso de DEFAULT CURRENT_TIMESTAMP en ALTER TABLE.
    // Solución: Agregar columna sin default, luego actualizar registros existentes a localtime.
    db.prepare("ALTER TABLE sale_payments ADD COLUMN created_at DATETIME").run();
    db.prepare("UPDATE sale_payments SET created_at = (SELECT sale_date FROM sales WHERE sales.id = sale_payments.sale_id) WHERE created_at IS NULL").run();
  }
} catch (e) { console.error("Error en migración sale_payments (created_at):", e); }

db.prepare(`
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  quote_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_amount REAL NOT NULL DEFAULT 0,
  quote_number TEXT UNIQUE,
  notes TEXT,
  status TEXT DEFAULT 'pending',
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
  variant_id INTEGER,
  skip_stock INTEGER DEFAULT 0,
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

// SERVICIOS
db.prepare(`
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'Abierto',
  scheduled_date DATE,
  performed_at DATETIME,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL
)`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS service_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  variant_id INTEGER,
  price REAL DEFAULT 0,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
)`).run();

// USUARIOS Y ROLES
db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'admin' or 'user'
  name TEXT
)`).run();
// AUDITORÍA (LOGS DE MODIFICACIONES)
db.prepare(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name TEXT,
    action TEXT,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Crear usuario admin por defecto si no existe
const adminExist = db.prepare("SELECT COUNT(*) as c FROM users").get();
if (adminExist.c === 0) {
  const hash = crypto.createHash('sha256').update('12345').digest('hex');
  db.prepare("INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)").run('admin', hash, 'admin', 'Administrador');
}

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
  const getVariants = db.prepare("SELECT id, product_id, name, sale_price, special_price, special_price_2, conversion_factor, purchase_price FROM product_variants WHERE product_id = ? ORDER BY name");
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
            INSERT INTO products (code, name, category, category_id, purchase_price, sale_price, special_price, special_price_2, stock, min_stock, supplier_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            p.code,
            p.name,
            p.category || null,
            catId,
            p.purchase_price || 0,
            p.sale_price || 0,
            p.special_price || 0,
            p.special_price_2 || 0,
            p.stock || 0,
            p.min_stock || 0,
            p.supplier_id || null
        );
        const productId = productRes.lastInsertRowid;
        if (p.variants && p.variants.length > 0) {
            const insertVariant = db.prepare(`
                INSERT INTO product_variants (product_id, name, sale_price, special_price, special_price_2, conversion_factor, purchase_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            for (const v of p.variants) {
                insertVariant.run(productId, v.name, v.sale_price, v.special_price || 0, v.special_price_2 || 0, v.conversion_factor, v.purchase_price || 0);
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
            SET code=?, name=?, category=?, category_id=?, purchase_price=?, sale_price=?, special_price=?, special_price_2=?, stock=?, min_stock=?, supplier_id=?
            WHERE id=?
        `).run(
            p.code,
            p.name,
            p.category || null,
            catId,
            p.purchase_price || 0,
            p.sale_price || 0,
            p.special_price || 0,
            p.special_price_2 || 0,
            p.stock || 0,
            p.min_stock || 0,
            p.supplier_id || null,
            p.id
        );
        // Borrar variantes antiguas e insertar nuevas
        db.prepare("DELETE FROM product_variants WHERE product_id=?").run(p.id);
        if (p.variants && p.variants.length > 0) {
            const insertVariant = db.prepare(`
                INSERT INTO product_variants (product_id, name, sale_price, special_price, special_price_2, conversion_factor, purchase_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            for (const v of p.variants) {
                insertVariant.run(p.id, v.name, v.sale_price, v.special_price || 0, v.special_price_2 || 0, v.conversion_factor, v.purchase_price || 0);
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
  transfer_payment = 0,
  transfer_reference = null,
  service_id = null,
  due_date = null,
  status = 'active',
  notes = null
}) {
  const insertSale = db.prepare(`
    INSERT INTO sales (
      client_id, 
      total_amount, 
      sale_date, 
      sale_type, 
      paid_amount, 
      outstanding_balance,
      cash_payment, 
      transfer_payment, 
      due_date, 
      status,
      notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPayment = db.prepare(`
    INSERT INTO sale_payments (sale_id, method, amount, received, change, reference, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO sale_items (sale_id, product_id, product_name, product_code, serial_number, quantity, price, subtotal, conversion_factor, variant_id, skip_stock)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
  const getProduct = db.prepare("SELECT id, code, name, stock FROM products WHERE id = ?");
  const getVariant = db.prepare("SELECT * FROM product_variants WHERE id = ?");

  const trx = db.transaction((client_id, items, cash_payment, transfer_payment, transfer_reference, service_id, notes) => {
    const formattedDate = new Date().toLocaleString('sv-SE'); // Genera YYYY-MM-DD HH:mm:ss local para compatibilidad

    let total = 0;
    for (const it of items) {
      let price, stockToDecrement;
      let conversionFactor = 1;
      
      // Si tiene product_id, es un producto físico y validamos stock
      if (it.product_id && !it.skip_stock) { // ⚠️ Validar stock solo si NO es skip_stock
        const prod = getProduct.get(it.product_id);
        if (!prod) throw new Error(`Producto con id=${it.product_id} no existe`);

        if (it.variant_id) {
          const variant = getVariant.get(it.variant_id);
          if (!variant) throw new Error(`Variante con id=${it.variant_id} no existe`);
          price = it.price ?? variant.sale_price;
          conversionFactor = variant.conversion_factor;
          stockToDecrement = it.quantity * conversionFactor;
        } else {
          price = it.price ?? prod.sale_price;
          stockToDecrement = it.quantity;
        }
        if (prod.stock < stockToDecrement) throw new Error(`Stock insuficiente para ${prod.name}`);
      } else {
        // Es un servicio o ítem libre
        price = it.price || 0;
      }

      total += price * it.quantity;
    }

    // Calcular el cambio y el valor neto en efectivo antes de registrar la venta
    const change = Math.max(0, (cash_payment + transfer_payment) - total);
    const netCashValue = Math.max(0, cash_payment - change);

    const finalPaid = (sale_type === 'credit') ? paid_amount : total;
    const finalOutstanding = (sale_type === 'credit') ? outstanding_balance : 0;

    const saleRes = insertSale.run(
      client_id || null,
      total,
      formattedDate,
      sale_type,
      finalPaid, // Establecer el total pagado al costo total de la venta
      finalOutstanding,
      netCashValue, // Registrar el valor neto en la tabla sales
      transfer_payment,
      due_date,
      status,
      notes
    );
    const saleId = saleRes.lastInsertRowid;

    for (const it of items) {
      let prodCode = "";
      let conversionFactor = 1; // Inicializar factor para este item

      if (it.product_id) {
        const prod = getProduct.get(it.product_id);
        prodCode = prod ? prod.code : "";
        // Si es una variante, obtener su factor de conversión
        if (it.variant_id) {
          const variant = getVariant.get(it.variant_id);
          if (variant) {
            conversionFactor = variant.conversion_factor;
          }
        }
      }

      insertItem.run(
        saleId, it.product_id || null, it.product_name, prodCode, it.serial_number || null,
        it.quantity, it.price, it.subtotal, conversionFactor, it.variant_id || null, it.skip_stock ? 1 : 0
      );

      if (it.product_id && !it.skip_stock) {
        updateStock.run(it.quantity * conversionFactor, it.product_id);
      }
    }

    // registrar pagos
    if (cash_payment > 0) {
      insertPayment.run(saleId, "cash", cash_payment, cash_payment, change, null, formattedDate); // Registrar el total recibido y el cambio
      
      const cashRegister = require("./cashRegister");
      const activeSession = cashRegister.getActiveSession();
      if (activeSession) {
        cashRegister.addCashMovement(activeSession.id, "in", "sale_cash", netCashValue, `Venta #${saleId}`, saleId); // Registrar el valor neto en el movimiento de caja
      }
    }
    if (transfer_payment > 0) {
      insertPayment.run(saleId, "transfer", transfer_payment, null, null, transfer_reference, formattedDate);
      
      const cashRegister = require("./cashRegister");
      const activeSession = cashRegister.getActiveSession();
      if (activeSession) {
        cashRegister.addCashMovement(activeSession.id, "in", "sale_transfer", transfer_payment, `Venta (Trf) #${saleId}`, saleId);
      }
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

    // Si la venta incluye servicios (cada item puede traer `service_id`), marcar TODOS los servicios involucrados como Finalizado.
    // Evitar migrar los registros de `service_payments` a `sale_payments` porque:
    // - Los abonos ya están registrados en `service_payments` y en movimientos de caja cuando se realizaron.
    // - Migrarlos causa que esos abonos aparezcan también en la pestaña de "Abonos Créditos" al consultar `sale_payments`.
    // Por tanto, NO duplicamos los abonos aquí; se conserva el historial en `service_payments`.
    try {
      const markServiceStmt = db.prepare("UPDATE services SET status = 'Finalizado' WHERE id = ?");
      const serviceIds = new Set();
      for (const it of items) {
        if (it.service_id) serviceIds.add(it.service_id);
      }
      // También mantener compatibilidad con parámetro service_id (antiguo comportamiento)
      if (service_id) serviceIds.add(service_id);
      for (const sid of serviceIds) {
        markServiceStmt.run(sid);
      }
    } catch (e) {
      console.error('Error al marcar servicios como Finalizado en createSale:', e);
    }
    // ---------------------------------------

    return saleId;
  });

  try {
    const id = trx(client_id, items, cash_payment, transfer_payment, transfer_reference, service_id, notes);
    return { success: true, message: "Venta registrada", id };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function createSaleFromQuote(data) {
  const { quote_id, ...saleData } = data;
  const trx = db.transaction(() => {
    const result = createSale(saleData);
    if (!result.success) throw new Error(result.message);
    
    // Asegurar columna status en quotes (por si no existe)
    try { db.prepare("ALTER TABLE quotes ADD COLUMN status TEXT DEFAULT 'pending'").run(); } catch (e) {}

    db.prepare("UPDATE quotes SET status = 'approved' WHERE id = ?").run(quote_id);
    return result;
  });

  try {
    return trx();
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function updateSale({ saleId, clientId, items, paymentAdjustment, userName, due_date, notes = null, sale_type = null, total_amount = null }) {
    const trx = db.transaction(() => {
        // 1. Get original sale and items
        const originalSale = db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId);
        if (!originalSale) throw new Error("Venta no encontrada para editar.");

        const originalItems = db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(saleId);

        // 2. Calculate and apply stock adjustments
        const stockAdjustments = new Map();
        const returns = []; // Para el punto 4: Detalle de devoluciones

        // Add back original stock
        for (const item of originalItems) {
            if (item.product_id && !item.skip_stock) { // ⚠️ Solo devolver si se descontó
                const quantityToReturn = item.quantity * (item.conversion_factor || 1);
                stockAdjustments.set(item.product_id, (stockAdjustments.get(item.product_id) || 0) + quantityToReturn);
            }
        }

        // Decrement new stock
        let newTotalAmount = 0;
        for (const item of items) {
            newTotalAmount += item.subtotal;
            if (item.product_id && !item.skip_stock) { // ⚠️ Solo descontar si no es skip_stock
                const conversionFactor = item.variant_id 
                    ? (db.prepare("SELECT conversion_factor FROM product_variants WHERE id = ?").get(item.variant_id)?.conversion_factor || 1)
                    : 1;
                const quantityToDecrement = item.quantity * conversionFactor;
                stockAdjustments.set(item.product_id, (stockAdjustments.get(item.product_id) || 0) - quantityToDecrement);
            }
        }

        // Punto 4: Identificar productos devueltos (cantidad reducida)
        for (const oldIt of originalItems) {
            const newIt = items.find(n => n.product_id === oldIt.product_id && n.variant_id === oldIt.variant_id);
            const oldQty = oldIt.quantity;
            const newQty = newIt ? newIt.quantity : 0;
            
            if (newQty < oldQty) {
                returns.push({
                    product_name: oldIt.product_name,
                    product_code: oldIt.product_code,
                    quantity: oldQty - newQty,
                    price: oldIt.price,
                    subtotal: (oldQty - newQty) * oldIt.price
                });
            }
        }

        const updateStockStmt = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
        for (const [productId, quantityChange] of stockAdjustments.entries()) {
            if (quantityChange < 0) {
                const product = db.prepare("SELECT name, stock FROM products WHERE id = ?").get(productId);
                if (product.stock < Math.abs(quantityChange)) {
                    throw new Error(`Stock insuficiente para '${product.name}' al editar la venta.`);
                }
            }
            updateStockStmt.run(quantityChange, productId);
        }

        // 3. Update sale items
        db.prepare("DELETE FROM sale_items WHERE sale_id = ?").run(saleId);
        const insertItemStmt = db.prepare(`
            INSERT INTO sale_items (sale_id, product_id, product_name, product_code, serial_number, quantity, price, subtotal, conversion_factor, variant_id, skip_stock)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const getProduct = db.prepare("SELECT code FROM products WHERE id = ?");
        const getVariant = db.prepare("SELECT conversion_factor FROM product_variants WHERE id = ?");

        for (const it of items) {
            let prodCode = it.product_code || "";
            let conversionFactor = 1;
            if (it.product_id) {
                prodCode = getProduct.get(it.product_id)?.code || "";
                if (it.variant_id) {
                    conversionFactor = getVariant.get(it.variant_id)?.conversion_factor || 1;
                }
            }
            insertItemStmt.run(saleId, it.product_id, it.product_name, prodCode, it.serial_number || null, it.quantity, it.price, it.subtotal, conversionFactor, it.variant_id || null, it.skip_stock ? 1 : 0);
        }

        // 4. Handle financial adjustments
        let newPaidAmount = originalSale.paid_amount;
        let currentCashReceived = originalSale.cash_payment || 0;
        let currentTransferReceived = originalSale.transfer_payment || 0;
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        if (paymentAdjustment && paymentAdjustment.amount !== 0) {
            newPaidAmount += paymentAdjustment.amount;

            // Lógica de "Cambio": Si la venta ya tenía un excedente (cambio), el nuevo producto 
            // consume ese excedente antes de pedir más dinero real.
            const previousSurplus = Math.max(0, (currentCashReceived + currentTransferReceived) - originalSale.total_amount);
            const realAdditionalMoney = Math.max(0, paymentAdjustment.amount - previousSurplus);

            if (paymentAdjustment.method === 'cash') {
                currentCashReceived += realAdditionalMoney;
            } else if (paymentAdjustment.method === 'transfer') {
                currentTransferReceived += realAdditionalMoney;
            }

            if (paymentAdjustment.amount > 0) { // Pago adicional
                db.prepare(`INSERT INTO sale_payments (sale_id, method, amount, received, change, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
                    saleId, 
                    paymentAdjustment.method, 
                    paymentAdjustment.amount, 
                    realAdditionalMoney, 
                    0, 
                    paymentAdjustment.reference, 
                    now
                );
            } else { // Refund
                const client = originalSale.client_id ? db.prepare("SELECT name FROM clients WHERE id = ?").get(originalSale.client_id) : null;
                const clientInfo = client ? client.name : "Consumidor Final";
                
                const expenseDetails = {
                    invoice_number: originalSale.invoice_number || saleId,
                    client_name: clientInfo,
                    items: returns
                };

                db.prepare(`
                    INSERT INTO expenses (description, amount, category, date, details) 
                    VALUES (?, ?, 'Devolución', ?, ?)
                `).run(
                    `Devolución Venta #${expenseDetails.invoice_number}`, 
                    Math.abs(paymentAdjustment.amount), 
                    now.slice(0, 10),
                    JSON.stringify(expenseDetails)
                );
            }
        }
        
        const newOutstandingBalance = Math.max(0, newTotalAmount - newPaidAmount);
        const newSaleType = newOutstandingBalance > 0 ? 'credit' : 'paid';

        // 5. Update the main sale record
        db.prepare(`UPDATE sales SET client_id = ?, total_amount = ?, paid_amount = ?, outstanding_balance = ?, sale_type = ?, cash_payment = ?, transfer_payment = ?, due_date = ?, notes = ? WHERE id = ?`).run(clientId, newTotalAmount, newPaidAmount, newOutstandingBalance, newSaleType, currentCashReceived, currentTransferReceived, due_date, notes, saleId);

        logAction(userName, 'Editar Venta', `Factura #${originalSale.invoice_number || saleId} modificada. Total: ${originalSale.total_amount} -> ${newTotalAmount}`);
    });

    try {
        trx();
        return { success: true, message: "Factura actualizada correctamente." };
    } catch (err) {
        console.error("Error en transacción updateSale:", err);
        return { success: false, message: String(err) };
    }
}

function getSales(limit = -1, offset = 0, clientId = null, searchTerm = null, statusFilter = 'active') {
  let query = "SELECT s.id, s.client_id, s.sale_date, s.total_amount, s.invoice_number, s.status FROM sales s";
  const params = [];
  const conditions = [];

  if (searchTerm) {
    query += " LEFT JOIN clients c ON s.client_id = c.id";
    conditions.push("(s.invoice_number LIKE ? OR c.name LIKE ?)");
    params.push(`%${searchTerm}%`, `%${searchTerm}%`);
  }

  if (clientId) {
    conditions.push("s.client_id = ?");
    params.push(clientId);
  }

  if (statusFilter && statusFilter !== 'all') {
    conditions.push("s.status = ?");
    params.push(statusFilter);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY s.sale_date DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const sales = db.prepare(query).all(...params);
  const itemsStmt = db.prepare("SELECT id, sale_id, product_id, product_name, product_code, serial_number, quantity, price, subtotal, variant_id, conversion_factor, skip_stock FROM sale_items WHERE sale_id = ?");
  for (const s of sales) s.items = itemsStmt.all(s.id);
  return sales;
}

function getSaleById(id) {
  return db.prepare("SELECT * FROM sales WHERE id = ?").get(id);
}

function getSaleItems(saleId) {
  return db.prepare("SELECT id, sale_id, product_id, product_name, product_code, serial_number, quantity, price, subtotal, variant_id, conversion_factor, skip_stock FROM sale_items WHERE sale_id = ?").all(saleId);
}

function getSalePaymentById(id) {
  return db.prepare("SELECT * FROM sale_payments WHERE id = ?").get(id);
}

function getSalePayments(saleId) {
  return db.prepare("SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY created_at DESC").all(saleId);
}

// Helper para obtener detalles de un abono de cliente para el recibo PDF
function getSalePaymentDetailsForPdf(paymentId) {
  const payment = db.prepare("SELECT * FROM sale_payments WHERE id = ?").get(paymentId);
  if (!payment) return null;

  const sale = db.prepare("SELECT s.*, c.name as client_name FROM sales s LEFT JOIN clients c ON s.client_id = c.id WHERE s.id = ?").get(payment.sale_id);
  if (!sale) return null;

  // Calculamos cuánto se ha pagado en TOTAL después de este abono específico.
  // Esto incluye abonos a crédito que se hicieron cronológicamente después del que estamos consultando.
  const totalPaidLaterRow = db.prepare(`
    SELECT SUM(amount) as total 
    FROM sale_payments 
    WHERE sale_id = ? AND id > ?
  `).get(payment.sale_id, paymentId);

  const totalPaidLater = totalPaidLaterRow.total || 0;
  
  // El saldo pendiente DESPUÉS de este abono es el saldo actual de la factura más todos los abonos posteriores.
  const balanceAfter = sale.outstanding_balance + totalPaidLater;
  const balanceBefore = balanceAfter + payment.amount;

  return {
    payment,
    sale,
    client_name: sale.client_name,
    balanceBefore,
    balanceAfter
  };
}

// Helper para obtener detalles de un abono de servicio para el recibo PDF
function getServicePaymentDetailsForPdf(paymentId) {
  const payment = db.prepare("SELECT * FROM service_payments WHERE id = ?").get(paymentId);
  if (!payment) return null;

  const service = db.prepare(`
    SELECT s.*, c.name as client_name,
      (SELECT COALESCE(SUM(sp.quantity * CASE WHEN sp.price > 0 THEN sp.price ELSE COALESCE(pv.sale_price, p.sale_price) END), 0)
       FROM service_products sp 
       JOIN products p ON sp.product_id = p.id 
       LEFT JOIN product_variants pv ON sp.variant_id = pv.id
       WHERE sp.service_id = s.id
      ) as materials_cost
    FROM services s 
    LEFT JOIN clients c ON s.client_id = c.id
    WHERE s.id = ?
  `).get(payment.service_id);
  if (!service) return null;

  const totalCost = (service.price || 0) + (service.materials_cost || 0);

  const paymentsBeforeThisOne = db.prepare(`
    SELECT SUM(amount) as total 
    FROM service_payments 
    WHERE service_id = ? AND id < ?
  `).get(payment.service_id, paymentId);

  const paidBeforeThis = paymentsBeforeThisOne.total || 0;
  const balanceBefore = totalCost - paidBeforeThis;
  const balanceAfter = balanceBefore - payment.amount;

  return {
    payment,
    service,
    client_name: service.client_name,
    balanceBefore,
    balanceAfter,
    totalCost
  };
}

// Helper para obtener detalles de un pago de compra para PDF
function getPurchasePaymentDetailsForPdf(paymentId) {
  const payment = db.prepare("SELECT * FROM purchase_payments WHERE id = ?").get(paymentId);
  if (!payment) return null;

  const order = db.prepare("SELECT po.*, s.name as supplier_name FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.id WHERE po.id = ?").get(payment.purchase_order_id);
  if (!order) return null;

  // Sumar todos los pagos (incluyendo retenciones) hasta este pago para calcular el saldo histórico
  const allPaymentsUpToThisOne = db.prepare(`
    SELECT SUM(amount + retention_amount) as total_paid
    FROM purchase_payments
    WHERE purchase_order_id = ? AND id <= ?
  `).get(payment.purchase_order_id, paymentId);

  const paidAmountUpToThis = allPaymentsUpToThisOne.total_paid || 0;
  const realTotal = order.total_amount - (order.discount_amount || 0);
  const outstandingBalanceAfterThisPayment = Math.max(0, realTotal - paidAmountUpToThis);
  const balanceBeforePayment = outstandingBalanceAfterThisPayment + (payment.amount + (payment.retention_amount || 0));

  return {
    payment,
    order,
    supplier_name: order.supplier_name,
    real_total: realTotal,
    balance_before_payment: balanceBeforePayment,
    outstanding_balance_after_payment: outstandingBalanceAfterThisPayment
  };
}

function getPurchasePaymentById(id) {
  return db.prepare("SELECT * FROM purchase_payments WHERE id = ?").get(id);
}

function getServicePaymentById(id) {
  return db.prepare("SELECT * FROM service_payments WHERE id = ?").get(id);
}

function getLastInvoiceNumber() {
  const row = db.prepare("SELECT invoice_number FROM sales WHERE invoice_number IS NOT NULL ORDER BY id DESC LIMIT 1").get();
  return row ? row.invoice_number : null;
}

function setInvoiceNumber(id, invoiceNumber) {
  db.prepare("UPDATE sales SET invoice_number = ? WHERE id = ?").run(invoiceNumber, id);
}

function assignReceiptNumber(saleId) {
  let sale;
  try {
    sale = db.prepare("SELECT receipt_number FROM sales WHERE id = ?").get(saleId);
  } catch (error) {
    // Si falla por falta de columna, intentamos agregarla y reintentar al vuelo
    if (error.message.includes("no such column: receipt_number")) {
      try {
        db.prepare("ALTER TABLE sales ADD COLUMN receipt_number TEXT").run();
        try { db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_receipt_number ON sales(receipt_number)").run(); } catch(e) {}
        sale = db.prepare("SELECT receipt_number FROM sales WHERE id = ?").get(saleId);
      } catch (e) { console.error("No se pudo corregir la tabla sales:", e); throw error; }
    } else { throw error; }
  }

  if (sale && sale.receipt_number) return sale.receipt_number;
  
  // FIX: Calcular el siguiente número basándose en el máximo existente real, no en el último ID
  const next = db.transaction(() => {
      const rows = db.prepare("SELECT receipt_number FROM sales WHERE receipt_number IS NOT NULL").all();
      let maxNum = 0;
      for (const r of rows) {
          const m = r.receipt_number.match(/-(\d+)$/);
          if (m) {
              const num = parseInt(m[1], 10);
              if (num > maxNum) maxNum = num;
          }
      }
      const nextStr = `RC-${padNumber(maxNum + 1)}`;
      db.prepare("UPDATE sales SET receipt_number = ? WHERE id = ?").run(nextStr, saleId);
      return nextStr;
  })();
  
  return next;
}

function deleteSale(id) {
  try {
    db.prepare("DELETE FROM sales WHERE id = ?").run(id); // ON DELETE CASCADE se encarga de items y pagos
    try {
      db.prepare("DELETE FROM cash_movements WHERE related_id = ?").run(id);
    } catch (e) {
      console.error('Error eliminando movimientos de caja relacionados a la venta:', e);
    }
    return { success: true, message: "Venta eliminada permanentemente (el inventario no fue afectado)." };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function updateSaleNotes(id, notes) {
  try {
    db.prepare("UPDATE sales SET notes = ? WHERE id = ?").run(notes, id);
    return { success: true };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function deleteSaleItem(id) {
  const item = db.prepare("SELECT * FROM sale_items WHERE id = ?").get(id);
  if (!item) return { success: false, message: "Item no encontrado" };
  const trx = db.transaction((itemId) => {
    if (item.product_id && !item.skip_stock) { // ⚠️ Solo restaurar si no era skip_stock
      const factor = item.conversion_factor || 1;
      db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(item.quantity * factor, item.product_id);
    }
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

function annulSale(id) {
  try {
    const trx = db.transaction(() => {
      const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(id);
      if (!sale) throw new Error("Venta no encontrada.");
      if (sale.status === 'annulled') throw new Error("La venta ya está anulada.");

      const items = db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(id);
      const updateStock = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
      const getVariant = db.prepare("SELECT conversion_factor FROM product_variants WHERE id = ?");

      for (const it of items) {
        if (it.product_id && !it.skip_stock) {
          let factor = 1;
          if (it.variant_id) {
            const v = getVariant.get(it.variant_id);
            if (v) factor = v.conversion_factor;
          }
          updateStock.run(it.quantity * factor, it.product_id);
        }
      }

      // Marcar la venta como anulada y ajustar valores financieros
      db.prepare(`
        UPDATE sales 
        SET status = 'annulled', 
            total_amount = 0, 
            paid_amount = 0, 
            outstanding_balance = 0,
            cash_payment = 0,
            transfer_payment = 0,
            notes = COALESCE(notes, '') || ' (Anulada el ' || datetime('now') || ')'
        WHERE id = ?
      `).run(id);
      // Eliminar movimientos de caja asociados a esta venta para mantener consistencia en reportes
      try {
        db.prepare("DELETE FROM cash_movements WHERE related_id = ?").run(id);
      } catch (e) {
        console.error('Error eliminando movimientos de caja al anular venta:', e);
      }
    });
    trx();
    return { success: true, message: "Venta anulada y stock restaurado." };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

    // GESTIÓN DE CRÉDITOS
    // Obtiene créditos pendientes o pagados, con búsqueda y paginación.
    function getCredits(searchTerm, onlyPending = true, limit = -1, offset = 0) {
        let query = `
            SELECT
                s.id, s.invoice_number, s.sale_date, s.total_amount, s.paid_amount, s.outstanding_balance, s.due_date,
                c.name as client_name
            FROM sales s
            LEFT JOIN clients c ON s.client_id = c.id
            WHERE (s.sale_type = 'credit' OR (s.sale_type = 'paid' AND EXISTS (SELECT 1 FROM sale_payments WHERE sale_id = s.id)))
              AND (s.status IS NULL OR s.status != 'annulled') -- Excluir ventas anuladas
        `;
        const params = [];

        if (onlyPending) {
            query += " AND s.outstanding_balance > 0";
        } else {
            query += " AND s.outstanding_balance <= 0";
        }

        if (searchTerm) {
            query += ` AND (c.name LIKE ? OR s.invoice_number LIKE ?)`;
            params.push(`%${searchTerm}%`, `%${searchTerm}%`);
        }

        query += " ORDER BY s.sale_date DESC";

        if (limit !== -1) {
            query += " LIMIT ? OFFSET ?";
            params.push(limit, offset);
        }

        return db.prepare(query).all(...params);
    }

     // Registra un abono a un crédito.
    function addCreditPayment(saleId, amount, method = 'cash', reference = null) {
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

            // Registrar el pago en sale_payments para que aparezca en el reporte del día
            db.prepare("INSERT INTO sale_payments (sale_id, method, amount, reference, created_at) VALUES (?, ?, ?, ?, DATETIME('now', 'localtime'))").run(saleId, method, amount, reference); // Ya usa localtime

            const cashRegister = require("./cashRegister");
            const activeSession = cashRegister.getActiveSession();
            if (activeSession) {
                const subType = method === 'cash' ? 'credit_payment_cash' : 'credit_payment_transfer';
                const desc = method === 'cash' ? `Abono Crédito #${saleId}` : `Abono Crédito (Trf) #${saleId}`;
                cashRegister.addCashMovement(activeSession.id, "in", subType, amount, desc, saleId);
            }

            db.prepare("UPDATE sales SET paid_amount = ?, outstanding_balance = ?, sale_type = ? WHERE id = ?")
                .run(newPaidAmount, newOutstandingBalance, newSaleType, saleId);

            return { success: true, message: "Abono registrado exitosamente." };
        } catch (err) {
            return { success: false, message: `Error al registrar abono: ${err.message}` };
        }
    }

    // Marca un crédito como pagado.
    function markCreditAsPaid(saleId, method = 'cash', reference = null) {
        try {
            const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId);
            if (!sale) {
                return { success: false, message: "Venta no encontrada." };
            }

            // Registrar el pago restante en sale_payments
            const amount = sale.outstanding_balance;
            db.prepare("INSERT INTO sale_payments (sale_id, method, amount, reference, created_at) VALUES (?, ?, ?, ?, DATETIME('now', 'localtime'))").run(saleId, method, amount, reference); // Ya usa localtime

            const cashRegister = require("./cashRegister");
            const activeSession = cashRegister.getActiveSession();
            if (activeSession) {
                const subType = method === 'cash' ? 'credit_payment_cash' : 'credit_payment_transfer';
                const desc = method === 'cash' ? `Pago total Crédito #${saleId}` : `Pago total Crédito (Trf) #${saleId}`;
                cashRegister.addCashMovement(activeSession.id, "in", subType, amount, desc, saleId);
            }
            db.prepare("UPDATE sales SET paid_amount = total_amount, outstanding_balance = 0, sale_type = 'paid' WHERE id = ?")
                .run(saleId);

            return { success: true, message: "Crédito marcado como pagado." };
        } catch (err) {
            return { success: false, message: `Error al marcar crédito como pagado: ${err.message}` };
        }
    }

// COTIZACIONES
function createQuote({ client_id = null, items = [], notes = null }) {
  const insertQuote = db.prepare("INSERT INTO quotes (client_id, total_amount, notes) VALUES (?, ?, ?)");
  const insertItem = db.prepare("INSERT INTO quote_items (quote_id, product_id, product_name, product_code, quantity, price, subtotal, variant_id, skip_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const getProduct = db.prepare("SELECT id, code, name, sale_price FROM products WHERE id = ?");
  const trx = db.transaction((client_id, items, notes) => {
    const q = insertQuote.run(client_id || null, 0, notes);
    const quoteId = q.lastInsertRowid;
    let total = 0;
    for (const it of items) {
      const prod = it.product_id ? getProduct.get(it.product_id) : null;
      const prodName = it.product_name || (prod ? prod.name : "Producto eliminado");
      const prodCode = prod ? prod.code : (it.product_code || "");
      const price = (it.price != null) ? it.price : (prod ? prod.sale_price : 0);
      const subtotal = price * it.quantity;
      total += subtotal;
      insertItem.run(quoteId, it.product_id || null, prodName, prodCode, it.quantity, price, subtotal, it.variant_id || null, it.skip_stock ? 1 : 0);
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
    const id = trx(client_id || null, items, notes);
    return { success: true, message: "Cotización registrada", id };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function getQuotes(clientId = null, searchTerm = null) {
  let query = "SELECT q.*, c.name as client_name FROM quotes q LEFT JOIN clients c ON q.client_id = c.id";
  const params = [];
  const conditions = [];

  if (clientId) {
    conditions.push("q.client_id = ?");
    params.push(clientId);
  }
  if (searchTerm) {
    conditions.push("(q.quote_number LIKE ? OR c.name LIKE ?)");
    params.push(`%${searchTerm}%`, `%${searchTerm}%`);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY quote_date DESC";
  const quotes = db.prepare(query).all(...params);
  const itemsStmt = db.prepare("SELECT id, product_id, product_name, product_code, quantity, price, subtotal, variant_id, skip_stock FROM quote_items WHERE quote_id = ?");
  for (const q of quotes) q.items = itemsStmt.all(q.id);
  return quotes;
}

function getQuoteById(id) {
  const quote = db.prepare("SELECT * FROM quotes WHERE id = ?").get(id);
  if (quote) {
    quote.items = db.prepare("SELECT id, product_id, product_name, product_code, quantity, price, subtotal, variant_id, skip_stock FROM quote_items WHERE quote_id = ?").all(id);
  }
  return quote;
}

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

function updateQuoteDetails({ id, client_id, items, notes }) {
  const updateHeader = db.prepare("UPDATE quotes SET client_id = ?, total_amount = ?, notes = ? WHERE id = ?");
  const deleteItems = db.prepare("DELETE FROM quote_items WHERE quote_id = ?");
  const insertItem = db.prepare("INSERT INTO quote_items (quote_id, product_id, product_name, product_code, quantity, price, subtotal, variant_id, skip_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const getProduct = db.prepare("SELECT id, code, name, sale_price FROM products WHERE id = ?");

  const trx = db.transaction((id, client_id, items) => {
    let total = 0;
    // Calcular total y preparar items
    for (const it of items) {
      const prod = it.product_id ? getProduct.get(it.product_id) : null;
      const price = (it.price !== undefined && it.price !== null) ? it.price : (prod ? prod.sale_price : 0);
      total += price * it.quantity;
    }
    
    updateHeader.run(client_id || null, total, notes, id);
    deleteItems.run(id);

    for (const it of items) {
       const prod = it.product_id ? getProduct.get(it.product_id) : null;
       const prodName = it.product_name || (prod ? prod.name : "Producto eliminado");
       const prodCode = it.product_code || (prod ? prod.code : "");
       const price = (it.price !== undefined && it.price !== null) ? it.price : (prod ? prod.sale_price : 0);
       const subtotal = price * it.quantity;
       
       insertItem.run(id, it.product_id || null, prodName, prodCode, it.quantity, price, subtotal, it.variant_id || null, it.skip_stock ? 1 : 0);
    }
    return { success: true, message: "Cotización actualizada correctamente" };
  });

  try {
    return trx(id, client_id, items);
  } catch (err) {
    return { success: false, message: String(err) };
  }
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
  const salesCount = db.prepare("SELECT COUNT(*) as c FROM sales").get().c;
  const quotes = db.prepare("SELECT COUNT(*) as c FROM quotes").get().c;
  const services = db.prepare("SELECT COUNT(*) as c FROM services").get().c;
  const openServices = db.prepare("SELECT COUNT(*) as c FROM services WHERE status = 'Abierto'").get().c;

  // Ventas de hoy (Dinero)
  const today = new Date().toISOString().slice(0, 10);
  const salesTodayRes = db.prepare("SELECT SUM(total_amount) as total FROM sales WHERE date(sale_date) = ?").get(today);
  const salesToday = salesTodayRes ? (salesTodayRes.total || 0) : 0;

  return { clients, products, salesCount, quotes, services, salesToday, openServices };
}

function getSalesLastDays(days = 7) {
  try {
    const sql = `
      SELECT date(sale_date) as date, SUM(total_amount) as total
      FROM sales
      WHERE sale_date >= date('now', '-' || ? || ' days')
      GROUP BY date(sale_date)
      ORDER BY date(sale_date) ASC
    `;
    return db.prepare(sql).all(days);
  } catch (e) {
    return [];
  }
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

// GASTOS
function getExpenses(startDate, endDate) {
  let query = "SELECT * FROM expenses";
  const params = [];
  
  if (startDate && endDate) {
    query += " WHERE date BETWEEN ? AND ?";
    params.push(startDate, endDate);
  }
  
  query += " ORDER BY date DESC";
  return db.prepare(query).all(...params);
}

function getExpenseById(id) {
  return db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
}

function saveExpense(expense) {
  const stmt = db.prepare(`
    INSERT INTO expenses (description, amount, category, date, method, reference, created_at)
    VALUES (?, ?, ?, ?, ?, ?, DATETIME('now', 'localtime'))
  `);
  const info = stmt.run(expense.description, expense.amount, expense.category, expense.date, expense.method || 'cash', expense.reference || null);

  // Registrar movimiento de caja (egreso) clasificado por método
  const cashRegister = require("./cashRegister");
  const activeSession = cashRegister.getActiveSession();
  if (activeSession) {
    const m = (expense.method || 'cash').toString();
    if (m === 'transfer' || m === 'bank' || m === 'transferencia') {
      cashRegister.addCashMovement(activeSession.id, "out", "expense_transfer", expense.amount, expense.description, info.lastInsertRowid);
    } else {
      cashRegister.addCashMovement(activeSession.id, "out", "expense_cash", expense.amount, expense.description, info.lastInsertRowid);
    }
  }
  return { success: true, id: info.lastInsertRowid };
}

function deleteExpense(id) {
  // Eliminar el gasto y cualquier movimiento de caja relacionado
  db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
  try {
    db.prepare("DELETE FROM cash_movements WHERE related_id = ?").run(id);
  } catch (e) {
    console.error('Error eliminando movimientos de caja relacionados al egreso:', e);
  }
  return { success: true };
}

// AUDITORÍA
function logAction(userName, action, details) {
  try {
    db.prepare("INSERT INTO audit_logs (user_name, action, details) VALUES (?, ?, ?)").run(userName, action, details);
  } catch (e) {
    console.error("Error logging action:", e);
  }
}

function getAuditLogs(startDate, endDate) {
  const start = startDate + " 00:00:00";
  const end = endDate + " 23:59:59";
  return db.prepare("SELECT * FROM audit_logs WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC").all(start, end);
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
      WHERE sale_date >= ? AND sale_date <= ? AND status != 'annulled'
      GROUP BY ${groupByClause}
      ORDER BY ${groupByClause} DESC
    `);
    const rows = salesStmt.all(start, end);

    const itemsStmt = db.prepare(`
      SELECT si.product_name, si.quantity, si.price, si.subtotal, si.conversion_factor,
             pv.purchase_price as variant_cost, p.purchase_price as base_cost
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN product_variants pv ON si.variant_id = pv.id
      WHERE si.sale_id = ?
    `);

    const paymentsStmt = db.prepare(`
      SELECT method, amount, received, change, reference
      FROM sale_payments
      WHERE sale_id = ?
    `);

    // Consulta para obtener el total de ingresos REALES en el periodo (incluyendo abonos a créditos antiguos)
    const incomeStmt = db.prepare(`
      SELECT sp.method, SUM(sp.amount - COALESCE(sp.change, 0)) as total
      FROM sale_payments sp
      JOIN sales s ON sp.sale_id = s.id
      WHERE sp.created_at >= ? AND sp.created_at <= ? AND s.status != 'annulled'
      GROUP BY method
    `);

    let totalProfit = 0;

    const detailedSales = rows.flatMap(r => {
      const saleIds = r.sale_ids.split(",").map(id => parseInt(id));
      return saleIds.map(sid => {
        const sale = db.prepare(`
          SELECT id, invoice_number, sale_date, total_amount, sale_type,
                 paid_amount, outstanding_balance, cash_payment, transfer_payment
          FROM sales WHERE id = ?
        `).get(sid);

        const items = itemsStmt.all(sid);
        const payments = paymentsStmt.all(sid);

        // Calcular la utilidad de esta venta
        const saleProfit = items.reduce((profit, item) => {
          // Prioridad de costo:
          // 1. Costo específico de la variante (si existe y es > 0)
          // 2. Costo base * factor de conversión (para variantes sin costo específico o ventas antiguas)
          // 3. Costo base directo (si no es variante)
          let cost = (item.variant_cost && item.variant_cost > 0) 
                     ? item.variant_cost 
                     : (item.base_cost || 0) * (item.conversion_factor || 1);
                     
          const revenue = item.price * item.quantity;
          return profit + (revenue - (cost * item.quantity));
        }, 0);
        
        totalProfit += saleProfit;

        let paid_cash = 0;
        let paid_transfer = 0;
        let transfer_reference = "";

        for (const p of payments) {
          if (p.method === "cash") {
            // efectivo real = recibido - cambio
            paid_cash += (p.received || 0) - (p.change || 0);
          } else if (p.method === "transfer") {
            paid_transfer += p.amount || 0;
            if (p.reference) transfer_reference = p.reference;
          }
        }

        return {
          ...sale,
          items,
          profit: saleProfit, // Añadir utilidad a la venta
          paid_cash, // Total pagado históricamente (para detalle)
          paid_transfer, // Total pagado históricamente (para detalle)
          transfer_reference
        };
      });
    });

    // Calcular totales basados en los pagos reales registrados en el periodo
    const incomeRows = incomeStmt.all(start, end);
    const realTotalCash = incomeRows.find(r => r.method === 'cash')?.total || 0;
    const realTotalTransfer = incomeRows.find(r => r.method === 'transfer')?.total || 0;

    const totalGeneral = detailedSales.reduce((acc, s) => acc + s.total_amount, 0);
    
    // Totales de VENTAS (según registro inicial)
    const salesCash = detailedSales.reduce((acc, s) => {
      const tendered = s.cash_payment || 0;
      const transfer = s.transfer_payment || 0;
      const total = s.total_amount || 0;
      // Calcular cambio para restar del efectivo ingresado y obtener el efectivo real de la venta
      const change = Math.max(0, (tendered + transfer) - total);
      const realCash = Math.max(0, tendered - change);
      return acc + realCash;
    }, 0);

    const salesTransfer = detailedSales.reduce((acc, s) => acc + (s.transfer_payment || 0), 0);
    const salesCredit = detailedSales.reduce((acc, s) => acc + (s.outstanding_balance || 0), 0);

    // Calcular pagos previos (Abonos de servicios o anticipos)
    const salesPrevious = Math.max(0, totalGeneral - (salesCash + salesTransfer + salesCredit));

    // Usamos los totales reales de sale_payments en lugar de sumar las ventas
    const totalCash = realTotalCash;
    const totalTransfer = realTotalTransfer;

    return { 
      sales: detailedSales, 
      totalGeneral,
      totalProfit, // Añadir utilidad total
      totalCash, 
      totalTransfer, 
      salesCash,
      salesTransfer,
      salesCredit,
      salesPrevious
    };
  } catch (err) {
    console.error("Error en getSalesReport:", err);
    return { sales: [], totalGeneral: 0, totalProfit: 0, totalCash: 0, totalTransfer: 0, totalCredit: 0 };
  }
}

// ORDENES DE COMPRA (Purchase Orders)
function createPurchaseOrder(data) {
  const insertPO = db.prepare("INSERT INTO purchase_orders (supplier_id, total_amount, notes, include_iva, due_date) VALUES (?, ?, ?, ?, ?)");
  const insertItem = db.prepare("INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, product_code, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const getProduct = db.prepare("SELECT id, code, name, purchase_price FROM products WHERE id = ?");

  const trx = db.transaction((data) => {
    const po = insertPO.run(data.supplier_id, 0, data.notes || null, data.include_iva ? 1 : 0, data.due_date || null);
    const poId = po.lastInsertRowid;
    let total = 0;
    for (const it of data.items) {
      const prod = getProduct.get(it.product_id);
      const prodName = prod ? prod.name : "Producto no encontrado";
      const prodCode = prod ? prod.code : "";
      const price = (it.price != null) ? it.price : (prod ? prod.purchase_price : 0);
      const subtotal = price * it.quantity;
      total += subtotal;
      insertItem.run(poId, it.product_id, prodName, prodCode, it.quantity, price, subtotal);
    }

    // Calcular IVA si aplica
    if (data.include_iva) {
      total = total * 1.19; // Sumar 19%
    }

    db.prepare("UPDATE purchase_orders SET total_amount = ? WHERE id = ?").run(total, poId);
    
    const poNumber = nextConsecutive("OC", "po_number", "purchase_orders");
    db.prepare("UPDATE purchase_orders SET po_number = ? WHERE id = ?").run(poNumber, poId);
    
    return poId;
  });

  try {
    const id = trx(data);
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
    ORDER BY po.id DESC
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
  
  // Actualizamos estado y establecemos la deuda inicial igual al total de la orden
  const updateOrderStatus = db.prepare(`
    UPDATE purchase_orders 
    SET status = 'completed', outstanding_balance = ?, payment_status = 'pending' 
    WHERE id = ?
  `);

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

    updateOrderStatus.run(order.total_amount, id);
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
    const trx = db.transaction((orderId) => {
      // Eliminar pagos asociados primero para evitar error de Foreign Key
      db.prepare("DELETE FROM purchase_payments WHERE purchase_order_id = ?").run(orderId);
      db.prepare("DELETE FROM purchase_order_items WHERE purchase_order_id = ?").run(orderId);
      db.prepare("DELETE FROM purchase_orders WHERE id = ?").run(orderId);
    });
    trx(id);
    return { success: true, message: "Orden de compra eliminada" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function updatePurchaseOrder({ id, supplier_id, order_date, items = [], notes = null, include_iva = false, due_date = null }) {
    const updatePO = db.prepare("UPDATE purchase_orders SET supplier_id = ?, order_date = ?, total_amount = ?, notes = ?, include_iva = ?, due_date = ? WHERE id = ?");
    const deleteItems = db.prepare("DELETE FROM purchase_order_items WHERE purchase_order_id = ?");
    const insertItem = db.prepare("INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, product_code, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)");
    const getProduct = db.prepare("SELECT id, code, name FROM products WHERE id = ?");

    const trx = db.transaction((id, supplier_id, order_date, items, notes, include_iva, due_date) => {
        let total = 0;
        for (const it of items) {
            total += it.subtotal;
        }
        
        if (include_iva) {
            total = total * 1.19;
        }

        updatePO.run(supplier_id, order_date, total, notes, include_iva ? 1 : 0, due_date, id);
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
        const updatedId = trx(id, supplier_id, order_date, items, notes, include_iva, due_date);
        return { success: true, message: "Orden de Compra actualizada", id: updatedId };
    } catch (err) {
        return { success: false, message: String(err) };
    }
}

// --- GESTIÓN DE PAGOS A PROVEEDORES ---

function updatePurchaseInvoiceNumber(id, invoiceNumber, discountAmount = 0) {
  try {
    const order = db.prepare("SELECT total_amount, paid_amount FROM purchase_orders WHERE id = ?").get(id);
    if (!order) return { success: false, message: "Orden no encontrada" };

    // El descuento reduce el total real a pagar. 
    // Recalculamos el saldo pendiente: (Total Original - Descuento) - Lo ya pagado
    const realTotal = order.total_amount - discountAmount;
    const newBalance = Math.max(0, realTotal - order.paid_amount);

    const stmt = db.prepare(`
      UPDATE purchase_orders 
      SET supplier_invoice_number = ?, 
          discount_amount = ?, 
          outstanding_balance = ? 
      WHERE id = ?
    `);
    stmt.run(invoiceNumber, discountAmount, newBalance, id);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getPurchasePayments(orderId) {
  try {
    return db.prepare(`
      SELECT pp.*, po.supplier_invoice_number 
      FROM purchase_payments pp 
      LEFT JOIN purchase_orders po ON pp.purchase_order_id = po.id 
      WHERE pp.purchase_order_id = ? 
      ORDER BY pp.date DESC, pp.id DESC`).all(orderId);
  } catch (err) {
    console.error(err);
    return [];
  }
}

function addPurchasePayment({ orderId, amount, method, reference, date, notes, retentionAmount = 0, retentionType = '' }) {
  try {
    const order = getPurchaseOrderById(orderId);
    if (!order) return { success: false, message: "Orden de compra no encontrada" };

    if (amount <= 0) return { success: false, message: "El monto debe ser mayor a 0" };

    const transaction = db.transaction(() => {
      // A. Insertar el pago
      db.prepare(`
        INSERT INTO purchase_payments (purchase_order_id, date, amount, method, reference, notes, retention_amount, retention_type, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now', 'localtime'))
      `).run(orderId, date, amount, method, reference, notes, retentionAmount, retentionType);

      // B. Actualizar la Orden de Compra
      // Registrar movimiento de caja: efectivo o transferencia
      const cashRegister = require("./cashRegister");
      const activeSession = cashRegister.getActiveSession();
      if (activeSession) {
        if (method === 'cash') {
          cashRegister.addCashMovement(activeSession.id, "out", "purchase_payment", amount, `Pago Proveedor OC #${order.po_number || orderId}`, orderId);
        } else if (method === 'transfer' || method === 'bank' || method === 'transferencia') {
          // registrar como salida por transferencia
          cashRegister.addCashMovement(activeSession.id, "out", "purchase_payment_transfer", amount, `Pago Proveedor OC #${order.po_number || orderId}`, orderId);
        }
      }
      const totalDebtReduction = amount + (retentionAmount || 0); // La deuda baja por lo pagado + lo retenido
      const newPaid = (order.paid_amount || 0) + totalDebtReduction;
      
      // Si el saldo era 0 y el estado pendiente (migración de datos viejos), asumimos saldo inicial = total
      let currentBalance = order.outstanding_balance;
      // Corrección para órdenes antiguas que ya estaban recibidas pero sin saldo calculado
      if ((currentBalance === 0 || currentBalance === null) && order.status === 'completed' && (!order.payment_status || order.payment_status === 'pending')) {
          currentBalance = order.total_amount;
      }
      
      const newBalance = currentBalance - totalDebtReduction;
      const newStatus = newBalance <= 50 ? 'paid' : 'partial'; // Margen de error pequeño por decimales

      db.prepare(`
        UPDATE purchase_orders 
        SET paid_amount = ?, outstanding_balance = ?, payment_status = ?
        WHERE id = ?
      `).run(newPaid, Math.max(0, newBalance), newStatus, orderId);

      // C. Crear el Egreso Automáticamente
      const expenseDesc = `Pago a Proveedor: ${order.supplier_name} - Factura #${order.supplier_invoice_number || 'S/N'} - OC #${order.po_number || order.id}`;
      
      const realTotal = order.total_amount - (order.discount_amount || 0);
      const expenseDetails = {
        po_id: order.id,
        po_number: order.po_number,
        supplier_invoice_number: order.supplier_invoice_number,
        supplier_name: order.supplier_name,
        total_po_amount: realTotal,
        balance_before_payment: currentBalance,
        payment_amount: amount,
        outstanding_balance_after_payment: Math.max(0, newBalance), // Saldo después de este pago
        payment_notes: notes,
        payment_method: method,
        payment_reference: reference,
        retention_amount: retentionAmount,
        retention_type: retentionType
      };

      db.prepare(`
        INSERT INTO expenses (description, amount, category, date, details, created_at, method, reference)
        VALUES (?, ?, 'Pago Proveedores', ?, ?, DATETIME('now', 'localtime'), ?, ?)
      `).run(expenseDesc, amount, date, JSON.stringify(expenseDetails), method, reference);
    });

    transaction();
    return { success: true };

  } catch (err) {
    console.error("Error al registrar pago de compra:", err);
    return { success: false, message: err.message };
  }
}

function getRetentionsReport({ startDate, endDate }) {
  try {
      const sql = `
          SELECT 
              p.date,
              s.name as supplier_name,
              o.po_number,
              o.supplier_invoice_number,
              p.retention_type,
              p.retention_amount,
              p.amount as net_payment
          FROM purchase_payments p
          JOIN purchase_orders o ON p.purchase_order_id = o.id
          JOIN suppliers s ON o.supplier_id = s.id
          WHERE p.retention_amount > 0
          AND p.date BETWEEN ? AND ?
          ORDER BY p.date DESC
      `;
      return db.prepare(sql).all(startDate, endDate);
  } catch (err) {
      console.error(err);
      return [];
  }
}

function getDuePurchaseOrders() {
  return db.prepare(`
    SELECT po.*, s.name as supplier_name 
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    WHERE po.payment_status != 'paid' 
    AND po.due_date IS NOT NULL 
    AND po.due_date <= date('now', '+7 days')
    ORDER BY po.due_date ASC
  `).all();
}

// GESTIÓN DE SERVICIOS
function getServices(limit = 10, offset = 0, status = null, executionStatus = null) {
  let query = `
    SELECT s.*, c.name as client_name,
      (SELECT COALESCE(SUM(sp.quantity * CASE WHEN sp.price > 0 THEN sp.price ELSE COALESCE(pv.sale_price, p.sale_price) END), 0)
       FROM service_products sp 
       JOIN products p ON sp.product_id = p.id 
       LEFT JOIN product_variants pv ON sp.variant_id = pv.id
       WHERE sp.service_id = s.id
      ) as materials_cost,
      (SELECT COALESCE(SUM(amount), 0) FROM service_payments WHERE service_id = s.id) as paid_amount
    FROM services s 
    LEFT JOIN clients c ON s.client_id = c.id
  `;

  const params = [];
  const conditions = [];

  if (status && status !== 'all') {
    conditions.push("s.status = ?");
    params.push(status);
  }

  if (executionStatus && executionStatus !== 'all') {
    if (executionStatus === 'pending') conditions.push("s.performed_at IS NULL");
    else if (executionStatus === 'performed') conditions.push("s.performed_at IS NOT NULL");
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY s.id DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

function getServiceById(id) {
  const service = db.prepare("SELECT * FROM services WHERE id = ?").get(id);
  // Recalcular materials_cost y paid_amount para el detalle
  const materialsCostRow = db.prepare(`
    SELECT COALESCE(SUM(sp.quantity * CASE WHEN sp.price > 0 THEN sp.price ELSE COALESCE(pv.sale_price, p.sale_price) END), 0) as materials_cost
    FROM service_products sp 
    JOIN products p ON sp.product_id = p.id 
    LEFT JOIN product_variants pv ON sp.variant_id = pv.id
    WHERE sp.service_id = ?
  `).get(id);
  if (service) {
    const products = db.prepare(`
      SELECT sp.product_id, sp.quantity, sp.variant_id, sp.price,
             p.name, p.code, 
             COALESCE(pv.sale_price, p.sale_price) as sale_price,
             COALESCE(pv.special_price, p.special_price) as special_price,
             COALESCE(pv.special_price_2, p.special_price_2) as special_price_2,
             pv.name as variant_name
      FROM service_products sp
      JOIN products p ON sp.product_id = p.id
      LEFT JOIN product_variants pv ON sp.variant_id = pv.id
      WHERE sp.service_id = ?
    `).all(id);
    service.materials_cost = materialsCostRow.materials_cost;
    service.paid_amount = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM service_payments WHERE service_id = ?").get(id).total || 0;
    service.products = products;
  }
  return service;
}

function createService(data) {
  const insert = db.prepare("INSERT INTO services (name, description, price, client_id, status, scheduled_date) VALUES (?, ?, ?, ?, 'Abierto', ?)");
  const insertItem = db.prepare("INSERT INTO service_products (service_id, product_id, quantity, variant_id, price) VALUES (?, ?, ?, ?, ?)");
  const updateStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
  const getVariant = db.prepare("SELECT conversion_factor FROM product_variants WHERE id = ?");
  
  const trx = db.transaction((data) => {
    const info = insert.run(data.name, data.description, data.price, data.client_id || null, data.scheduled_date || null);
    const serviceId = info.lastInsertRowid;
    if (data.products && data.products.length > 0) {
      for (const p of data.products) {
        insertItem.run(serviceId, p.product_id, p.quantity, p.variant_id || null, p.price || 0);
        
        let factor = 1;
        if (p.variant_id) {
            const v = getVariant.get(p.variant_id);
            if (v) factor = v.conversion_factor;
        }
        // Descontar del inventario (Reserva)
        updateStock.run(p.quantity * factor, p.product_id);
      }
    }
    return serviceId;
  });
  
  try {
    const id = trx(data);
    return { success: true, message: "Servicio creado", id };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function updateService(data) {
  const current = db.prepare("SELECT status FROM services WHERE id = ?").get(data.id);
  if (current && current.status === 'Finalizado') {
    throw new Error("No se puede editar un servicio finalizado.");
  }

  const update = db.prepare("UPDATE services SET name = ?, description = ?, price = ?, client_id = ?, scheduled_date = ? WHERE id = ?");
  const deleteItems = db.prepare("DELETE FROM service_products WHERE service_id = ?");
  const insertItem = db.prepare("INSERT INTO service_products (service_id, product_id, quantity, variant_id, price) VALUES (?, ?, ?, ?, ?)");
  
  // Preparar consultas para manejo de stock
  const getOldItems = db.prepare("SELECT product_id, quantity, variant_id FROM service_products WHERE service_id = ?");
  const updateStock = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?"); // + para restaurar, - para descontar
  const getVariant = db.prepare("SELECT conversion_factor FROM product_variants WHERE id = ?");

  const trx = db.transaction((data) => {
    update.run(data.name, data.description, data.price, data.client_id || null, data.scheduled_date || null, data.id);
    
    // 1. Restaurar stock de ítems antiguos antes de borrarlos
    const oldItems = getOldItems.all(data.id);
    for (const item of oldItems) {
        let factor = 1;
        if (item.variant_id) {
            const v = getVariant.get(item.variant_id);
            if (v) factor = v.conversion_factor;
        }
        updateStock.run(item.quantity * factor, item.product_id);
    }

    deleteItems.run(data.id);

    if (data.products && data.products.length > 0) {
      for (const p of data.products) {
        insertItem.run(data.id, p.product_id, p.quantity, p.variant_id || null, p.price || 0);
        let factor = 1;
        if (p.variant_id) {
            const v = getVariant.get(p.variant_id);
            if (v) factor = v.conversion_factor;
        }
        // Descontar nuevo stock (usamos negativo en la query que suma)
        updateStock.run(-(p.quantity * factor), p.product_id);
      }
    }
  });

  try {
    trx(data);
    return { success: true, message: "Servicio actualizado" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function deleteService(id) {
  const current = db.prepare("SELECT status FROM services WHERE id = ?").get(id);
  if (current && current.status === 'Finalizado') {
    throw new Error("No se puede eliminar un servicio finalizado.");
  }

  const getItems = db.prepare("SELECT product_id, quantity FROM service_products WHERE service_id = ?");
  const getItemsWithVariant = db.prepare("SELECT product_id, quantity, variant_id FROM service_products WHERE service_id = ?");
  const updateStock = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
  const delService = db.prepare("DELETE FROM services WHERE id = ?");
  const getVariant = db.prepare("SELECT conversion_factor FROM product_variants WHERE id = ?");

  const trx = db.transaction((id) => {
    // Solo devolver stock si NO estaba anulado (porque al anular ya se devolvió)
    if (current.status !== 'Anulado') {
        const items = getItemsWithVariant.all(id);
        for(const item of items) {
            let factor = 1;
            if (item.variant_id) {
                const v = getVariant.get(item.variant_id);
                if (v) factor = v.conversion_factor;
            }
            updateStock.run(item.quantity * factor, item.product_id);
        }
    }
    delService.run(id);
  });
  try {
    trx(id);
    return { success: true, message: "Servicio eliminado" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function getPendingScheduledServices(limit = 5) {
  return db.prepare(`
    SELECT s.id, s.name, s.scheduled_date, c.name as client_name
    FROM services s
    LEFT JOIN clients c ON s.client_id = c.id
    WHERE s.scheduled_date IS NOT NULL 
      AND s.performed_at IS NULL
      AND s.status != 'Anulado'
    ORDER BY s.scheduled_date ASC
    LIMIT ?
  `).all(limit);
}

function getOpenServicesList(limit = 5) {
  return db.prepare(`
    SELECT s.id, s.name, c.name as client_name, s.price
    FROM services s
    LEFT JOIN clients c ON s.client_id = c.id
    WHERE s.status = 'Abierto'
    ORDER BY s.id DESC
    LIMIT ?
  `).all(limit);
}

function markServicePerformed(id) {
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    db.prepare("UPDATE services SET performed_at = ? WHERE id = ?").run(now, id);
    return { success: true, message: "Servicio marcado como realizado" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function updateServiceStatus(id, status) {
  try {
    db.prepare("UPDATE services SET status = ? WHERE id = ?").run(status, id);
    return { success: true, message: "Estado actualizado" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function cancelService(id) {
  const current = db.prepare("SELECT status FROM services WHERE id = ?").get(id);
  if (!current) throw new Error("Servicio no encontrado");
  if (current.status === 'Finalizado') throw new Error("No se puede anular un servicio finalizado.");
  if (current.status === 'Anulado') throw new Error("El servicio ya está anulado.");

  const getItems = db.prepare("SELECT product_id, quantity, variant_id FROM service_products WHERE service_id = ?");
  const updateStock = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
  const getVariant = db.prepare("SELECT conversion_factor FROM product_variants WHERE id = ?");

  const trx = db.transaction(() => {
    const items = getItems.all(id);
    for(const item of items) {
        let factor = 1;
        if (item.variant_id) {
            const v = getVariant.get(item.variant_id);
            if (v) factor = v.conversion_factor;
        }
        updateStock.run(item.quantity * factor, item.product_id);
    }
    db.prepare("UPDATE services SET status = 'Anulado' WHERE id = ?").run(id);
  });

  try {
    trx();
    return { success: true, message: "Servicio anulado y stock restaurado." };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function addServicePayment(serviceId, amount, method, reference) {
  const service = db.prepare("SELECT name FROM services WHERE id = ?").get(serviceId);
  if (!service) throw new Error("Servicio no encontrado");

  const trx = db.transaction(() => {
    // 1. Registrar pago en servicio
    const insertStmt = db.prepare(`
      INSERT INTO service_payments (service_id, amount, method, reference, date)
      VALUES (?, ?, ?, ?, DATETIME('now', 'localtime'))
    `);
    const res = insertStmt.run(serviceId, amount, method, reference);

    // 2. Registrar movimiento de caja (Impacto real en caja HOY)
    const cashRegister = require("./cashRegister");
    const session = cashRegister.getActiveSession();
    if (session) {
      const subType = (method === 'cash') ? 'service_payment_cash' : 'service_payment_transfer';
      cashRegister.addCashMovement(session.id, "in", subType, amount, `Abono Servicio #${serviceId} - ${service.name}`, serviceId);
    }

    // debug logging removed
  });
  
  try {
    trx();
    return { success: true, message: "Abono registrado correctamente" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function getServicePayments(serviceId) {
  return db.prepare("SELECT * FROM service_payments WHERE service_id = ? ORDER BY date DESC").all(serviceId);
}

// AUTENTICACIÓN Y USUARIOS
function login(username, password) {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) return { success: false, message: "Usuario no encontrado" };
  
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (hash !== user.password_hash) return { success: false, message: "Contraseña incorrecta" };
  
  return { success: true, user: { id: user.id, username: user.username, role: user.role, name: user.name } };
}

function getUsers() {
  return db.prepare("SELECT id, username, role, name FROM users").all();
}

function createUser(u) {
  try {
    const hash = crypto.createHash('sha256').update(u.password).digest('hex');
    db.prepare("INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)").run(u.username, hash, u.role, u.name);
    return { success: true, message: "Usuario creado" };
  } catch (e) { return { success: false, message: String(e) }; }
}

function updateUser(u) {
  try {
    if (u.password && u.password.trim() !== "") {
      const hash = crypto.createHash('sha256').update(u.password).digest('hex');
      db.prepare("UPDATE users SET username=?, password_hash=?, role=?, name=? WHERE id=?").run(u.username, hash, u.role, u.name, u.id);
    } else {
      db.prepare("UPDATE users SET username=?, role=?, name=? WHERE id=?").run(u.username, u.role, u.name, u.id);
    }
    return { success: true, message: "Usuario actualizado" };
  } catch (e) { return { success: false, message: String(e) }; }
}

function deleteUser(id) {
  try {
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    return { success: true, message: "Usuario eliminado" };
  } catch (e) { return { success: false, message: String(e) }; }
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
  getProducts, getProductById, addProduct, updateProduct, deleteProduct, updateSale,
  // ventas
  createSale, createSaleFromQuote, getSales, getSaleById, getSaleItems, getSalePaymentById, deleteSale, deleteSaleItem, assignReceiptNumber,
  getSalePayments, getLastInvoiceNumber, setInvoiceNumber, 
  annulSale, // Nueva función para anular ventas
  updateSaleNotes, // creditos
  getCredits, addCreditPayment, markCreditAsPaid,
  // cotizaciones
  createQuote, getQuotes, getQuoteById, getQuoteItems, deleteQuote, updateQuote, updateQuoteDetails,
  getLastQuoteNumber, setQuoteNumber,
  // dashboard
  getDashboardData,
  // company
  getCompanySettings, updateCompanySettings, saveCompanySettings,
  // inventario
  getInventory, getInventoryTotalValue,
  // gastos
  getExpenses, getExpenseById, saveExpense, deleteExpense,
  // reportes
  getSalesReport,
  // Ordenes de compra,
  createPurchaseOrder, getPurchaseOrders, getPurchaseOrderById, receivePurchaseOrder, deletePurchaseOrder, updatePurchaseOrder, getPurchasePaymentById, getPurchasePaymentDetailsForPdf, getSalePaymentDetailsForPdf, getServicePaymentDetailsForPdf,
  // Pagos compras,
  updatePurchaseInvoiceNumber, addPurchasePayment, getPurchasePayments,
  getRetentionsReport,
  getDuePurchaseOrders,
  // Servicios
  getServices, getServiceById, createService, updateService, deleteService, updateServiceStatus, cancelService, addServicePayment, getServicePayments, getServicePaymentById, markServicePerformed, getPendingScheduledServices, getOpenServicesList,
  // Usuarios
  login, getUsers, createUser, deleteUser, updateUser,
  getSalesLastDays,
  // Auditoría
  logAction, getAuditLogs
};