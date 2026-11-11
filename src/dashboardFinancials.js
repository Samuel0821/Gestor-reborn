function localDateKey(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

// The daily KPI is independent of the date range used by the dashboard charts.
function getDailyGrossProfit(db, { day = localDateKey(), historicalCosts = false } = {}) {
  const income = db.prepare(`SELECT COALESCE(SUM(total_amount),0) AS total FROM sales
    WHERE date(sale_date)=? AND status != 'annulled'`).get(day).total;
  const items = db.prepare(`SELECT si.quantity,si.conversion_factor,si.bakery_cost_total,
      p.purchase_price AS base_cost,pv.purchase_price AS variant_cost
    FROM sale_items si JOIN sales s ON s.id=si.sale_id
    LEFT JOIN products p ON p.id=si.product_id
    LEFT JOIN product_variants pv ON pv.id=si.variant_id
    WHERE date(s.sale_date)=? AND s.status != 'annulled'`).all(day);
  const cost = items.reduce((sum, item) => {
    if (historicalCosts && item.bakery_cost_total != null) return sum + item.bakery_cost_total;
    const unitCost = item.variant_cost > 0 ? item.variant_cost : (item.base_cost || 0) * (item.conversion_factor || 1);
    return sum + unitCost * item.quantity;
  }, 0);
  return income - cost;
}

module.exports = { localDateKey, getDailyGrossProfit };
