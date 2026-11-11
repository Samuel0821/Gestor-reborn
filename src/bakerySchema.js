const { randomUUID } = require('node:crypto');

function migrateBakery(db) {
  db.prepare(`INSERT INTO business_types(code,name,description,sort_order) VALUES ('PANADERIA','Panadería','Materias primas, producción y venta de alimentos',14)
    ON CONFLICT(code) DO UPDATE SET name=excluded.name, description=excluded.description`).run();
  const business = db.prepare("SELECT id FROM business_types WHERE code='PANADERIA'").get().id;
  for (const code of ['PRODUCTO','ALIMENTO','MATERIAL']) {
    db.prepare(`INSERT OR IGNORE INTO business_type_product_types(business_type_id,product_type_id)
      SELECT ?,id FROM product_types WHERE code=?`).run(business, code);
  }
  for (const code of ['UNIDAD','PAQUETE','CAJA','DOCENA','BULTO_SACO','GRAMO','KILOGRAMO','LIBRA','LITRO','MILILITRO']) {
    db.prepare('INSERT OR IGNORE INTO business_type_units(business_type_id,unit_id) SELECT ?,id FROM units_of_measure WHERE code=?').run(business, code);
  }
  ['marca','presentacion','peso','contenido','ingredientes','sabor','fecha_produccion','condiciones_almacenamiento','observaciones'].forEach((code,index) => {
    db.prepare('INSERT OR IGNORE INTO business_type_attributes(business_type_id,attribute_id,required,sort_order) SELECT ?,id,0,? FROM attribute_definitions WHERE code=?').run(business,index,code);
  });
  db.exec(`
    CREATE TABLE bakery_settings(id INTEGER PRIMARY KEY CHECK(id=1), instance_id TEXT NOT NULL);
    CREATE TABLE bakery_permissions(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, permissions TEXT NOT NULL DEFAULT '[]');
    CREATE TABLE bakery_items(
      product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE RESTRICT,
      kind TEXT NOT NULL CHECK(kind IN ('raw','finished','resale')),
      unit TEXT NOT NULL CHECK(unit IN ('g','ml','unit')),
      retail_allowed INTEGER NOT NULL DEFAULT 0,
      attributes TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE bakery_recipes(
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL,
      payload TEXT NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), UNIQUE(name,version)
    );
    CREATE TABLE bakery_documents(
      id INTEGER PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('opening','receipt','production','loss','expense')),
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed','annulled')),
      request_id TEXT NOT NULL UNIQUE, doc_date TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id), confirmed_by INTEGER REFERENCES users(id),
      payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
      raw_cost REAL NOT NULL DEFAULT 0, other_cost REAL NOT NULL DEFAULT 0, total_cost REAL NOT NULL DEFAULT 0,
      expense_id INTEGER REFERENCES expenses(id), purchase_order_id INTEGER REFERENCES purchase_orders(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      confirmed_at TEXT, reversal_reason TEXT
    );
    CREATE TABLE bakery_lots(
      id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES bakery_items(product_id),
      document_id INTEGER REFERENCES bakery_documents(id), lot_number TEXT NOT NULL,
      expiration_date TEXT, quantity REAL NOT NULL CHECK(quantity >= -0.000001),
      initial_quantity REAL NOT NULL CHECK(initial_quantity>0), unit_cost REAL NOT NULL CHECK(unit_cost>=0),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX bakery_lots_product ON bakery_lots(product_id,expiration_date,id);
    CREATE TABLE bakery_lot_movements(
      id INTEGER PRIMARY KEY, lot_id INTEGER NOT NULL REFERENCES bakery_lots(id),
      movement_id INTEGER NOT NULL REFERENCES inventory_movements(id),
      quantity REAL NOT NULL, unit_cost REAL NOT NULL, reverse_of INTEGER REFERENCES bakery_lot_movements(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX bakery_lot_movements_stock ON bakery_lot_movements(movement_id);
    CREATE TABLE bakery_audit(
      id INTEGER PRIMARY KEY, actor_id INTEGER NOT NULL REFERENCES users(id), action TEXT NOT NULL,
      entity_id INTEGER, details TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE bakery_sale_events(id INTEGER PRIMARY KEY, sale_id INTEGER NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN ('sale','reversal')), actor_id INTEGER,
      occurred_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), UNIQUE(sale_id,event_type));
    CREATE TABLE bakery_sale_lines(event_id INTEGER NOT NULL REFERENCES bakery_sale_events(id),
      product_id INTEGER, name TEXT NOT NULL, quantity REAL NOT NULL, revenue REAL NOT NULL, cost REAL);
    CREATE TABLE bakery_sale_requests(request_id TEXT PRIMARY KEY, sale_id INTEGER NOT NULL REFERENCES sales(id));
    ALTER TABLE sale_items ADD COLUMN bakery_cost_total REAL;
  `);
  db.prepare('INSERT INTO bakery_settings(id,instance_id) VALUES (1,?)').run(randomUUID());
}
function migrateBakeryModules(db) {
  for (const [name, type] of [['bakery_unit','TEXT'],['bakery_lot_number','TEXT'],['bakery_expiration_date','TEXT']]) {
    if (!db.prepare('PRAGMA table_info(purchase_order_items)').all().some(row => row.name === name)) db.exec(`ALTER TABLE purchase_order_items ADD COLUMN ${name} ${type}`);
  }
  for (const row of db.prepare('SELECT product_id,unit,attributes FROM bakery_items').all()) {
    const attrs = JSON.parse(row.attributes || '{}');
    const canonical = { ...attrs, presentacion: attrs.presentacion || attrs.presentation, condiciones_almacenamiento: attrs.condiciones_almacenamiento || attrs.storage, observaciones: attrs.observaciones || attrs.notes };
    for (const [code,value] of Object.entries(canonical)) if (value != null && typeof value !== 'object') {
      db.prepare(`INSERT INTO product_attribute_values(product_id,attribute_id,value) SELECT ?,id,? FROM attribute_definitions WHERE code=?
        ON CONFLICT(product_id,attribute_id) DO UPDATE SET value=excluded.value`).run(row.product_id, String(value), code);
    }
    db.prepare('UPDATE bakery_items SET attributes=? WHERE product_id=?').run(JSON.stringify(canonical), row.product_id);
  }
}
module.exports = { migrateBakery, migrateBakeryModules };
