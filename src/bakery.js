const { randomUUID } = require('node:crypto');
const UNITS = { g: ['g', 1], kg: ['g', 1000], lb: ['g', 453.59237], ml: ['ml', 1], l: ['ml', 1000], unit: ['unit', 1], dozen: ['unit', 12] };
const AREAS = ['inventory', 'production', 'sales', 'reports'];
const EPS = 0.000001;
const today = () => new Date().toLocaleDateString('sv-SE');
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
function number(value, label, allowZero = false) {
  const n = Number(value);
  if (value === '' || value == null || !Number.isFinite(n) || (allowZero ? n < 0 : n <= 0)) throw new Error(`${label}: indica un número ${allowZero ? 'no negativo' : 'mayor que cero'}.`);
  return n;
}
function date(value = today()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) !== value) throw new Error('Fecha inválida.');
  return value;
}
function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} es obligatorio.`);
  return value.trim();
}

function createBakery(context) {
  const { db } = context;
  function enabled() {
    return Boolean(db.prepare(`SELECT 1 FROM company_settings c JOIN business_types b ON b.id=c.business_type_id WHERE c.id=1 AND b.code='PANADERIA'`).get());
  }
  function access(actor) {
    if (!enabled()) throw new Error('Esta función está disponible exclusivamente para Panadería.');
    const user = db.prepare('SELECT id,username,name,role FROM users WHERE id=?').get(actor?.id);
    if (!user) throw new Error('Inicia sesión para continuar.');
    const assigned = JSON.parse(db.prepare('SELECT permissions FROM bakery_permissions WHERE user_id=?').get(user.id)?.permissions || '[]');
    return { user, admin: user.role === 'admin', permissions: user.role === 'admin' ? AREAS : assigned,
      instance: db.prepare('SELECT instance_id FROM bakery_settings WHERE id=1').get().instance_id };
  }
  function requireArea(actor, area) {
    const result = access(actor);
    if (!result.admin && !result.permissions.includes(area)) throw new Error('No tienes autorización para esta área de Panadería.');
    return result;
  }
  function audit(actor, action, id, data) {
    db.prepare('INSERT INTO bakery_audit(actor_id,action,entity_id,details) VALUES (?,?,?,?)').run(actor.id, action, id || null, JSON.stringify(data));
  }
  function item(id) {
    const row = db.prepare(`SELECT p.*, b.kind,b.unit,b.retail_allowed,b.attributes FROM products p JOIN bakery_items b ON b.product_id=p.id WHERE p.id=? AND p.active=1`).get(id);
    if (!row) throw new Error('Registra o vincula el producto en Panadería antes de utilizarlo.');
    return row;
  }
  function quantity(line) {
    const product = item(line.product_id);
    const unit = UNITS[line.unit || product.unit];
    if (!unit || unit[0] !== product.unit) throw new Error(`La medida no corresponde a ${product.name}; no se convierte peso en volumen.`);
    const qty = number(line.quantity, product.name) * unit[1];
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('La cantidad convertida es demasiado grande o inválida.');
    if (product.unit === 'unit' && !Number.isInteger(qty)) throw new Error(`${product.name}: la cantidad debe ser entera.`);
    return { product, qty };
  }
  function canonicalAttributes(attrs = {}) {
    return { ...attrs, presentacion: attrs.presentacion ?? attrs.presentation ?? '', condiciones_almacenamiento: attrs.condiciones_almacenamiento ?? attrs.storage ?? '', observaciones: attrs.observaciones ?? attrs.notes ?? '' };
  }
  function decorateProduct(product) {
    if (!product) return product;
    const profile = db.prepare('SELECT * FROM bakery_items WHERE product_id=?').get(product.id);
    if (!profile) return product;
    const metadata = canonicalAttributes(JSON.parse(profile.attributes));
    return { ...product, attributes: { ...metadata, ...product.attributes }, bakery: { ...profile, attributes: metadata }, bakery_retail_allowed: Boolean(profile.retail_allowed) };
  }
  function saveProduct(data, actor) {
    requireArea(actor, 'inventory');
    return db.transaction(() => {
      const settings = data.bakery || {};
      const unitCode = db.prepare('SELECT code FROM units_of_measure WHERE id=?').get(data.base_unit_id)?.code;
      const code = settings.measure || ({ GRAMO:'g', KILOGRAMO:'kg', MILILITRO:'ml', LITRO:'l', UNIDAD:'unit' }[unitCode]);
      const measure = UNITS[code];
      if (!measure) throw new Error('Selecciona una unidad de medida válida.');
      const minimumCode = settings.minimum_unit || code, minimum = UNITS[minimumCode];
      if (!minimum || minimum[0] !== measure[0]) throw new Error('La medida de existencia mínima debe corresponder al producto.');
      const qty = number(data.stock ?? 0, 'Existencia', true) * measure[1];
      const min = number(data.min_stock ?? 0, 'Cantidad mínima', true) * minimum[1];
      if (!Number.isFinite(qty) || !Number.isFinite(min) || (measure[0] === 'unit' && (!Number.isInteger(qty) || !Number.isInteger(min)))) throw new Error('Las cantidades o medidas no son válidas.');
      const kind = settings.kind || (db.prepare('SELECT code FROM product_types WHERE id=?').get(data.product_type_id)?.code === 'MATERIAL' ? 'raw' : 'resale');
      if (!['raw','finished','resale'].includes(kind)) throw new Error('Selecciona materia prima, elaborado o reventa.');
      const cost = number(data.purchase_price ?? 0, 'Costo', true) / measure[1];
      const attrs = canonicalAttributes(data.attributes || {});
      const metadata = { ...attrs, _ui: { measure: code, minimum_unit: minimumCode } };
      let id = data.id;
      if (!id) id = createItem({ name: data.name, code: data.code, kind, unit: measure[0], category: data.category, sale_price: 0,
        attributes: metadata, retail_allowed: settings.retail_allowed }, actor).id;
      else if (!db.prepare('SELECT 1 FROM bakery_items WHERE product_id=?').get(id)) {
        const old = db.prepare('SELECT stock,base_unit_id FROM products WHERE id=?').get(id);
        if (!old) throw new Error('Producto no disponible.');
        const oldCode = db.prepare('SELECT code FROM units_of_measure WHERE id=?').get(old.base_unit_id)?.code;
        const oldMeasure = UNITS[({ GRAMO:'g', KILOGRAMO:'kg', MILILITRO:'ml', LITRO:'l', UNIDAD:'unit' }[oldCode]) || code];
        if (oldMeasure[0] !== measure[0]) throw new Error('No se puede convertir peso en volumen al vincular el producto.');
        createItem({ product_id: id, kind, unit: measure[0], stock_factor: oldMeasure[1], opening_total_cost: old.stock * oldMeasure[1] * cost,
          attributes: metadata, retail_allowed: settings.retail_allowed }, actor);
      }
      const previous = item(id);
      if (previous.unit !== measure[0] || previous.kind !== kind) throw new Error('No cambies el tipo ni la familia de medida de un artículo con historial.');
      const result = context.updateProduct({ ...data, id, stock: previous.stock, min_stock: min, purchase_price: previous.purchase_price,
        sale_price: number(data.sale_price ?? 0, 'Precio de venta', true) / measure[1],
        special_price: number(data.special_price ?? 0, 'Precio especial', true) / measure[1], special_price_2: number(data.special_price_2 ?? 0, 'Precio especial 2', true) / measure[1],
        base_unit_id: db.prepare('SELECT id FROM units_of_measure WHERE code=?').get({ g:'GRAMO',ml:'MILILITRO',unit:'UNIDAD' }[measure[0]]).id,
        product_type_id: db.prepare('SELECT id FROM product_types WHERE code=?').get(kind === 'raw' ? 'MATERIAL' : kind === 'finished' ? 'ALIMENTO' : 'PRODUCTO').id,
        variants: (data.variants || []).map(v => ({ ...v, conversion_factor: Number(v.conversion_factor) * measure[1], content_units: v.content_units == null ? null : Number(v.content_units) * measure[1] })),
        base_content_units: data.sale_type === 'FRACCIONADO' ? 1 : null, attributes: attrs, lots: [] });
      if (!result.success) throw new Error(result.message);
      db.prepare('UPDATE bakery_items SET attributes=?,retail_allowed=? WHERE product_id=?').run(JSON.stringify(metadata), kind !== 'raw' || settings.retail_allowed ? 1 : 0, id);
      if (previous.stock > EPS && Math.abs(cost - previous.purchase_price) > EPS) {
        db.prepare('UPDATE bakery_lots SET unit_cost=? WHERE product_id=? AND quantity>0').run(cost, id);
      }
      const stockDelta = qty - previous.stock;
      if (Math.abs(stockDelta) > EPS) {
        context.adjustStock(id, stockDelta, { movementType: 'BAKERY_CORRECTION', referenceType: 'product', referenceId: id,
          reason: 'Ajuste de existencia desde edición de producto', userId: actor.id, bakeryUnitCost: cost, bakeryAllowExpired: true,
          bakeryLot: { lot_number: `AJUSTE-${id}-${randomUUID().slice(0, 8)}` } });
      } else if (previous.stock > EPS && Math.abs(cost - previous.purchase_price) > EPS) {
        assertBalance(id);
      } else if (previous.stock <= EPS && qty <= EPS) {
        db.prepare('UPDATE products SET purchase_price=? WHERE id=?').run(cost, id);
      }
      const finalCost = db.prepare('SELECT purchase_price FROM products WHERE id=?').get(id).purchase_price;
      audit(actor, 'PRODUCT_SAVED', id, { measure: code, minimum_unit: minimumCode, minimum: data.min_stock,
        stock_before: previous.stock, stock_after: qty, purchase_price_before: previous.purchase_price, purchase_price_after: finalCost });
      return { success: true, id };
    })();
  }
  function purchaseLine(line) {
    const normalized = { ...line, unit: line.bakery_unit || item(line.product_id).unit };
    const { product } = quantity(normalized);
    if (product.kind === 'finished') throw new Error('Los elaborados ingresan mediante producción; selecciona materia prima o reventa para comprar.');
    const price=number(line.price, 'Costo por medida de compra', true);
    const amount=number(line.quantity, 'Cantidad de compra');
    if (line.bakery_expiration_date) date(line.bakery_expiration_date);
    return { ...line, quantity:amount, price, subtotal:amount*price, bakery_unit: normalized.unit };
  }
  function purchaseDocument(order, items, actorId) {
    const actor = access({ id: actorId }).user;
    requireArea(actor, 'inventory');
    const result = documentOnce('receipt', { request_id: `purchase-order:${order.id}`, date: today(), notes: order.notes || `Recepción OC ${order.po_number || order.id}`, lines: items }, actor, id => {
      db.prepare('UPDATE bakery_documents SET purchase_order_id=?,total_cost=? WHERE id=?').run(order.id, items.reduce((sum,line) => sum + line.quantity * line.price, 0), id);
    });
    return result.id;
  }
  function assertBalance(productId) {
    const actual = db.prepare('SELECT stock FROM products WHERE id=?').get(productId).stock;
    const lots = db.prepare('SELECT COALESCE(SUM(quantity),0) AS n FROM bakery_lots WHERE product_id=?').get(productId).n;
    if (Math.abs(actual - lots) > EPS) throw new Error('El inventario y sus lotes no coinciden. Revisa la valorización inicial en Panadería.');
    const value = db.prepare('SELECT COALESCE(SUM(quantity*unit_cost),0) AS n FROM bakery_lots WHERE product_id=?').get(productId).n;
    db.prepare('UPDATE products SET purchase_price=? WHERE id=?').run(lots > EPS ? value / lots : 0, productId);
  }
  // Called within the transaction that updates the shared inventory ledger.
  function onStockChange(productId, delta, options, movementId) {
    if (!enabled()) return null;
    const product = item(productId);
    if (!Number.isFinite(delta) || Math.abs(delta) < EPS) return 0;
    const insertMovement = db.prepare('INSERT INTO bakery_lot_movements(lot_id,movement_id,quantity,unit_cost,reverse_of) VALUES (?,?,?,?,?)');
    let cost = 0;
    if (delta > 0 && (options.movementType === 'SALE_RETURN' || options.referenceType === 'service')) {
      const allocations = db.prepare(`SELECT l.*, a.id AS allocation_id, a.quantity AS used,
        COALESCE((SELECT SUM(quantity) FROM bakery_lot_movements r WHERE r.reverse_of=a.id),0) AS restored
        FROM bakery_lot_movements a JOIN bakery_lots l ON l.id=a.lot_id
        JOIN inventory_movements m ON m.id=a.movement_id
        WHERE m.reference_type=? AND m.reference_id=? AND m.product_id=? AND a.quantity<0 ORDER BY a.id`).all(options.referenceType === 'service' ? 'service' : 'sale', options.referenceId, productId);
      let remaining = delta;
      for (const row of allocations) {
        const restore = Math.min(remaining, -row.used - row.restored);
        if (restore <= EPS) continue;
        db.prepare('UPDATE bakery_lots SET quantity=quantity+? WHERE id=?').run(restore, row.id);
        insertMovement.run(row.id, movementId, restore, row.unit_cost, row.allocation_id);
        cost += restore * row.unit_cost;
        remaining -= restore;
      }
      if (remaining > EPS) throw new Error('No se encontraron los lotes originales de la venta para restaurarlos.');
    } else if (delta > 0) {
      const unitCost = number(options.bakeryUnitCost, 'Costo unitario de entrada', true);
      const expiry = options.bakeryLot?.expiration_date ? date(options.bakeryLot.expiration_date) : null;
      const lotId = db.prepare(`INSERT INTO bakery_lots(product_id,document_id,lot_number,expiration_date,quantity,initial_quantity,unit_cost)
        VALUES (?,?,?,?,?,?,?)`).run(productId, options.bakeryDocument || null, options.bakeryLot?.lot_number || `L-${randomUUID().slice(0, 8)}`,
        expiry, delta, delta, unitCost).lastInsertRowid;
      insertMovement.run(lotId, movementId, delta, unitCost, null);
      cost = delta * unitCost;
    } else {
      if (options.movementType === 'SALE' && !product.retail_allowed) throw new Error(`${product.name} no está habilitado para venta directa.`);
      if (options.movementType === 'SALE' && options.bakeryUnitCost != null) throw new Error('El costo de venta lo determina el servidor.');
      const onDate = options.bakeryDate || today();
      const lots = db.prepare(`SELECT l.* FROM bakery_lots l LEFT JOIN bakery_documents d ON d.id=l.document_id
        WHERE l.product_id=? AND l.quantity>0 AND (? IS NULL OR l.id=?)
        AND (?=1 OR l.expiration_date IS NULL OR l.expiration_date>=?)
        AND date(COALESCE(d.doc_date,l.created_at))<=?
        ORDER BY l.expiration_date IS NULL,l.expiration_date,l.id`).all(productId, options.bakeryLotId || null, options.bakeryLotId || null,
          options.bakeryAllowExpired ? 1 : 0, onDate, onDate);
      let remaining = -delta;
      for (const lot of lots) {
        const take = Math.min(remaining, lot.quantity);
        if (take <= EPS) break;
        db.prepare('UPDATE bakery_lots SET quantity=MAX(0,quantity-?) WHERE id=?').run(take, lot.id);
        insertMovement.run(lot.id, movementId, -take, lot.unit_cost, null);
        cost += take * lot.unit_cost;
        remaining -= take;
      }
      if (remaining > EPS) throw new Error(`No hay suficiente inventario utilizable de ${product.name}; revisa cantidades, fecha y lotes vencidos.`);
    }
    assertBalance(productId);
    return cost;
  }
  function createItem(data, actor, productionOutput = false) {
    requireArea(actor, productionOutput ? 'production' : 'inventory');
    if (productionOutput && (data.kind !== 'finished' || data.product_id)) throw new Error('Producción solo puede crear productos elaborados nuevos.');
    return db.transaction(() => {
      if (!['raw', 'finished', 'resale'].includes(data.kind) || !['g', 'ml', 'unit'].includes(data.unit)) throw new Error('Tipo de producto o unidad inválidos.');
      let productId = data.product_id;
      let adoption = null;
      if (productId) {
        if (!access(actor).admin) throw new Error('Solo el administrador vincula artículos de una instalación existente.');
        if (db.prepare('SELECT 1 FROM bakery_items WHERE product_id=?').get(productId)) throw new Error('El producto ya está vinculado.');
        const existing = db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(productId);
        if (!existing) throw new Error('Producto no disponible.');
        if (db.prepare('SELECT 1 FROM product_variants WHERE product_id=?').get(productId)) throw new Error('Vincula primero el producto sin variantes y configura las presentaciones después.');
        const factor = number(data.stock_factor ?? 1, 'Equivalencia de la unidad anterior');
        const qty = existing.stock * factor;
        if (data.unit === 'unit' && !Number.isInteger(qty)) throw new Error('La conversión debe producir unidades enteras.');
        if (qty > 0) adoption = { existing, factor, qty, cost: number(data.opening_total_cost, 'Costo total del inventario existente', true) };
        db.prepare('UPDATE products SET base_unit_id=? WHERE id=?').run(db.prepare('SELECT id FROM units_of_measure WHERE code=?').get({ g: 'GRAMO', ml: 'MILILITRO', unit: 'UNIDAD' }[data.unit]).id, productId);
      } else {
        const result = context.addProduct({ name: text(data.name, 'Nombre'), code: text(data.code, 'Código'),
          category: data.category || (data.kind === 'raw' ? 'Materias primas' : data.kind === 'finished' ? 'Panes y panadería' : 'Reventa'),
          purchase_price: 0, sale_price: number(data.sale_price ?? 0, 'Precio de venta', true),
          stock: 0, min_stock: number(data.min_stock ?? 0, 'Existencia mínima', true),
          base_unit_id: db.prepare('SELECT id FROM units_of_measure WHERE code=?').get({ g: 'GRAMO', ml: 'MILILITRO', unit: 'UNIDAD' }[data.unit]).id,
          product_type_id: db.prepare('SELECT id FROM product_types WHERE code=?').get(data.kind === 'raw' ? 'MATERIAL' : 'ALIMENTO').id });
        if (!result.success) throw new Error(result.message);
        productId = result.id;
      }
      db.prepare('INSERT INTO bakery_items(product_id,kind,unit,retail_allowed,attributes) VALUES (?,?,?,?,?)')
        .run(productId, data.kind, data.unit, data.kind !== 'raw' || data.retail_allowed ? 1 : 0, JSON.stringify(data.attributes || {}));
      context.saveProductAttributes(productId, canonicalAttributes(data.attributes || {}));
      if (adoption) {
        const { existing, factor, qty, cost } = adoption;
        const doc = db.prepare("INSERT INTO bakery_documents(kind,status,request_id,doc_date,created_by,confirmed_by,payload,total_cost) VALUES ('opening','confirmed',?,?,?,?,?,?)")
          .run(randomUUID(), today(), actor.id, actor.id, JSON.stringify({ notes: 'Vinculación y valorización de inventario existente', previous_stock: existing.stock, factor }), cost).lastInsertRowid;
        db.prepare('UPDATE products SET stock=?,min_stock=min_stock*?,sale_price=sale_price/?,special_price=special_price/?,special_price_2=special_price_2/? WHERE id=?')
          .run(qty, factor, factor, factor, factor, productId);
        const move = db.prepare(`INSERT INTO inventory_movements(product_id,movement_type,quantity,stock_before,stock_after,reference_type,reference_id,reason,user_id)
          VALUES (?,'BAKERY_VALUATION',?,?,?,'bakery',?,'Conversión y valorización de inventario existente',?)`).run(productId, qty - existing.stock, existing.stock, qty, doc, actor.id).lastInsertRowid;
        const lot = db.prepare('INSERT INTO bakery_lots(product_id,document_id,lot_number,expiration_date,quantity,initial_quantity,unit_cost) VALUES (?,?,?,?,?,?,?)')
          .run(productId, doc, data.lot_number || `APERTURA-${doc}`, data.expiration_date ? date(data.expiration_date) : null, qty, qty, cost / qty).lastInsertRowid;
        db.prepare('INSERT INTO bakery_lot_movements(lot_id,movement_id,quantity,unit_cost) VALUES (?,?,?,?)').run(lot, move, qty, cost / qty);
        assertBalance(productId);
      }
      audit(actor, 'ITEM_CREATED', productId, data);
      return { id: productId };
    })();
  }
  function updateItem(data, actor) {
    requireArea(actor, 'inventory');
    return db.transaction(() => {
      item(data.product_id);
      const category = data.category ? context.ensureCategoryId(data.category) : null;
      db.prepare('UPDATE products SET name=?,code=?,category=?,category_id=?,sale_price=?,min_stock=? WHERE id=?')
        .run(text(data.name, 'Nombre'), text(data.code, 'Código'), data.category || null, category,
          number(data.sale_price, 'Precio de venta', true), number(data.min_stock, 'Existencia mínima', true), data.product_id);
      db.prepare('UPDATE bakery_items SET retail_allowed=?,attributes=? WHERE product_id=?')
        .run(item(data.product_id).kind !== 'raw' || data.retail_allowed ? 1 : 0, JSON.stringify(data.attributes || {}), data.product_id);
      context.saveProductAttributes(data.product_id, canonicalAttributes(data.attributes || {}));
      audit(actor, 'ITEM_UPDATED', data.product_id, data);
      return { id: data.product_id };
    })();
  }
  function saveRecipe(data, actor) {
    requireArea(actor, 'production');
    return db.transaction(() => {
      data = resolveOutputProducts(data, actor);
      const name = text(data.name, 'Nombre de receta');
      // A reference recipe may omit quantities. Only actual production requires them.
      validateProduction(data.reference_only === true ? {
        ...data,
        inputs: (data.inputs || []).map(line => ({ ...line, quantity: line.quantity == null || line.quantity === '' ? 1 : line.quantity })),
        outputs: (data.outputs || []).map(line => ({ ...line, quantity: line.quantity == null || line.quantity === '' ? 1 : line.quantity }))
      } : data);
      const version = db.prepare('SELECT COALESCE(MAX(version),0)+1 AS n FROM bakery_recipes WHERE name=?').get(name).n;
      const id = db.prepare('INSERT INTO bakery_recipes(name,version,payload,created_by) VALUES (?,?,?,?)').run(name, version, JSON.stringify(data), actor.id).lastInsertRowid;
      audit(actor, 'RECIPE_VERSION', id, { name, version });
      return { id, version, outputs: data.outputs };
    })();
  }
  function finishedProductCode() {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = `P${randomUUID().replace(/-/g, '').slice(0, 7).toUpperCase()}`;
      if (!db.prepare('SELECT 1 FROM products WHERE code=?').get(code)) return code;
    }
    throw new Error('No se pudo generar un código único para el producto elaborado.');
  }
  function resolveOutputProducts(data, actor) {
    const normalize = name => String(name || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('es');
    return { ...data, outputs: (data.outputs || []).map(source => {
      const line = { ...source };
      if (line.product_id) return line;
      const name = text(line.product_name, 'Nombre del producto elaborado');
      const existing = db.prepare('SELECT id,name,active FROM products').all().filter(p => normalize(p.name) === normalize(name));
      if (existing.length > 1) throw new Error('Hay varios productos con ese nombre. Selecciona el producto existente para evitar duplicados.');
      if (existing.length) {
        const profile = db.prepare('SELECT kind FROM bakery_items WHERE product_id=?').get(existing[0].id);
        if (existing[0].active !== 1 || profile?.kind !== 'finished') throw new Error('Ya existe un artículo con ese nombre. Revisa su clasificación y estado en Productos.');
        line.product_id = existing[0].id;
      } else {
        const unit = UNITS[line.unit || 'unit'];
        if (!unit) throw new Error('Selecciona una medida válida para el producto elaborado.');
        const attrs = { _ui: { measure: line.unit || 'unit', minimum_unit: line.unit || 'unit' } };
        line.product_id = createItem({ name, code: finishedProductCode(), kind: 'finished', unit: unit[0], attributes: attrs }, actor, true).id;
      }
      return line;
    }) };
  }
  function validateProduction(data) {
    text(data.name, 'Nombre de producción');
    if (!data.inputs?.length || !data.outputs?.length) throw new Error('Registra ingredientes y productos obtenidos.');
    data.inputs.forEach(quantity);
    const outputs = new Set();
    data.outputs.forEach(line => {
      const { product } = quantity(line);
      if (product.kind !== 'finished') throw new Error('La producción solo puede generar productos elaborados.');
      if (outputs.has(product.id) || data.inputs.some(input => Number(input.product_id) === product.id)) throw new Error('No repitas productos obtenidos ni uses un producto como ingrediente de sí mismo.');
      outputs.add(product.id);
      if (line.expected_quantity != null && line.expected_quantity !== '') number(line.expected_quantity, 'Cantidad esperada', true);
      if (line.waste_quantity != null && line.waste_quantity !== '') number(line.waste_quantity, 'Desperdicio', true);
      if (data.outputs.length > 1) number(line.cost_share, 'Proporción de costo por producto');
      if (line.expiration_date) date(line.expiration_date);
    });
    if (data.recipe_id && !db.prepare('SELECT 1 FROM bakery_recipes WHERE id=?').get(data.recipe_id)) throw new Error('La receta no existe.');
  }
  function saveDraft(data, actor) {
    requireArea(actor, 'production');
    return db.transaction(() => {
      const payload = resolveOutputProducts(data.payload, actor);
      validateProduction(payload);
      const onDate = date(data.date || today());
      if (onDate > today()) throw new Error('Una producción no puede tener fecha futura.');
      let id = data.id;
      if (id) {
        const doc = db.prepare('SELECT * FROM bakery_documents WHERE id=? AND kind=\'production\'').get(id);
        if (doc?.status === 'confirmed' && doc.created_by === actor.id && doc.request_id === data.request_id) {
          const previous = JSON.parse(doc.payload);
          previous.outputs.forEach(output => { delete output.cost_total; delete output.unit_cost; delete output.base_quantity; });
          if (JSON.stringify(previous) === JSON.stringify(payload)) return { id: doc.id, revision: doc.revision, confirmed: true };
        }
        if (!doc || doc.status !== 'draft' || (doc.created_by !== actor.id && actor.role !== 'admin')) throw new Error('El borrador no está disponible.');
        const result = db.prepare("UPDATE bakery_documents SET payload=?,doc_date=?,revision=revision+1 WHERE id=? AND revision=? AND status='draft'")
          .run(JSON.stringify(payload), onDate, id, data.revision);
        if (!result.changes) throw new Error('El borrador cambió en otra estación. Recarga antes de guardar.');
      } else {
        const requestId = text(data.request_id, 'Identificador de operación');
        const previous = db.prepare('SELECT * FROM bakery_documents WHERE request_id=?').get(requestId);
        if (previous) {
          if (previous.created_by !== actor.id) throw new Error('Operación de otro usuario.');
          if (JSON.stringify(JSON.parse(previous.payload)) !== JSON.stringify(payload)) throw new Error('Ya existe un borrador guardado con este identificador. Recárgalo desde el historial antes de modificarlo.');
          return { id: previous.id, revision: previous.revision };
        }
        id = db.prepare("INSERT INTO bakery_documents(kind,request_id,doc_date,created_by,payload) VALUES ('production',?,?,?,?)")
          .run(requestId, onDate, actor.id, JSON.stringify(payload)).lastInsertRowid;
      }
      audit(actor, 'PRODUCTION_DRAFT', id, {});
      return { id, revision: db.prepare('SELECT revision FROM bakery_documents WHERE id=?').get(id).revision };
    })();
  }
  function allocatedExpenses(excludeId) {
    const totals = new Map();
    for (const doc of db.prepare("SELECT id,payload FROM bakery_documents WHERE kind='production' AND status='confirmed'").all()) {
      if (doc.id === excludeId) continue;
      for (const cost of JSON.parse(doc.payload).costs || []) if (cost.expense_id) totals.set(Number(cost.expense_id), (totals.get(Number(cost.expense_id)) || 0) + Number(cost.amount));
    }
    return totals;
  }
  function confirm(data, actor) {
    requireArea(actor, 'production');
    return db.transaction(() => {
      const doc = db.prepare("SELECT * FROM bakery_documents WHERE id=? AND kind='production'").get(data.id);
      if (!doc || (doc.created_by !== actor.id && actor.role !== 'admin')) throw new Error('Producción no disponible.');
      if (doc.status === 'confirmed') return { id: doc.id, repeated: true };
      if (doc.status !== 'draft' || doc.revision !== data.revision) throw new Error('La producción cambió. Recarga antes de confirmar.');
      const payload = JSON.parse(doc.payload);
      validateProduction(payload);
      if (payload.outputs.some(line => Number(line.waste_quantity) > 0)) text(payload.notes, 'Explicación del desperdicio');
      let rawCost = 0;
      for (const line of payload.inputs) {
        const { product, qty } = quantity(line);
        rawCost += context.adjustStock(product.id, -qty, { movementType: 'BAKERY_CONSUMPTION', referenceType: 'bakery', referenceId: doc.id,
          reason: 'Consumo confirmado de producción', userId: actor.id, bakeryDate: doc.doc_date, bakeryLotId: line.lot_id || null }).bakeryCost;
      }
      let otherCost = 0;
      const allocations = allocatedExpenses();
      for (const cost of payload.costs || []) {
        text(cost.name, 'Nombre del costo');
        const amount = number(cost.amount, 'Costo adicional', true);
        if (cost.expense_id) {
          const expense = db.prepare('SELECT amount,date FROM expenses WHERE id=?').get(cost.expense_id);
          const used = (allocations.get(Number(cost.expense_id)) || 0) + amount;
          if (!expense || expense.date > doc.doc_date || used > expense.amount + 0.005) throw new Error('El gasto no existe, es posterior a la producción o ya fue distribuido.');
          allocations.set(Number(cost.expense_id), used);
        }
        otherCost += amount;
      }
      const total = rawCost + otherCost;
      number(total, 'Costo total de producción', true);
      const shares = payload.outputs.map(output => payload.outputs.length === 1 ? 1 : number(output.cost_share, 'Proporción de costo'));
      const sum = shares.reduce((a, b) => a + b, 0);
      number(sum, 'Suma de proporciones de costo');
      for (let i = 0; i < payload.outputs.length; i++) {
        const line = payload.outputs[i];
        const { product, qty } = quantity(line);
        if (line.expiration_date && line.expiration_date < doc.doc_date) throw new Error('El producto obtenido no puede vencer antes de su producción.');
        const unitCost = number(total * (shares[i] / sum) / qty, 'Costo por unidad obtenida', true);
        context.adjustStock(product.id, qty, { movementType: 'BAKERY_PRODUCTION', referenceType: 'bakery', referenceId: doc.id,
          reason: 'Producto obtenido en producción', userId: actor.id, bakeryUnitCost: unitCost, bakeryDocument: doc.id,
          bakeryLot: { lot_number: line.lot_number || `PROD-${doc.id}-${product.id}`, expiration_date: line.expiration_date } });
        line.cost_total = total * (shares[i] / sum);
        line.unit_cost = unitCost;
        line.base_quantity = qty;
        if (line.sale_price != null) {
          const priceUnit=UNITS[line.sale_price_unit || product.unit];
          if(!priceUnit || priceUnit[0]!==product.unit)throw new Error('Medida incompatible para precio de venta.');
          db.prepare('UPDATE products SET sale_price=? WHERE id=?').run(number(line.sale_price, 'Precio de venta', true)/priceUnit[1], product.id);
        }
      }
      db.prepare("UPDATE bakery_documents SET status='confirmed',confirmed_by=?,confirmed_at=datetime('now','localtime'),payload=?,raw_cost=?,other_cost=?,total_cost=? WHERE id=?")
        .run(actor.id, JSON.stringify(payload), rawCost, otherCost, total, doc.id);
      audit(actor, 'PRODUCTION_CONFIRMED', doc.id, { rawCost, otherCost, total });
      return { id: doc.id, total_cost: total };
    })();
  }
  function documentOnce(kind, data, actor, callback) {
    return db.transaction(() => {
      const requestId = text(data.request_id, 'Identificador de operación');
      const previous = db.prepare('SELECT * FROM bakery_documents WHERE request_id=?').get(requestId);
      if (previous) {
        if (previous.kind !== kind || previous.created_by !== actor.id) throw new Error('El identificador pertenece a otra operación.');
        if (previous.payload !== JSON.stringify(data)) throw new Error('Este identificador ya fue utilizado con otros datos. Recarga el historial para verificar la operación original.');
        return { id: previous.id, repeated: true };
      }
      const onDate = date(data.date || today());
      if (onDate > today()) throw new Error('La fecha no puede ser futura.');
      const id = db.prepare("INSERT INTO bakery_documents(kind,status,request_id,doc_date,created_by,confirmed_by,confirmed_at,payload) VALUES (?,'confirmed',?,?,?,?,datetime('now','localtime'),?)")
        .run(kind, requestId, onDate, actor.id, actor.id, JSON.stringify(data)).lastInsertRowid;
      callback(id, onDate);
      audit(actor, kind.toUpperCase(), id, data);
      return { id };
    })();
  }
  function receive(data, actor) {
    requireArea(actor, 'inventory');
    const kind = data.opening ? 'opening' : 'receipt';
    return documentOnce(kind, data, actor, (id, onDate) => {
      if (!data.lines?.length) throw new Error('Agrega artículos recibidos.');
      const items = data.lines.map(line => {
        const { product, qty } = quantity(line);
        if (!data.opening && product.kind === 'finished') throw new Error('Los productos elaborados ingresan por producción. Para existencias anteriores utiliza Inventario inicial.');
        return { product_id: product.id, quantity: qty, price: number(line.total_cost, 'Costo total recibido', true) / qty };
      });
      if (!data.opening) {
        if (!db.prepare('SELECT id FROM suppliers WHERE id=?').get(data.supplier_id)) throw new Error('Selecciona un proveedor.');
        const order = context.createPurchaseOrder({ supplier_id: data.supplier_id, items, notes: data.notes || `Ingreso Panadería #${id}` });
        if (!order.success) throw new Error(order.message);
        const received = context.receivePurchaseOrder(order.id, { bakeryDocument: id, bakeryLots: data.lines, userId: actor.id });
        if (!received.success) throw new Error(received.message);
        db.prepare('UPDATE purchase_orders SET order_date=? WHERE id=?').run(onDate, order.id);
        db.prepare('UPDATE bakery_documents SET purchase_order_id=? WHERE id=?').run(order.id, id);
      } else {
        items.forEach((line, i) => context.adjustStock(line.product_id, line.quantity, { movementType: 'BAKERY_OPENING', referenceType: 'bakery', referenceId: id,
          reason: text(data.notes, 'Justificación del inventario inicial'), userId: actor.id,
          bakeryUnitCost: line.price, bakeryLot: data.lines[i], bakeryDocument: id }));
      }
      db.prepare('UPDATE bakery_documents SET total_cost=? WHERE id=?').run(items.reduce((sum, line) => sum + line.quantity * line.price, 0), id);
    });
  }
  function loss(data, actor) {
    requireArea(actor, 'inventory');
    return documentOnce('loss', data, actor, (id, onDate) => {
      const reason = text(data.notes, 'Motivo de salida');
      if (!['damage', 'expired', 'internal', 'gift', 'correction'].includes(data.reason)) throw new Error('Selecciona el tipo de salida.');
      if (!data.lines?.length) throw new Error('Agrega productos a la salida.');
      let total = 0;
      for (const line of data.lines) {
        const { product, qty } = quantity(line);
        if (data.reason === 'expired' && !line.lot_id) throw new Error('Selecciona el lote vencido que vas a retirar.');
        total += context.adjustStock(product.id, -qty, { movementType: 'BAKERY_LOSS', referenceType: 'bakery', referenceId: id,
          reason, userId: actor.id, bakeryLotId: line.lot_id || null, bakeryDate: onDate, bakeryAllowExpired: data.reason === 'expired' }).bakeryCost;
      }
      db.prepare('UPDATE bakery_documents SET total_cost=? WHERE id=?').run(total, id);
    });
  }
  function expense(data, actor) {
    requireArea(actor, 'inventory');
    return documentOnce('expense', data, actor, (id, onDate) => {
      const amount = number(data.amount, 'Valor del gasto');
      if (!['cash', 'transfer'].includes(data.method)) throw new Error('Método de pago inválido.');
      const result = context.saveExpense({ description: text(data.notes, 'Descripción'), amount, category: data.category || 'Panadería',
        date: onDate, method: data.method, reference: data.reference || null });
      if (!result.success) throw new Error(result.message);
      db.prepare('UPDATE bakery_documents SET expense_id=?,total_cost=? WHERE id=?').run(result.id, amount, id);
    });
  }
  function reverse(data, actor) {
    const auth = access(actor);
    if (!auth.admin) throw new Error('Solo el administrador puede anular registros de inventario.');
    return db.transaction(() => {
      const doc = db.prepare("SELECT * FROM bakery_documents WHERE id=? AND kind IN ('production','receipt','opening','loss')").get(data.id);
      if (!doc || doc.status === 'annulled') throw new Error('Registro no disponible.');
      const reason = text(data.reason, 'Motivo de anulación');
      if (doc.kind === 'receipt' && doc.purchase_order_id) {
        const order = db.prepare('SELECT paid_amount FROM purchase_orders WHERE id=?').get(doc.purchase_order_id);
        if (order?.paid_amount > 0) throw new Error('La compra tiene pagos. Debes resolver la devolución financiera antes de anular su recepción.');
      }
      if (doc.status === 'confirmed') {
        const lots = db.prepare('SELECT * FROM bakery_lots WHERE document_id=?').all(doc.id);
        if (lots.some(lot => Math.abs(lot.quantity - lot.initial_quantity) > EPS)) throw new Error('El registro ya tuvo salidas. Registra ajustes autorizados; no se puede borrar su historial.');
        const original = db.prepare(`SELECT a.*,m.product_id FROM bakery_lot_movements a JOIN inventory_movements m ON m.id=a.movement_id
          WHERE (m.reference_type='bakery' AND m.reference_id=?) OR (m.reference_type='purchase_order' AND m.reference_id=?) ORDER BY a.id`).all(doc.id, doc.purchase_order_id || -1);
        for (const row of original) {
          // Reverse exact source lots, including lots that have since expired.
          const product = db.prepare('SELECT stock FROM products WHERE id=?').get(row.product_id);
          const delta = -row.quantity;
          const stockAfter = product.stock + delta;
          if (stockAfter < -EPS) throw new Error('La producción no puede revertirse por falta de inventario.');
          db.prepare('UPDATE products SET stock=? WHERE id=?').run(stockAfter, row.product_id);
          db.prepare('UPDATE bakery_lots SET quantity=quantity+? WHERE id=?').run(delta, row.lot_id);
          const move = db.prepare(`INSERT INTO inventory_movements(product_id,movement_type,quantity,stock_before,stock_after,reference_type,reference_id,reason,user_id)
            VALUES (?,'BAKERY_REVERSAL',?,?,?,'bakery',?,?,?)`).run(row.product_id, delta, product.stock, stockAfter, doc.id, reason, actor.id).lastInsertRowid;
          db.prepare('INSERT INTO bakery_lot_movements(lot_id,movement_id,quantity,unit_cost,reverse_of) VALUES (?,?,?,?,?)').run(row.lot_id, move, delta, row.unit_cost, row.id);
          assertBalance(row.product_id);
        }
      }
      db.prepare("UPDATE bakery_documents SET status='annulled',reversal_reason=? WHERE id=?").run(reason, doc.id);
      if (doc.kind === 'receipt' && doc.purchase_order_id) db.prepare("UPDATE purchase_orders SET status='annulled',outstanding_balance=0,payment_status='annulled' WHERE id=?").run(doc.purchase_order_id);
      audit(actor, 'DOCUMENT_REVERSED', doc.id, { reason, kind: doc.kind });
      return { id: doc.id };
    })();
  }
  function recordSale(saleId, reversal = false, actorId = null) {
    if (!enabled()) return;
    const type = reversal ? 'reversal' : 'sale';
    if (db.prepare('SELECT id FROM bakery_sale_events WHERE sale_id=? AND event_type=?').get(saleId, type)) throw new Error('La venta ya fue registrada en el historial de Panadería.');
    const eventId = db.prepare('INSERT INTO bakery_sale_events(sale_id,event_type,actor_id) VALUES (?,?,?)').run(saleId, type, actorId).lastInsertRowid;
    const rows = reversal
      ? db.prepare("SELECT l.* FROM bakery_sale_lines l JOIN bakery_sale_events e ON e.id=l.event_id WHERE e.sale_id=? AND e.event_type='sale'").all(saleId)
      : db.prepare('SELECT product_id,product_name AS name,quantity*conversion_factor AS quantity,quantity*price AS revenue,bakery_cost_total AS cost FROM sale_items WHERE sale_id=?').all(saleId);
    if (!reversal && rows.length) {
      const subtotal = db.prepare('SELECT subtotal_amount FROM sales WHERE id=?').get(saleId).subtotal_amount;
      rows[rows.length - 1].revenue += subtotal - rows.reduce((sum, row) => sum + row.revenue, 0);
    }
    const sign = reversal ? -1 : 1;
    for (const row of rows) db.prepare('INSERT INTO bakery_sale_lines(event_id,product_id,name,quantity,revenue,cost) VALUES (?,?,?,?,?,?)')
      .run(eventId, row.product_id, row.name, row.quantity * sign, row.revenue * sign, row.cost == null ? null : row.cost * sign);
  }
  function reservedServiceCost(line, items) {
    const service = db.prepare('SELECT status FROM services WHERE id=?').get(line.service_id);
    if (!service || ['Finalizado','Anulado'].includes(service.status)) throw new Error('No existe una reserva de materiales disponible para esta venta.');
    const original = db.prepare('SELECT quantity,variant_id FROM service_products WHERE service_id=? AND product_id=? AND COALESCE(variant_id,0)=?')
      .get(line.service_id, line.product_id, line.variant_id || 0);
    if (!original || Number(line.quantity) !== original.quantity || items.filter(row => row.product_id === line.product_id && row.service_id === line.service_id && (row.variant_id || 0) === (line.variant_id || 0)).length !== 1) throw new Error('El material no coincide con la reserva del servicio original.');
    const reserved = db.prepare(`SELECT -SUM(a.quantity) AS quantity,-SUM(a.quantity*a.unit_cost) AS cost FROM bakery_lot_movements a
      JOIN inventory_movements m ON m.id=a.movement_id WHERE m.product_id=? AND m.reference_type='service' AND m.reference_id=?`).get(line.product_id, line.service_id);
    const factor = line.variant_id ? db.prepare('SELECT conversion_factor FROM product_variants WHERE id=?').get(line.variant_id)?.conversion_factor : 1;
    if (!reserved.quantity || !factor) throw new Error('No se encontraron costos históricos para la reserva del servicio.');
    return reserved.cost * (Number(line.quantity) * factor / reserved.quantity);
  }
  function validateSale(items) {
    if (!Array.isArray(items) || !items.length) throw new Error('La venta debe contener artículos.');
    for (const line of items) {
      line.quantity = number(line.quantity, 'Cantidad de venta');
      line.price = number(line.price, 'Precio de venta', true);
      line.subtotal = line.quantity * line.price;
      number(line.subtotal, 'Subtotal', true);
      if (line.product_id) {
        const product = item(line.product_id);
        const variant = line.variant_id ? db.prepare('SELECT conversion_factor FROM product_variants WHERE id=? AND product_id=?').get(line.variant_id, line.product_id) : null;
        if (line.variant_id && !variant) throw new Error('La presentación no pertenece al producto.');
        if (product.unit === 'unit' && !Number.isInteger(line.quantity * (variant?.conversion_factor || 1))) throw new Error(`${product.name}: no se pueden vender fracciones de una unidad.`);
      }
    }
  }
  function state(actor) {
    const auth = access(actor);
    if (!auth.admin && !auth.permissions.some(area => ['inventory', 'production', 'reports'].includes(area))) {
      return { ...auth, items: [], lots: [], recipes: [], documents: [], suppliers: [], expenses: [], users: [], unlinked: [] };
    }
    const mayCost = auth.admin || auth.permissions.includes('inventory') || auth.permissions.includes('reports');
    const items = db.prepare(`SELECT p.id,p.code,p.name,p.category,p.stock,p.min_stock,p.sale_price,p.purchase_price,b.kind,b.unit,b.retail_allowed,b.attributes
      FROM products p JOIN bakery_items b ON b.product_id=p.id WHERE p.active=1 ORDER BY p.name`).all();
    const lots = db.prepare('SELECT * FROM bakery_lots WHERE quantity>0 ORDER BY expiration_date IS NULL,expiration_date,id').all();
    const recipes = db.prepare('SELECT * FROM bakery_recipes ORDER BY name,version DESC').all();
    const documents = db.prepare(`SELECT d.*,u.name AS author_name FROM bakery_documents d JOIN users u ON u.id=d.created_by
      WHERE (?=1 OR d.created_by=?) ORDER BY d.id DESC LIMIT 200`).all(auth.admin || mayCost ? 1 : 0, actor.id);
    if (!mayCost) {
      items.forEach(row => { delete row.purchase_price; });
      lots.forEach(row => { delete row.unit_cost; });
      documents.forEach(row => {
        delete row.raw_cost; delete row.other_cost; delete row.total_cost;
        const payload = JSON.parse(row.payload);
        (payload.outputs || []).forEach(output => { delete output.unit_cost; delete output.cost_total; });
        row.payload = JSON.stringify(payload);
      });
    }
    return { ...auth, items, lots, recipes, documents,
      suppliers: auth.admin || auth.permissions.includes('inventory') ? db.prepare('SELECT id,name FROM suppliers ORDER BY name').all() : [],
      expenses: mayCost ? db.prepare('SELECT id,description,amount,date FROM expenses ORDER BY date DESC,id DESC').all() : [],
      users: auth.admin ? db.prepare(`SELECT u.id,u.name,u.username,u.role,COALESCE(p.permissions,'[]') AS permissions FROM users u LEFT JOIN bakery_permissions p ON p.user_id=u.id ORDER BY u.name`).all() : [],
      unlinked: auth.admin ? db.prepare('SELECT id,name,stock FROM products WHERE active=1 AND id NOT IN (SELECT product_id FROM bakery_items)').all() : [] };
  }
  function history(data, actor) {
    const auth = access(actor), mayCost = auth.admin || auth.permissions.some(area => ['inventory','reports'].includes(area));
    if (!mayCost && !auth.permissions.includes('production')) throw new Error('No tienes acceso al historial.');
    const start = date(data.start), end = date(data.end), offset = Number(data.offset || 0);
    if (start > end || !Number.isInteger(offset) || offset < 0 || !['production','inventory'].includes(data.kind)) throw new Error('Filtro de historial inválido.');
    const documents = db.prepare(`SELECT d.*,u.name AS author_name FROM bakery_documents d JOIN users u ON u.id=d.created_by
      WHERE d.doc_date BETWEEN ? AND ? AND (?=1 OR d.created_by=?)
      AND ((?='production' AND d.kind='production') OR (?='inventory' AND d.kind!='production')) ORDER BY d.id DESC LIMIT 100 OFFSET ?`)
      .all(start, end, mayCost ? 1 : 0, actor.id, data.kind, data.kind, offset);
    if (!mayCost) for (const doc of documents) {
      delete doc.raw_cost; delete doc.other_cost; delete doc.total_cost;
      const payload = JSON.parse(doc.payload);
      (payload.outputs || []).forEach(output => { delete output.unit_cost; delete output.cost_total; });
      doc.payload = JSON.stringify(payload);
    }
    return { documents, next_offset: offset + documents.length, has_more: documents.length === 100 };
  }
  function documentDetail(data, actor) {
    const auth = access(actor), mayCost = auth.admin || auth.permissions.some(area => ['inventory','reports'].includes(area));
    const doc = db.prepare('SELECT d.*,u.name AS author_name FROM bakery_documents d JOIN users u ON u.id=d.created_by WHERE d.id=?').get(data.id);
    if (!doc || (!mayCost && (!auth.permissions.includes('production') || doc.created_by !== actor.id))) throw new Error('No tienes acceso a este registro.');
    const movements = db.prepare(`SELECT m.created_at,m.movement_type,p.name,b.unit,l.lot_number,a.quantity,a.unit_cost FROM bakery_lot_movements a
      JOIN bakery_lots l ON l.id=a.lot_id JOIN inventory_movements m ON m.id=a.movement_id
      JOIN products p ON p.id=m.product_id JOIN bakery_items b ON b.product_id=p.id
      WHERE (m.reference_type='bakery' AND m.reference_id=?) OR l.document_id=? ORDER BY a.id`).all(doc.id, doc.id);
    if (!mayCost) {
      delete doc.raw_cost; delete doc.other_cost; delete doc.total_cost;
      const payload = JSON.parse(doc.payload);
      (payload.outputs || []).forEach(output => { delete output.unit_cost; delete output.cost_total; });
      doc.payload = JSON.stringify(payload);
      movements.forEach(row => { delete row.unit_cost; });
    }
    return { document: doc, movements };
  }
  function report(data, actor) {
    requireArea(actor, 'reports');
    const start = date(data.start), end = date(data.end);
    if (start > end) throw new Error('El inicio debe ser anterior al final.');
    const bucket = value => {
      const d = value.slice(0, 10);
      if (data.period === 'monthly') return d.slice(0, 7);
      if (data.period === 'fortnight') return `${d.slice(0, 7)} / ${Number(d.slice(8)) <= 15 ? '1–15' : '16–fin'}`;
      if (data.period === 'weekly') { const day = new Date(d + 'T12:00:00Z'); day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7); return day.toISOString().slice(0, 10); }
      return d;
    };
    const groups = new Map();
    const get = value => { const key = bucket(value); if (!groups.has(key)) groups.set(key, { period: key, purchases: 0, production: 0, ingredients: 0, revenue: 0, cost: 0, loss: 0, expenses: 0, estimated: 0, missingCosts: 0 }); return groups.get(key); };
    const byProduct = new Map();
    const productRow = (id, name) => {
      if (!byProduct.has(id || name)) byProduct.set(id || name, { product_id:id, unit:id ? db.prepare('SELECT unit FROM bakery_items WHERE product_id=?').get(id)?.unit : 'unit', measure:id ? JSON.parse(db.prepare('SELECT attributes FROM bakery_items WHERE product_id=?').get(id)?.attributes || '{}')._ui?.measure : 'unit', name: (id && db.prepare('SELECT name FROM products WHERE id=?').get(id)?.name) || name,
        produced: 0, expected: 0, waste: 0, production_cost: 0, sold: 0, revenue: 0, cost: 0 });
      return byProduct.get(id || name);
    };
    function productionOutput(output, sign) {
      const row = productRow(output.product_id, `Producto #${output.product_id}`), factor = output.base_quantity / Number(output.quantity);
      row.produced += sign * output.base_quantity;
      row.expected += sign * Number(output.expected_quantity || 0) * factor;
      row.waste += sign * Number(output.waste_quantity || 0) * factor;
      row.production_cost += sign * output.cost_total;
    }
    const sales = db.prepare(`SELECT e.occurred_at,l.* FROM bakery_sale_events e JOIN bakery_sale_lines l ON l.event_id=e.id
      WHERE date(e.occurred_at) BETWEEN ? AND ?`).all(start, end);
    for (const row of sales) {
      const group = get(row.occurred_at);
      group.revenue += row.revenue;
      group.cost += row.cost || 0;
      if (row.cost == null) group.missingCosts++;
      const product = productRow(row.product_id, row.name); product.sold += row.quantity; product.revenue += row.revenue; product.cost += row.cost || 0;
    }
    const documents = db.prepare("SELECT * FROM bakery_documents WHERE doc_date BETWEEN ? AND ? AND (status='confirmed' OR (kind IN ('production','loss') AND confirmed_at IS NOT NULL))").all(start, end);
    for (const doc of documents) {
      const group = get(doc.doc_date);
      if (doc.kind === 'production') {
        group.production += doc.total_cost; group.ingredients += doc.raw_cost;
        const payload = JSON.parse(doc.payload);
        for (const cost of payload.costs || []) {
          if (!cost.expense_id) group.estimated += Number(cost.amount);
          else group.expenses -= Number(cost.amount);
        }
        for (const output of payload.outputs) productionOutput(output, 1);
      }
      if (doc.kind === 'loss') group.loss += doc.total_cost;
    }
    const reversals = db.prepare(`SELECT d.*,a.created_at AS reversed_at FROM bakery_documents d JOIN bakery_audit a ON a.entity_id=d.id
      WHERE a.action='DOCUMENT_REVERSED' AND d.confirmed_at IS NOT NULL AND date(a.created_at) BETWEEN ? AND ?`).all(start, end);
    for (const doc of reversals) {
      const group = get(doc.reversed_at), payload = JSON.parse(doc.payload);
      if (doc.kind === 'loss') { group.loss -= doc.total_cost; continue; }
      if (doc.kind === 'receipt') { group.purchases -= doc.total_cost; continue; }
      if (doc.kind !== 'production') continue;
      group.production -= doc.total_cost; group.ingredients -= doc.raw_cost;
      for (const cost of payload.costs || []) {
        if (cost.expense_id) group.expenses += Number(cost.amount);
        else group.estimated -= Number(cost.amount);
      }
      for (const output of payload.outputs) productionOutput(output, -1);
    }
    const purchases = db.prepare(`SELECT COALESCE(d.doc_date,m.created_at) AS received_at,SUM(a.quantity*a.unit_cost) AS total FROM inventory_movements m
      JOIN bakery_lot_movements a ON a.movement_id=m.id JOIN bakery_lots l ON l.id=a.lot_id LEFT JOIN bakery_documents d ON d.id=l.document_id
      WHERE m.movement_type='PURCHASE' AND date(COALESCE(d.doc_date,m.created_at)) BETWEEN ? AND ? GROUP BY m.id`).all(start, end);
    for (const purchase of purchases) get(purchase.received_at).purchases += purchase.total;
    for (const expense of db.prepare('SELECT * FROM expenses WHERE date(date) BETWEEN ? AND ?').all(start, end)) {
      get(expense.date).expenses += expense.amount;
    }
    const rows = [...groups.values()].sort((a, b) => a.period.localeCompare(b.period)).map(row => ({ ...row,
      gross: row.revenue - row.cost, operating: row.revenue - row.cost - row.loss - row.expenses }));
    const totals = rows.reduce((sum, row) => { for (const key of Object.keys(row)) if (typeof row[key] === 'number') sum[key] = (sum[key] || 0) + row[key]; return sum; }, {});
    const inventory = db.prepare('SELECT COALESCE(SUM(quantity*unit_cost),0) AS value FROM bakery_lots').get().value;
    const historicalUntracked = db.prepare(`SELECT COUNT(*) AS n FROM sales s WHERE date(s.sale_date) BETWEEN ? AND ? AND status!='annulled'
      AND NOT EXISTS(SELECT 1 FROM bakery_sale_events e WHERE e.sale_id=s.id)`).get(start, end).n;
    return { rows, totals, byProduct: [...byProduct.values()], inventory, historicalUntracked,
      note: 'Resultado operativo según costos y gastos registrados. Compras y producción no se restan nuevamente del resultado. Los costos sin gasto asociado son estimados. Los impuestos sobre ventas se excluyen del ingreso; otros impuestos y costos financieros deben registrarse como gastos.' };
  }
  function authorizeChannel(channel, actor) {
    if (!enabled()) return;
    const publicChannels = ['login', 'get-installation-state', 'get-business-types', 'get-product-form-config', 'save-initial-setup', 'get-license-state', 'activate-license'];
    if (publicChannels.includes(channel)) return;
    const auth = access(actor);
    if (auth.admin) return;
    if (['bakery', 'logout', 'get-business-module-config', 'get-company-settings', 'get-company-logo', 'log-action'].includes(channel)) return;
    if (['get-products', 'get-product-by-id'].includes(channel) && auth.permissions.some(area => ['sales','production','inventory'].includes(area))) return;
    if (auth.permissions.includes('inventory') && ['add-product','update-product','add-category','get-product-form-config','create-purchase-order','update-purchase-order','receive-purchase-order','update-purchase-invoice-number','export-purchase-order-pdf','get-expense-by-id','export-expense-pdf','get-payment-receipt-preview','export-payment-receipt-pdf','save-remote-export','get-printers','export-inventory-pdf','export-inventory-excel'].includes(channel)) return;
    if (auth.permissions.includes('reports') && ['get-sales-report','get-expenses','get-retentions-report','export-sales-report-pdf','export-expenses-report-pdf','save-remote-export'].includes(channel)) return;
    if (auth.permissions.includes('sales') && /^(get-clients|get-client-by-id|save-client|update-client|get-sales|get-sale-by-id|get-sale-items|create-sale|create-sale-from-quote|get-credits|add-credit-payment|get-sale-payments|get-last-invoice-number|assign-receipt-number|get-quotes|get-quote-by-id|create-quote|update-quote-details|update-quote|get-last-quote-number|get-printers|print-invoice|preview-invoice|export-invoice-pdf|export-sale-receipt-pdf|export-quote-pdf|get-payment-receipt-preview|export-payment-receipt-pdf|save-remote-export|.*cash.*)$/.test(channel)) return;
    if (auth.permissions.includes('inventory') && /^(get-suppliers|get-supplier-by-id|save-supplier|update-supplier|get-suppliers-count|get-categories|get-inventory|get-inventory-movements|get-inventory-lots|get-expiration-alerts|get-low-stock-products|get-purchase-orders|get-purchase-order-by-id|get-purchase-payments|add-purchase-payment|get-due-purchase-orders|get-expenses|save-expense)$/.test(channel)) return;
    throw new Error('Esta operación no pertenece a tus responsabilidades de Panadería.');
  }
  function moduleConfig(config, actor) {
    const auth = access(actor);
    if (auth.admin) return { ...config, modules: { ...config.modules, production: true } };
    const sales = auth.permissions.includes('sales'), inventory = auth.permissions.includes('inventory');
    return { ...config, modules: { ...Object.fromEntries(Object.keys(config.modules).map(key => [key, false])),
      production: auth.permissions.includes('production'), products: inventory, sales, cashRegister: sales, clients: sales, quotes: sales, suppliers: inventory,
      purchases: inventory, expenses: inventory, reports: auth.permissions.includes('reports'), dashboard: false, settings: false, support: true } };
  }
  function run(action, data, actor) {
    actor = access(actor).user;
    const actions = { access: () => access(actor), state: () => state(actor), createItem: () => createItem(data, actor), updateItem: () => updateItem(data, actor),
      saveRecipe: () => saveRecipe(data, actor), saveDraft: () => saveDraft(data, actor), confirm: () => confirm(data, actor), document: () => documentDetail(data, actor), history: () => history(data, actor),
      receive: () => receive(data, actor), loss: () => loss(data, actor), expense: () => expense(data, actor), reverse: () => reverse(data, actor), report: () => report(data, actor),
      reversePurchase: () => {
        const receipt = db.prepare("SELECT id FROM bakery_documents WHERE purchase_order_id=? AND kind='receipt'").get(data.id);
        if (!receipt) throw new Error('No se encontró la recepción de esta compra.');
        return reverse({ id: receipt.id, reason: data.reason }, actor);
      },
      permissions: () => {
        if (!access(actor).admin) throw new Error('Solo el administrador asigna responsabilidades.');
        if (!Array.isArray(data.permissions) || data.permissions.some(area => !AREAS.includes(area))) throw new Error('Permisos inválidos.');
        if (!db.prepare('SELECT id FROM users WHERE id=?').get(data.user_id)) throw new Error('Usuario no encontrado.');
        return db.transaction(() => {
          db.prepare('INSERT INTO bakery_permissions(user_id,permissions) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET permissions=excluded.permissions').run(data.user_id, JSON.stringify([...new Set(data.permissions)]));
          audit(actor, 'PERMISSIONS_CHANGED', data.user_id, data);
          return {};
        })();
      } };
    if (!actions[action]) throw new Error('Operación de Panadería no disponible.');
    return { success: true, ...actions[action]() };
  }
  function expenseIsAllocated(id) { return (allocatedExpenses().get(Number(id)) || 0) > 0; }
  return { enabled, access, authorizeChannel, moduleConfig, run, onStockChange, recordSale, expenseIsAllocated, reservedServiceCost, validateSale,
    decorateProduct, saveProduct, purchaseLine, purchaseDocument };
}
module.exports = { createBakery, UNITS };
