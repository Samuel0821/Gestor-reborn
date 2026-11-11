const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
require('./sqlite-test-runtime.cjs');
const Database = require('better-sqlite3');
const { localDateKey, getDailyGrossProfit } = require('../src/dashboardFinancials');
const db = new Database(':memory:');
try {
  db.exec(`
    CREATE TABLE sales(id INTEGER PRIMARY KEY,sale_date TEXT,total_amount REAL,status TEXT);
    CREATE TABLE products(id INTEGER PRIMARY KEY,purchase_price REAL);
    CREATE TABLE product_variants(id INTEGER PRIMARY KEY,purchase_price REAL);
    CREATE TABLE sale_items(sale_id INTEGER,product_id INTEGER,variant_id INTEGER,quantity REAL,conversion_factor REAL,bakery_cost_total REAL);
    INSERT INTO products VALUES(1,10);
    INSERT INTO product_variants VALUES(1,25),(2,0);
    INSERT INTO sales VALUES
      (1,'2026-11-07 00:00:00',100,'completed'),
      (2,'2026-11-07 23:59:59',80,'completed'),
      (3,'2026-11-06 23:59:59',9000,'completed'),
      (4,'2026-11-08 00:00:00',8000,'completed'),
      (5,'2026-11-07 12:00:00',7000,'annulled'),
      (6,'2026-11-07 15:00:00',50,'completed');
    INSERT INTO sale_items VALUES
      (1,1,NULL,2,1,12),
      (2,1,1,2,1,30),
      (3,1,NULL,1,1,NULL),
      (4,1,NULL,1,1,NULL),
      (5,1,NULL,1,1,NULL),
      (6,1,2,1,3,NULL);
  `);
  // 230 of today's sales, minus base cost 20, variant cost 50 and fallback cost 30.
  assert.equal(getDailyGrossProfit(db, { day: '2026-11-07' }), 130);
  // Bakery uses each sale's recorded costs, even when current purchase prices differ.
  assert.equal(getDailyGrossProfit(db, { day: '2026-11-07', historicalCosts: true }), 158);
  assert.equal(getDailyGrossProfit(db, { day: '2026-11-09' }), 0);
  assert.equal(localDateKey(new Date(2026, 10, 7, 23, 59)), '2026-11-07');
  assert.equal(localDateKey(new Date(2026, 0, 1, 0, 1)), '2026-01-01');

  // Run the actual card renderer: a monthly result must never populate the daily card.
  const card = { classList: { remove() {} }, textContent: '' };
  const context = {
    document: { addEventListener() {}, getElementById: id => id === 'kpi-net-profit' ? card : null },
    performance: { now: () => 0 },
    requestAnimationFrame: callback => callback(1000),
    Intl, console
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/js/dashboard.js'), 'utf8'), context);
  context.renderKPIs({ salesToday: 230, salesYesterday: 0, alerts: {}, financials: { grossProfitToday: 130, netProfit: 999999 } });
  assert.equal(card.textContent, new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(130));
  console.log('OK: daily dashboard profit excludes other days and annulled sales, handles variant/historical costs and local dates, and renders the daily result.');
} finally { db.close(); }
