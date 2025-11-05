const { db } = require("./database");

// Apertura de caja

function openCashRegister(openingBalance) {
  // Cerrar cualquier caja abierta previamente
  db.prepare(`
    UPDATE cash_register_sessions
    SET status = 'closed', closed_at = CURRENT_TIMESTAMP
    WHERE status = 'open'
  `).run();

  // Crear nueva sesión
  const stmt = db.prepare(`
    INSERT INTO cash_register_sessions (opening_balance, status)
    VALUES (?, 'open')
  `);
  const result = stmt.run(openingBalance);

  return { success: true, session_id: result.lastInsertRowid };
}

// Obtener sesión activa

function getActiveSession() {
  return db.prepare(`
    SELECT * FROM cash_register_sessions
    WHERE status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1
  `).get();
}

// Registrar movimiento de caja
// type = 'sale' | 'in' | 'out'

function addCashMovement(sessionId, type, amount, description = null) {
  const stmt = db.prepare(`
    INSERT INTO cash_movements (session_id, type, description, amount)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(sessionId, type, description, amount);
  return { success: true, movement_id: result.lastInsertRowid };
}

// Cierre de caja

function closeCashRegister(realClosingBalance) {
  const session = getActiveSession();
  if (!session) return { success: false, message: "No hay caja abierta." };

  // Calcular total movimientos en efectivo
  const movements = db.prepare(`
    SELECT * FROM cash_movements WHERE session_id = ?
  `).all(session.id);

  const totalIn = movements
    .filter(m => m.type === "sale" || m.type === "in")
    .reduce((sum, m) => sum + m.amount, 0);

  const totalOut = movements
    .filter(m => m.type === "out")
    .reduce((sum, m) => sum + m.amount, 0);

  const expected = session.opening_balance + totalIn - totalOut;
  const diff = realClosingBalance - expected;

  db.prepare(`
    UPDATE cash_register_sessions
    SET closed_at = CURRENT_TIMESTAMP,
        closing_balance = ?,
        expected_balance = ?,
        difference = ?,
        status = 'closed'
    WHERE id = ?
  `).run(realClosingBalance, expected, diff, session.id);

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
    SELECT * FROM cash_register_sessions
    ORDER BY opened_at DESC
  `).all();
}

function getCashMovements(sessionId) {
  return db.prepare(`
    SELECT * FROM cash_movements
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
  getCashMovements
};