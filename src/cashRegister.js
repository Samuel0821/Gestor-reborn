const { db } = require("./database");

// Apertura de caja
function openCashRegister(openingBalance, userId, userName, openingNotes = null) {
  // Cerrar cualquier caja abierta previamente
  db.prepare(`
    UPDATE cash_register_sessions
    SET status = 'closed', closed_at = DATETIME('now', 'localtime')
    WHERE status = 'open'
  `).run();

  // Crear nueva sesión
  const stmt = db.prepare(`
    INSERT INTO cash_register_sessions (opening_balance, status, user_id, user_name, opening_notes, opened_at)
    VALUES (?, 'open', ?, ?, ?, DATETIME('now', 'localtime'))
  `);
  const result = stmt.run(openingBalance, userId, userName, openingNotes);

  return { success: true, session_id: result.lastInsertRowid };
}

// Obtener sesión activa

function getActiveSession() {
  return db.prepare(`
    SELECT *, DATETIME(opened_at) as opened_at_iso FROM cash_register_sessions
    WHERE status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1
  `).get();
}

// Registrar movimiento de caja
// type = 'sale' | 'in' | 'out'

function addCashMovement(sessionId, type, sub_type, amount, description = null, related_id = null) {
  const stmt = db.prepare(`
    INSERT INTO cash_movements (session_id, type, sub_type, amount, description, related_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, DATETIME('now', 'localtime'))
  `);
  const result = stmt.run(sessionId, type, sub_type, amount, description, related_id);
  return { success: true, movement_id: result.lastInsertRowid };
}

// Cierre de caja

function closeCashRegister(realClosingBalance, closedByUserId, closedByUserName, closingNotes) {
  const session = getActiveSession();
  if (!session) return { success: false, message: "No hay caja abierta." };

  // Calcular total movimientos en efectivo
  const cashMovements = db.prepare(` 
    SELECT * FROM cash_movements WHERE session_id = ? AND (sub_type LIKE '%cash%' OR sub_type LIKE '%manual%')
  `).all(session.id);

  const totalIn = cashMovements
    .filter(m => m.type === "in")
    .reduce((sum, m) => sum + m.amount, 0);

  const totalOut = cashMovements
    .filter(m => m.type === "out")
    .reduce((sum, m) => sum + m.amount, 0);

  const expected = session.opening_balance + totalIn - totalOut;
  const diff = realClosingBalance - expected;

  db.prepare(`
    UPDATE cash_register_sessions
    SET closed_at = DATETIME('now', 'localtime'),
        closing_balance = ?,
        expected_balance = ?,
        difference = ?,
        status = 'closed',
        closed_by_user_id = ?,
        closed_by_user_name = ?,
        closing_notes = ?
    WHERE id = ?
  `).run(realClosingBalance, expected, diff, closedByUserId, closedByUserName, closingNotes, session.id);

  return {
    success: true,
    session_id: session.id,
    expected_balance: expected,
    closing_balance: realClosingBalance,
    difference: diff
  };
}


// Reportes

function getCashRegisterSessions() {
  return db.prepare(`
    SELECT *, DATETIME(opened_at) as opened_at_iso, DATETIME(closed_at) as closed_at_iso FROM cash_register_sessions
    ORDER BY opened_at DESC
  `).all();
}

function getCashMovements(sessionId) {
  return db.prepare(`
    SELECT * FROM cash_movements WHERE session_id = ? ORDER BY created_at ASC
  `).all(sessionId);
}

// Nuevas funciones para el reporte detallado
function getCashMovementsDetailed(sessionId) {
  return db.prepare(`
    SELECT type, sub_type, SUM(amount) as total_amount, COUNT(id) as count
    FROM cash_movements
    WHERE session_id = ?
    GROUP BY type, sub_type
    ORDER BY type, sub_type
  `).all(sessionId);
}

function getSalesForSession(sessionId) {
  return db.prepare(`
    SELECT s.id, s.invoice_number, s.total_amount, s.sale_type, s.sale_date,
           c.name as client_name,
           SUM(CASE WHEN sp.method = 'cash' THEN sp.amount ELSE 0 END) as cash_paid,
           SUM(CASE WHEN sp.method = 'transfer' THEN sp.amount ELSE 0 END) as transfer_paid
    FROM sales s
    LEFT JOIN sale_payments sp ON s.id = sp.sale_id
    LEFT JOIN clients c ON s.client_id = c.id
    WHERE DATETIME(sp.created_at) BETWEEN (SELECT opened_at FROM cash_register_sessions WHERE id = ?) AND (SELECT COALESCE(closed_at, DATETIME('now', 'localtime')) FROM cash_register_sessions WHERE id = ?)
      AND s.status != 'annulled' -- Excluir ventas anuladas
    GROUP BY s.id
    ORDER BY s.sale_date ASC
  `).all(sessionId, sessionId);
}

function getExpensesForSession(sessionId) {
  return db.prepare(`
    SELECT e.id, e.description, e.amount, e.category, e.date, e.method, e.reference, DATETIME(e.created_at) as created_at
    FROM expenses e
    WHERE DATETIME(e.created_at) BETWEEN (SELECT opened_at FROM cash_register_sessions WHERE id = ?) AND (SELECT COALESCE(closed_at, DATETIME('now', 'localtime')) FROM cash_register_sessions WHERE id = ?)
    ORDER BY e.created_at ASC
  `).all(sessionId, sessionId);
}

function getPurchasePaymentsForSession(sessionId) {
  return db.prepare(`
    SELECT pp.id, pp.amount, pp.method, pp.reference, pp.notes, pp.created_at,
           po.po_number, po.supplier_invoice_number, s.name as supplier_name
    FROM purchase_payments pp
    JOIN purchase_orders po ON pp.purchase_order_id = po.id
    JOIN suppliers s ON po.supplier_id = s.id
    WHERE DATETIME(pp.created_at) BETWEEN (SELECT opened_at FROM cash_register_sessions WHERE id = ?) AND (SELECT COALESCE(closed_at, DATETIME('now', 'localtime')) FROM cash_register_sessions WHERE id = ?)
    ORDER BY pp.created_at ASC
  `).all(sessionId, sessionId);
}

function getServicePaymentsForSession(sessionId) {
  const stmt = db.prepare(`
    SELECT sp.id, sp.amount, sp.method, sp.reference, sp.date,
           s.name as service_name, c.name as client_name
    FROM service_payments sp
    JOIN services s ON sp.service_id = s.id
    LEFT JOIN clients c ON s.client_id = c.id
    WHERE DATETIME(sp.date) BETWEEN (SELECT opened_at FROM cash_register_sessions WHERE id = ?) AND (SELECT COALESCE(closed_at, DATETIME('now', 'localtime')) FROM cash_register_sessions WHERE id = ?)
    ORDER BY sp.date ASC
  `);
  const rows = stmt.all(sessionId, sessionId);
  return rows;
}

function getCreditPaymentsForSession(sessionId) {
  // no debug logging
  const stmt = db.prepare(`
    SELECT sp.id, sp.amount, sp.method, sp.reference, sp.created_at,
           s.invoice_number, c.name as client_name
    FROM sale_payments sp
    JOIN sales s ON sp.sale_id = s.id
    LEFT JOIN clients c ON s.client_id = c.id
    WHERE DATETIME(sp.created_at) BETWEEN (SELECT opened_at FROM cash_register_sessions WHERE id = ?) AND (SELECT COALESCE(closed_at, DATETIME('now', 'localtime')) FROM cash_register_sessions WHERE id = ?)
      AND (s.sale_type = 'credit' OR s.paid_amount < s.total_amount OR EXISTS (SELECT 1 FROM sale_payments sp2 WHERE sp2.sale_id = s.id AND sp2.id != sp.id))
    ORDER BY sp.created_at ASC
  `);
  const rows = stmt.all(sessionId, sessionId);
  return rows;
}

function saveReconciliationDetails(sessionId, denominations) {
  const insertStmt = db.prepare(`
    INSERT INTO cash_reconciliation_details (session_id, denomination, count, amount)
    VALUES (?, ?, ?, ?)
  `);
  db.transaction(() => {
    // Eliminar detalles previos si existen para esta sesión
    db.prepare("DELETE FROM cash_reconciliation_details WHERE session_id = ?").run(sessionId);
    for (const denom of denominations) {
      insertStmt.run(sessionId, denom.denomination, denom.count, denom.amount);
    }
  })();
  return { success: true };
}

function getReconciliationDetails(sessionId) {
  return db.prepare(`
    SELECT denomination, count, amount FROM cash_reconciliation_details
    WHERE session_id = ?
    ORDER BY created_at ASC
  `).all(sessionId);
}

module.exports = {
  openCashRegister,
  getActiveSession,
  addCashMovement,
  closeCashRegister,
  getCashRegisterSessions,
  getCashMovements,
  getCashMovementsDetailed,
  getSalesForSession,
  getExpensesForSession,
  getPurchasePaymentsForSession,
  getServicePaymentsForSession,
  getCreditPaymentsForSession,
  saveReconciliationDetails,
  getReconciliationDetails
};