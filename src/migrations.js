const fs = require("node:fs");
const path = require("node:path");

const BUSINESS_TYPES = [
  ["FERRETERIA", "Ferretería y materiales", "Herramientas y materiales de construcción"],
  ["VETERINARIA", "Veterinaria y tienda de mascotas", "Productos, alimentos y servicios veterinarios"],
  ["FARMACIA", "Farmacia / Droguería", "Medicamentos y productos de cuidado"],
  ["ROPA", "Tienda de ropa", "Prendas y accesorios de vestir"],
  ["CALZADO", "Tienda de calzado", "Calzado y accesorios"],
  ["TALLER_MOTOS", "Taller de motos", "Reparación y mantenimiento de motocicletas"],
  ["TALLER_AUTOMOTRIZ", "Taller automotriz", "Reparación y mantenimiento de vehículos"],
  ["REPUESTOS", "Repuestos y autopartes", "Repuestos, autopartes y componentes"],
  ["AIRES_ACONDICIONADOS", "Aires acondicionados", "Venta, instalación y mantenimiento"],
  ["CALEFACCION", "Calefacción", "Equipos, accesorios, instalación y mantenimiento de calefacción"],
  ["NATURISTA", "Tienda naturista", "Productos naturales y suplementos"],
  ["TECNOLOGIA", "Tecnología y celulares", "Equipos tecnológicos, celulares y accesorios"],
  ["MINIMERCADO", "Minimercado", "Comercio minorista de consumo"],
  ["PAPELERIA_MISCELANEA", "Papelería / Miscelánea", "Papelería, útiles y artículos varios"],
  ["SERVICIOS", "Empresa de servicios", "Servicios profesionales o técnicos"],
  ["GENERAL", "Comercio general", "Catálogo general configurable"],
  ["PERSONALIZADO", "Perfil personalizado", "Configuración personalizada"],
];

const PRODUCT_TYPES = [
  ["PRODUCTO", "Producto", "Artículo físico para venta"],
  ["SERVICIO", "Servicio", "Servicio facturable"],
  ["MATERIAL", "Material", "Material utilizado en servicios"],
  ["REPUESTO", "Repuesto", "Repuesto o componente"],
  ["MEDICAMENTO", "Medicamento", "Medicamento o producto farmacéutico"],
  ["ALIMENTO", "Alimento", "Alimento o producto consumible"],
];

const UNITS = [
  ["UNIDAD", "Unidad", "un"], ["PIEZA", "Pieza", "pz"], ["CAJA", "Caja", "cj"],
  ["PAQUETE", "Paquete", "paq"], ["DOCENA", "Docena", "doc"], ["PAR", "Par", "par"],
  ["BULTO_SACO", "Bulto / Saco", "bto"], ["TUBO_TIRA", "Tubo / Tira", "tbo"], ["ROLLO", "Rollo", "roll"],
  ["METRO", "Metro", "m"], ["CENTIMETRO", "Centímetro", "cm"], ["KILOGRAMO", "Kilogramo", "kg"],
  ["GRAMO", "Gramo", "g"], ["LIBRA", "Libra", "lb"], ["LITRO", "Litro", "L"],
  ["MILILITRO", "Mililitro", "ml"], ["GALON", "Galón", "gal"], ["METRO_CUADRADO", "Metro cuadrado", "m2"],
  ["METRO_CUBICO", "Metro cúbico", "m3"], ["HORA", "Hora", "h"], ["SERVICIO", "Servicio", "srv"],
];

const ATTRIBUTES = [
  ["marca", "Marca", "text"], ["material", "Material", "text"], ["presentacion", "Presentación", "text"],
  ["peso", "Peso", "text"], ["color", "Color", "text"], ["talla", "Talla", "text"],
  ["genero", "Género", "text"], ["referencia", "Referencia", "text"], ["lote", "Lote", "text"],
  ["vencimiento", "Fecha de vencimiento", "date"], ["principio_activo", "Principio activo", "text"],
  ["concentracion", "Concentración", "text"], ["laboratorio", "Laboratorio", "text"],
  ["requiere_formula", "Requiere fórmula", "boolean"], ["especie", "Especie", "text"],
  ["modelo", "Modelo", "text"], ["btu", "BTU", "number"], ["voltaje", "Voltaje", "text"],
  ["refrigerante", "Refrigerante", "text"], ["garantia", "Garantía", "text"], ["imei_serial", "IMEI / Serial", "text"],
  ["capacidad", "Capacidad", "text"], ["memoria", "Memoria", "text"], ["almacenamiento", "Almacenamiento", "text"],
  ["medida", "Medida", "text"], ["diametro", "Diámetro", "text"], ["longitud", "Longitud", "text"],
  ["ancho", "Ancho", "text"], ["alto", "Alto", "text"], ["tipo_rosca", "Tipo de rosca", "text"],
  ["edad_recomendada", "Edad recomendada", "text"], ["condiciones_almacenamiento", "Condiciones de almacenamiento", "text"],
  ["registro_sanitario", "Registro sanitario", "text"], ["temporada", "Temporada", "text"],
  ["marca_compatible", "Marca compatible", "text"], ["modelo_compatible", "Modelo compatible", "text"],
  ["anio", "Año", "number"], ["cilindraje", "Cilindraje", "text"], ["codigo_oem", "Código OEM", "text"],
  ["ubicacion", "Ubicación", "text"], ["tipo_equipo", "Tipo de equipo", "text"], ["eficiencia", "Eficiencia", "text"],
  ["requiere_instalacion", "Requiere instalación", "boolean"], ["incluye_instalacion", "Incluye instalación", "boolean"],
  ["ingredientes", "Ingredientes", "text"], ["contenido", "Contenido", "text"], ["advertencias", "Advertencias", "text"],
  ["sabor", "Sabor", "text"], ["fecha_produccion", "Fecha de producción", "date"], ["unidad_negocio", "Unidad de negocio", "text"],
  ["tipo_servicio", "Tipo de servicio", "text"], ["duracion_estimada", "Duración estimada", "text"], ["requiere_visita", "Requiere visita", "boolean"],
  ["grado_escolar", "Grado escolar", "text"], ["tema", "Tema", "text"], ["autor", "Autor", "text"],
  ["tipo_articulo", "Tipo de artículo", "text"], ["observaciones", "Observaciones", "text"],
];

const BUSINESS_ATTRIBUTE_CODES = {
  FERRETERIA: ["material", "marca", "medida", "diametro", "longitud", "ancho", "alto", "peso", "color", "tipo_rosca", "referencia"],
  VETERINARIA: ["especie", "marca", "presentacion", "peso", "edad_recomendada", "lote", "vencimiento", "condiciones_almacenamiento"],
  FARMACIA: ["principio_activo", "concentracion", "presentacion", "laboratorio", "lote", "vencimiento", "registro_sanitario", "requiere_formula", "condiciones_almacenamiento"],
  ROPA: ["talla", "color", "genero", "material", "marca", "referencia", "temporada"],
  CALZADO: ["talla", "color", "material", "marca", "referencia", "genero", "temporada"],
  TALLER_MOTOS: ["marca_compatible", "modelo_compatible", "anio", "cilindraje", "codigo_oem", "referencia", "ubicacion", "garantia"],
  TALLER_AUTOMOTRIZ: ["marca_compatible", "modelo_compatible", "anio", "cilindraje", "codigo_oem", "referencia", "ubicacion", "garantia"],
  REPUESTOS: ["marca_compatible", "modelo_compatible", "anio", "codigo_oem", "referencia", "ubicacion", "garantia"],
  AIRES_ACONDICIONADOS: ["marca", "modelo", "btu", "voltaje", "tipo_equipo", "refrigerante", "eficiencia", "garantia", "requiere_instalacion", "incluye_instalacion"],
  CALEFACCION: ["marca", "modelo", "voltaje", "tipo_equipo", "eficiencia", "garantia", "requiere_instalacion", "incluye_instalacion"],
  NATURISTA: ["ingredientes", "presentacion", "peso", "contenido", "marca", "lote", "vencimiento", "advertencias", "condiciones_almacenamiento"],
  TECNOLOGIA: ["marca", "modelo", "capacidad", "memoria", "almacenamiento", "color", "imei_serial", "garantia"],
  MINIMERCADO: ["marca", "presentacion", "sabor", "peso", "contenido", "lote", "vencimiento", "fecha_produccion", "condiciones_almacenamiento"],
  PAPELERIA_MISCELANEA: ["marca", "tipo_articulo", "grado_escolar", "tema", "autor", "color", "material"],
  SERVICIOS: ["tipo_servicio", "duracion_estimada", "requiere_visita", "garantia", "observaciones"],
  GENERAL: ["marca", "referencia", "material", "color", "observaciones"],
  PERSONALIZADO: ["marca", "referencia", "tipo_articulo", "observaciones"],
};

const BUSINESS_UNIT_CODES = {
  FERRETERIA: ["UNIDAD", "PIEZA", "CAJA", "PAQUETE", "BULTO_SACO", "TUBO_TIRA", "ROLLO", "METRO", "KILOGRAMO", "GRAMO", "LITRO", "METRO_CUADRADO"],
  VETERINARIA: ["UNIDAD", "GRAMO", "KILOGRAMO", "MILILITRO", "LITRO"],
  FARMACIA: ["UNIDAD", "CAJA", "PAQUETE", "GRAMO", "MILILITRO"],
  ROPA: ["UNIDAD", "PAR"],
  CALZADO: ["PAR", "UNIDAD"],
  TALLER_MOTOS: ["UNIDAD", "HORA", "SERVICIO"],
  TALLER_AUTOMOTRIZ: ["UNIDAD", "HORA", "SERVICIO"],
  REPUESTOS: ["UNIDAD", "CAJA", "PAQUETE"],
  AIRES_ACONDICIONADOS: ["UNIDAD", "SERVICIO", "HORA"],
  CALEFACCION: ["UNIDAD", "SERVICIO", "HORA"],
  NATURISTA: ["UNIDAD", "GRAMO", "KILOGRAMO", "MILILITRO", "LITRO"],
  TECNOLOGIA: ["UNIDAD", "PIEZA", "PAR"],
  MINIMERCADO: ["UNIDAD", "CAJA", "PAQUETE", "GRAMO", "KILOGRAMO", "MILILITRO", "LITRO"],
  PAPELERIA_MISCELANEA: ["UNIDAD", "PIEZA", "PAQUETE", "CAJA"],
  SERVICIOS: ["SERVICIO", "HORA", "UNIDAD"],
  GENERAL: ["UNIDAD", "PIEZA", "CAJA", "PAQUETE", "KILOGRAMO", "LITRO", "SERVICIO"],
  PERSONALIZADO: ["UNIDAD", "PIEZA", "SERVICIO"],
};

function hasTable(db, tableName) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
}

function hasColumn(db, tableName, columnName) {
  return db.prepare(`PRAGMA table_info([${tableName}])`).all().some(column => column.name === columnName);
}

function addColumnIfMissing(db, tableName, columnName, definition) {
  if (!hasColumn(db, tableName, columnName)) {
    db.prepare(`ALTER TABLE [${tableName}] ADD COLUMN [${columnName}] ${definition}`).run();
  }
}

function createBackup(dbPath, backupDirectory) {
  if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) return null;

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const destinationDirectory = backupDirectory || path.dirname(dbPath);
  fs.mkdirSync(destinationDirectory, { recursive: true });
  const backupPath = path.join(destinationDirectory, `${path.basename(dbPath)}.backup-${stamp}`);
  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

function migration001(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS business_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT (DATETIME('now', 'localtime')),
      updated_at DATETIME NOT NULL DEFAULT (DATETIME('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY,
      company_name TEXT,
      company_id_card_or_nit TEXT,
      company_address TEXT,
      company_email TEXT,
      company_phone TEXT,
      logo_path TEXT
    );
  `);

  const insertBusinessType = db.prepare(`
    INSERT INTO business_types (code, name, description)
    VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      updated_at = DATETIME('now', 'localtime')
  `);

  for (const businessType of BUSINESS_TYPES) {
    insertBusinessType.run(...businessType);
  }

  addColumnIfMissing(db, "company_settings", "business_type_id", "INTEGER");
  addColumnIfMissing(db, "company_settings", "currency_code", "TEXT NOT NULL DEFAULT 'COP'");
  addColumnIfMissing(db, "company_settings", "country_code", "TEXT NOT NULL DEFAULT 'CO'");
  addColumnIfMissing(db, "company_settings", "inventory_config", "TEXT");
  addColumnIfMissing(db, "company_settings", "sales_config", "TEXT");
  addColumnIfMissing(db, "company_settings", "services_config", "TEXT");
  addColumnIfMissing(db, "company_settings", "printing_config", "TEXT");
  addColumnIfMissing(db, "company_settings", "initial_setup_completed", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "company_settings", "created_at", "DATETIME");
  addColumnIfMissing(db, "company_settings", "updated_at", "DATETIME");

  db.prepare(`
    UPDATE company_settings
    SET created_at = COALESCE(created_at, DATETIME('now', 'localtime')),
        updated_at = COALESCE(updated_at, DATETIME('now', 'localtime'))
    WHERE id = 1
  `).run();
}

function migration002(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT (DATETIME('now', 'localtime')),
      updated_at DATETIME NOT NULL DEFAULT (DATETIME('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS units_of_measure (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      abbreviation TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT (DATETIME('now', 'localtime')),
      updated_at DATETIME NOT NULL DEFAULT (DATETIME('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS business_type_product_types (
      business_type_id INTEGER NOT NULL,
      product_type_id INTEGER NOT NULL,
      required INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (business_type_id, product_type_id),
      FOREIGN KEY (business_type_id) REFERENCES business_types(id) ON DELETE CASCADE,
      FOREIGN KEY (product_type_id) REFERENCES product_types(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS business_type_units (
      business_type_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      PRIMARY KEY (business_type_id, unit_id),
      FOREIGN KEY (business_type_id) REFERENCES business_types(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES units_of_measure(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS attribute_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      value_type TEXT NOT NULL DEFAULT 'text',
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT (DATETIME('now', 'localtime')),
      updated_at DATETIME NOT NULL DEFAULT (DATETIME('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS business_type_attributes (
      business_type_id INTEGER NOT NULL,
      attribute_id INTEGER NOT NULL,
      required INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (business_type_id, attribute_id),
      FOREIGN KEY (business_type_id) REFERENCES business_types(id) ON DELETE CASCADE,
      FOREIGN KEY (attribute_id) REFERENCES attribute_definitions(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS product_attribute_values (
      product_id INTEGER NOT NULL,
      attribute_id INTEGER NOT NULL,
      value TEXT,
      PRIMARY KEY (product_id, attribute_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (attribute_id) REFERENCES attribute_definitions(id) ON DELETE CASCADE
    );
  `);

  addColumnIfMissing(db, "products", "product_type_id", "INTEGER");
  addColumnIfMissing(db, "products", "base_unit_id", "INTEGER");
  addColumnIfMissing(db, "product_variants", "unit_id", "INTEGER");

  const insertType = db.prepare(`INSERT INTO product_types (code, name, description) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET name=excluded.name, description=excluded.description, updated_at=DATETIME('now','localtime')`);
  PRODUCT_TYPES.forEach(type => insertType.run(...type));
  const insertUnit = db.prepare(`INSERT INTO units_of_measure (code, name, abbreviation) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET name=excluded.name, abbreviation=excluded.abbreviation, updated_at=DATETIME('now','localtime')`);
  UNITS.forEach(unit => insertUnit.run(...unit));
  const insertAttribute = db.prepare(`INSERT INTO attribute_definitions (code, name, value_type) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET name=excluded.name, value_type=excluded.value_type, updated_at=DATETIME('now','localtime')`);
  ATTRIBUTES.forEach(attribute => insertAttribute.run(...attribute));

  const general = db.prepare("SELECT id FROM business_types WHERE code = 'GENERAL'").get();
  const allProductType = db.prepare("SELECT id FROM product_types WHERE code = 'PRODUCTO'").get();
  const unit = db.prepare("SELECT id FROM units_of_measure WHERE code = 'UNIDAD'").get();
  if (general && allProductType) db.prepare("INSERT OR IGNORE INTO business_type_product_types (business_type_id, product_type_id) VALUES (?, ?)").run(general.id, allProductType.id);
  if (general && unit) db.prepare("INSERT OR IGNORE INTO business_type_units (business_type_id, unit_id) VALUES (?, ?)").run(general.id, unit.id);

  const insertBusinessAttribute = db.prepare("INSERT OR IGNORE INTO business_type_attributes (business_type_id, attribute_id, sort_order) VALUES (?, ?, ?)");
  const insertBusinessUnit = db.prepare("INSERT OR IGNORE INTO business_type_units (business_type_id, unit_id) VALUES (?, ?)");
  const insertBusinessProductType = db.prepare("INSERT OR IGNORE INTO business_type_product_types (business_type_id, product_type_id) VALUES (?, ?)");
  for (const [businessCode, attributeCodes] of Object.entries(BUSINESS_ATTRIBUTE_CODES)) {
    const business = db.prepare("SELECT id FROM business_types WHERE code = ?").get(businessCode);
    if (!business) continue;
    attributeCodes.forEach((code, index) => {
      const attribute = db.prepare("SELECT id FROM attribute_definitions WHERE code = ?").get(code);
      if (attribute) insertBusinessAttribute.run(business.id, attribute.id, index);
    });
    (BUSINESS_UNIT_CODES[businessCode] || []).forEach(code => {
      const businessUnit = db.prepare("SELECT id FROM units_of_measure WHERE code = ?").get(code);
      if (businessUnit) insertBusinessUnit.run(business.id, businessUnit.id);
    });
    if (allProductType) insertBusinessProductType.run(business.id, allProductType.id);
  }
}

function migration003(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      variant_id INTEGER,
      movement_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      stock_before REAL NOT NULL,
      stock_after REAL NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      reason TEXT,
      user_id INTEGER,
      created_at DATETIME NOT NULL DEFAULT (DATETIME('now', 'localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference ON inventory_movements(reference_type, reference_id);
  `);
}

function migration004(db) {
  addColumnIfMissing(db, "products", "active", "INTEGER NOT NULL DEFAULT 1");
  db.prepare("UPDATE products SET active = 1 WHERE active IS NULL").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_products_active_name ON products(active, name)").run();
}

function migration005(db) {
  addColumnIfMissing(db, "business_types", "sort_order", "INTEGER NOT NULL DEFAULT 0");

  // Preserve existing references while adopting the clearer business codes.
  db.prepare("UPDATE business_types SET code = 'TALLER_MOTOS', name = 'Taller de motos' WHERE code = 'TALLER'").run();
  db.prepare("UPDATE business_types SET code = 'CALEFACCION', name = 'Calefacción' WHERE code = 'CALEFACTORES'").run();
  db.prepare("UPDATE business_types SET code = 'PAPELERIA_MISCELANEA', name = 'Papelería / Miscelánea' WHERE code = 'PAPELERIA'").run();

  const insertBusinessType = db.prepare(`
    INSERT INTO business_types (code, name, description, sort_order)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      sort_order = excluded.sort_order,
      updated_at = DATETIME('now', 'localtime')
  `);
  BUSINESS_TYPES.forEach((businessType, index) => insertBusinessType.run(...businessType, index + 1));

  const motos = db.prepare("SELECT id FROM business_types WHERE code = 'TALLER_MOTOS'").get();
  const automotive = db.prepare("SELECT id FROM business_types WHERE code = 'TALLER_AUTOMOTRIZ'").get();
  if (motos && automotive) {
    db.prepare(`
      INSERT OR IGNORE INTO business_type_attributes (business_type_id, attribute_id, required, sort_order)
      SELECT ?, attribute_id, required, sort_order FROM business_type_attributes WHERE business_type_id = ?
    `).run(automotive.id, motos.id);
    db.prepare(`
      INSERT OR IGNORE INTO business_type_units (business_type_id, unit_id)
      SELECT ?, unit_id FROM business_type_units WHERE business_type_id = ?
    `).run(automotive.id, motos.id);
    const productType = db.prepare("SELECT id FROM product_types WHERE code = 'PRODUCTO'").get();
    if (productType) db.prepare("INSERT OR IGNORE INTO business_type_product_types (business_type_id, product_type_id) VALUES (?, ?)").run(automotive.id, productType.id);
  }
}

function migration006(db) {
  const insertAttribute = db.prepare(`
    INSERT INTO attribute_definitions (code, name, value_type)
    VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      value_type = excluded.value_type,
      updated_at = DATETIME('now', 'localtime')
  `);
  ATTRIBUTES.forEach(attribute => insertAttribute.run(...attribute));

  const insertBusinessAttribute = db.prepare(`
    INSERT INTO business_type_attributes (business_type_id, attribute_id, required, sort_order)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(business_type_id, attribute_id) DO UPDATE SET
      sort_order = excluded.sort_order
  `);
  const requiredAttributes = new Set([
    "principio_activo", "concentracion", "presentacion", "especie", "talla", "marca_compatible",
    "modelo_compatible", "tipo_equipo", "tipo_servicio", "ingredientes", "lote", "vencimiento"
  ]);
  for (const [businessCode, attributeCodes] of Object.entries(BUSINESS_ATTRIBUTE_CODES)) {
    const business = db.prepare("SELECT id FROM business_types WHERE code = ?").get(businessCode);
    if (!business) continue;
    attributeCodes.forEach((code, index) => {
      const attribute = db.prepare("SELECT id FROM attribute_definitions WHERE code = ?").get(code);
      if (attribute) insertBusinessAttribute.run(business.id, attribute.id, requiredAttributes.has(code) ? 1 : 0, index);
    });
  }

  const insertBusinessUnit = db.prepare("INSERT OR IGNORE INTO business_type_units (business_type_id, unit_id) VALUES (?, ?)");
  for (const [businessCode, unitCodes] of Object.entries(BUSINESS_UNIT_CODES)) {
    const business = db.prepare("SELECT id FROM business_types WHERE code = ?").get(businessCode);
    if (!business) continue;
    unitCodes.forEach(code => {
      const unit = db.prepare("SELECT id FROM units_of_measure WHERE code = ?").get(code);
      if (unit) insertBusinessUnit.run(business.id, unit.id);
    });
  }
}

function migration007(db) {
  const requiredByBusiness = {
    FARMACIA: ["principio_activo", "concentracion", "presentacion", "laboratorio", "lote", "vencimiento"],
    VETERINARIA: ["especie", "marca", "presentacion", "lote", "vencimiento"],
    ROPA: ["talla", "color"],
    CALZADO: ["talla", "color"],
    TALLER_MOTOS: ["marca_compatible", "modelo_compatible", "referencia"],
    TALLER_AUTOMOTRIZ: ["marca_compatible", "modelo_compatible", "referencia"],
    REPUESTOS: ["marca_compatible", "modelo_compatible", "codigo_oem", "referencia"],
    AIRES_ACONDICIONADOS: ["marca", "modelo", "tipo_equipo", "btu"],
    CALEFACCION: ["marca", "modelo", "tipo_equipo"],
    NATURISTA: ["ingredientes", "presentacion", "lote", "vencimiento"],
    TECNOLOGIA: ["marca", "modelo", "garantia"],
    MINIMERCADO: ["presentacion", "lote", "vencimiento"],
    PAPELERIA_MISCELANEA: ["tipo_articulo"],
    SERVICIOS: ["tipo_servicio"],
  };

  const clearAttributes = db.prepare("DELETE FROM business_type_attributes WHERE business_type_id = ?");
  const insertAttribute = db.prepare("INSERT INTO business_type_attributes (business_type_id, attribute_id, required, sort_order) VALUES (?, ?, ?, ?)");
  for (const [businessCode, attributeCodes] of Object.entries(BUSINESS_ATTRIBUTE_CODES)) {
    const business = db.prepare("SELECT id FROM business_types WHERE code = ?").get(businessCode);
    if (!business) continue;
    clearAttributes.run(business.id);
    attributeCodes.forEach((code, index) => {
      const attribute = db.prepare("SELECT id FROM attribute_definitions WHERE code = ? AND active = 1").get(code);
      if (attribute) insertAttribute.run(business.id, attribute.id, requiredByBusiness[businessCode]?.includes(code) ? 1 : 0, index);
    });
  }
}

function migration008(db) {
  db.prepare(`
    INSERT INTO inventory_movements
      (product_id, movement_type, quantity, stock_before, stock_after, reference_type, reason)
    SELECT p.id, 'INITIAL', p.stock, 0, p.stock, 'migration', 'Saldo inicial detectado al activar la trazabilidad'
    FROM products p
    WHERE p.stock != 0
      AND NOT EXISTS (
        SELECT 1 FROM inventory_movements im WHERE im.product_id = p.id
      )
  `).run();
}

function migration009(db) {
  addColumnIfMissing(db, "products", "base_content_units", "INTEGER");
  addColumnIfMissing(db, "product_variants", "content_units", "INTEGER");
}

function migration010(db) {
  addColumnIfMissing(db, "products", "sale_type", "TEXT NOT NULL DEFAULT 'SIMPLE'");
  const pharmacy = db.prepare("SELECT id FROM business_types WHERE code = 'FARMACIA'").get();
  const settings = db.prepare("SELECT business_type_id FROM company_settings WHERE id = 1").get();
  if (pharmacy && settings?.business_type_id === pharmacy.id) {
    db.prepare("UPDATE products SET sale_type = 'FRACCTIONED', base_content_units = COALESCE(base_content_units, 1) WHERE sale_type = 'SIMPLE'").run();
    const products = db.prepare("SELECT id, base_content_units FROM products WHERE sale_type = 'FRACCTIONED'").all();
    const variants = db.prepare("SELECT id, product_id, conversion_factor FROM product_variants WHERE content_units IS NULL").all();
    const updateVariant = db.prepare("UPDATE product_variants SET content_units = ? WHERE id = ?");
    for (const variant of variants) {
      const product = products.find(item => item.id === variant.product_id);
      if (product) updateVariant.run(Math.max(1, Math.round(Number(variant.conversion_factor || 1) * product.base_content_units)), variant.id);
    }
  }
}

function migration011(db) {
  const insertUnit = db.prepare(`
    INSERT INTO units_of_measure (code, name, abbreviation)
    VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      abbreviation = excluded.abbreviation,
      updated_at = DATETIME('now', 'localtime')
  `);
  insertUnit.run("BULTO_SACO", "Bulto / Saco", "bto");
  insertUnit.run("TUBO_TIRA", "Tubo / Tira", "tbo");
  insertUnit.run("ROLLO", "Rollo", "roll");

  const hardware = db.prepare("SELECT id FROM business_types WHERE code = 'FERRETERIA'").get();
  if (!hardware) return;
  const insertMapping = db.prepare("INSERT OR IGNORE INTO business_type_units (business_type_id, unit_id) VALUES (?, ?)");
  for (const code of ["BULTO_SACO", "TUBO_TIRA", "ROLLO"]) {
    const unit = db.prepare("SELECT id FROM units_of_measure WHERE code = ?").get(code);
    if (unit) insertMapping.run(hardware.id, unit.id);
  }
}

function migration012(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      variant_id INTEGER,
      lot_number TEXT NOT NULL,
      expiration_date DATE,
      quantity REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT (DATETIME('now', 'localtime')),
      updated_at DATETIME NOT NULL DEFAULT (DATETIME('now', 'localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_inventory_lots_product_expiration ON inventory_lots(product_id, expiration_date);
  `);
}

function migration013(db) {
  const hasLegacyData = db.prepare(`
    SELECT EXISTS(SELECT 1 FROM products)
      OR EXISTS(SELECT 1 FROM sales)
      OR EXISTS(SELECT 1 FROM purchase_orders)
      OR EXISTS(SELECT 1 FROM services)
      OR EXISTS(SELECT 1 FROM clients)
      OR EXISTS(SELECT 1 FROM suppliers)
      OR EXISTS(SELECT 1 FROM expenses)
      OR EXISTS(SELECT 1 FROM cash_register_sessions)
      OR EXISTS(
        SELECT 1 FROM company_settings
        WHERE company_name IS NOT NULL
           OR company_id_card_or_nit IS NOT NULL
           OR company_address IS NOT NULL
           OR company_email IS NOT NULL
           OR company_phone IS NOT NULL
      ) AS has_data
  `).get().has_data;

  if (hasLegacyData) {
    db.prepare(`
      UPDATE company_settings
      SET initial_setup_completed = 1,
          updated_at = COALESCE(updated_at, DATETIME('now', 'localtime'))
      WHERE id = 1 AND initial_setup_completed = 0
    `).run();
  }
}

const MIGRATIONS = [
  { version: 1, name: "business-profile-and-installation-state", run: migration001 },
  { version: 2, name: "dynamic-product-catalogs", run: migration002 },
  { version: 3, name: "inventory-movement-ledger", run: migration003 },
  { version: 4, name: "logical-product-archive", run: migration004 },
  { version: 5, name: "business-type-display-catalog", run: migration005 },
  { version: 6, name: "complete-business-product-forms", run: migration006 },
  { version: 7, name: "normalize-business-form-fields", run: migration007 },
  { version: 8, name: "seed-initial-inventory-balances", run: migration008 },
  { version: 9, name: "pharmacy-integer-packaging-content", run: migration009 },
  { version: 10, name: "hardware-sale-strategy", run: migration010 },
  { version: 11, name: "hardware-packaging-units", run: migration011 },
  { version: 12, name: "inventory-lots-and-expiration", run: migration012 },
  { version: 13, name: "legacy-installation-baseline", run: migration013 },
];

function runMigrations(db, dbPath, backupDirectory) {
  const hasMigrationTable = hasTable(db, "schema_migrations");
  const applied = hasMigrationTable
    ? new Set(db.prepare("SELECT version FROM schema_migrations").all().map(row => row.version))
    : new Set();
  const pending = MIGRATIONS.filter(migration => !applied.has(migration.version));

  if (pending.length === 0) return { applied: [], backupPath: null };

  const backupPath = createBackup(dbPath, backupDirectory);
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT (DATETIME('now', 'localtime'))
    );
  `);

  try {
    db.transaction(() => {
      for (const migration of pending) {
        migration.run(db);
        db.prepare("INSERT INTO schema_migrations (version, name) VALUES (?, ?)")
          .run(migration.version, migration.name);
      }
    })();
  } catch (error) {
    throw new Error(`Migration failed${backupPath ? `; backup: ${backupPath}` : ""}: ${error.message}`);
  }

  return { applied: pending.map(migration => migration.version), backupPath };
}

module.exports = { runMigrations };
