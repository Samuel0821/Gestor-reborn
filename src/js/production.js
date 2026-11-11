window.Swal ||= { fire: async options => ({ isConfirmed: window.confirm(typeof options === 'string' ? options : `${options.title}\n${options.text || ''}`) }) };
document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id), U = window.BakeryUnits;
  let state, key, recipeKey, ready = false, busy = false, serial = 0, offset = 0;
  let meta = { request_id: crypto.randomUUID() }, legacyCosts = [];
  const day = () => new Date().toLocaleDateString('sv-SE');
  const preferred = p => JSON.parse(p.attributes || '{}')._ui?.measure || ({ g: 'kg', ml: 'l', unit: 'unit' }[p.unit]);
  const status = value => ({ draft: 'Borrador', confirmed: 'Confirmada', annulled: 'Anulada' }[value] || value);
  const finished = () => state.items.filter(p => p.kind === 'finished');
  const options = (items, label = p => p.name) => items.map(p => `<option value="${p.id}">${U.esc(label(p))}</option>`).join('');
  const empty = text => `<div class="production-empty">${U.esc(text)}</div>`;
  const table = (head, rows) => rows.length ? `<table class="table table-striped table-hover align-middle table-sm sale-items-table"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>` : empty('Todavía no hay registros para mostrar.');
  function message(text, error = false) {
    $('production-message').textContent = text;
    $('production-message').className = `alert ${error ? 'alert-danger' : 'alert-success'}`;
    $('production-message').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  async function api(action, data = {}) { const result = await window.api.bakery(action, data); if (!result.success) throw new Error(result.message); return result; }
  async function perform(fn) {
    if (busy) return; busy = true;
    document.querySelectorAll('.production-page button').forEach(b => b.disabled = true);
    try { await fn(); } catch (error) { message(error.message, true); }
    finally { busy = false; document.querySelectorAll('.production-page button').forEach(b => b.disabled = false); }
  }
  function tab(name, focus = false) {
    for (const item of ['recipe', 'batch']) {
      const selected = item === name, button = $(`tab-${item}`);
      button.classList.toggle('active', selected); button.setAttribute('aria-selected', selected); button.tabIndex = selected ? 0 : -1;
      $(`panel-${item}`).hidden = !selected;
    }
    if (focus) $(`tab-${name}`).focus();
    if (key) localStorage.setItem(`${key}:tab`, name);
  }
  for (const name of ['recipe', 'batch']) {
    $(`tab-${name}`).onclick = () => tab(name);
    $(`tab-${name}`).onkeydown = event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); tab(event.key === 'Home' ? 'recipe' : event.key === 'End' ? 'batch' : name === 'recipe' ? 'batch' : 'recipe', true); } };
  }
  function restore(select, value) {
    if (value != null && value !== '' && ![...select.options].some(o => o.value === String(value))) select.insertAdjacentHTML('beforeend', `<option value="${U.esc(value)}">Referencia ${U.esc(value)} (revisar)</option>`);
    select.value = value ?? '';
  }
  function add(target, data = {}) {
    const output = target === 'production-outputs', recipe = target === 'recipe-inputs';
    const row = document.createElement('tr'), id = ++serial;
    row.className = output ? 'sale-barcode-box production-output-row' : 'sale-barcode-box';
    const field = (name, label, value = '', type = 'number', required = true) => `<label for="line-${id}-${name}">${label}</label><input id="line-${id}-${name}" data-field="${name}" type="${type}" class="form-control" ${type === 'number' ? `min="${name === 'quantity' || name === 'cost_share' ? '0.000001' : '0'}" step="any"` : ''} value="${U.esc(value ?? '')}" ${required ? 'required' : ''}>`;
    const products = state.items.filter(p => output ? p.kind === 'finished' : p.kind !== 'finished');
    row.innerHTML = `<td><label for="line-${id}-product">${output ? 'Producto elaborado' : 'Materia prima'}</label><select id="line-${id}-product" data-field="product_id" class="form-select" required><option value="">Seleccionar…</option>${output ? '<option value="new">+ Crear producto nuevo</option>' : ''}${options(products, p => recipe || output ? p.name : `${p.name} · ${U.amount(p.stock / U.measures[preferred(p)].factor)} ${U.measures[preferred(p)].label}`)}</select>${output ? `<div class="production-new-product" hidden>${field('product_name', 'Nombre del nuevo producto', data.product_name, 'text', false)}<p class="production-line-help">Se creará en Productos al guardar, sin duplicar uno del mismo nombre.</p></div>` : ''}</td><td>${field('quantity', recipe ? 'Cantidad de referencia (opcional)' : output ? 'Cantidad buena' : 'Cantidad utilizada', data.quantity, 'number', !recipe)}</td><td><label for="line-${id}-unit">Medida</label><select id="line-${id}-unit" data-field="unit" class="form-select"></select></td>${output ? `<td>${field('waste_quantity', 'Desperdicio', data.waste_quantity ?? 0, 'number', false)}<p class="production-line-help">No se suma al inventario.</p></td>` : ''}<td class="line-remove"><button class="btn btn-outline-danger remove-line" type="button" aria-label="Quitar ${output ? 'producto' : 'materia prima'}">Quitar</button></td>`;
    if (!recipe) {
      const details = output ? `<div class="production-extra-grid"><div>${field('expected_quantity', 'Cantidad esperada', data.expected_quantity, 'number', false)}</div><div>${field('cost_share', 'Proporción del costo', data.cost_share ?? 1)}<p class="production-line-help">Un solo producto: deja 1. Varios productos: reparte según la masa usada, por ejemplo 7 y 3.</p></div><div>${field('sale_price', 'Nuevo precio de venta por medida ($)', data.sale_price, 'number', false)}<p class="production-line-help">Vacío conserva el precio actual. Un producto nuevo empieza sin precio; configúralo antes de vender.</p></div><div>${field('expiration_date', 'Vencimiento del producto', data.expiration_date, 'date', false)}</div></div>` : `<div class="production-extra-grid"><div><label for="line-${id}-lot">Lote de materia prima</label><select id="line-${id}-lot" class="form-select" data-field="lot_id"></select><p class="production-line-help">Automático usa primero los lotes vigentes próximos a vencer.</p></div></div>`;
      row.insertAdjacentHTML('beforeend', `<td class="line-extra"><details ${output && (Number(data.waste_quantity) > 0 || data.sale_price != null || data.expiration_date) ? 'open' : ''}><summary>${output ? 'Precio, vencimiento y otros datos (opcional)' : 'Elegir lote específico (opcional)'}</summary>${details}</details></td>`);
    }
    $(target).append(row);
    const product = row.querySelector('[data-field=product_id]'), unit = row.querySelector('[data-field=unit]');
    function measures() {
      const p = state.items.find(p => p.id === Number(product.value));
      const isNew = output && product.value === 'new';
      unit.innerHTML = U.options(p?.unit); unit.value = p ? preferred(p) : 'unit';
      if (output) { row.querySelector('.production-new-product').hidden = !isNew; row.querySelector('[data-field=product_name]').required = isNew; }
      const lot = row.querySelector('[data-field=lot_id]');
      if (lot) lot.innerHTML = '<option value="">Automático por vencimiento</option>' + options(state.lots.filter(l => l.product_id === p?.id), l => `${l.lot_number} · ${l.expiration_date || 'Sin vencimiento'}`);
    }
    product.value = data.product_id || (output && data.product_name ? 'new' : ''); measures();
    row.querySelectorAll('[data-field]').forEach(el => { const value = data[el.dataset.field]; if (value != null) { if (el.tagName === 'SELECT') restore(el, value); else el.value = value; } });
    product.onchange = () => { measures(); save(); };
    row.querySelector('.remove-line').onclick = () => { row.remove(); save(); };
  }
  const rows = target => [...$(target).children].map(row => Object.fromEntries([...row.querySelectorAll('[data-field]')].map(el => [el.dataset.field, ['product_id', 'lot_id'].includes(el.dataset.field) ? (Number(el.value) || null) : el.value])));
  function payload() {
    return { name: $('production-name').value, notes: $('production-notes').value, recipe_id: meta.recipe_id, inputs: rows('production-inputs'), outputs: rows('production-outputs').map(line => { if (line.sale_price === '') delete line.sale_price; else line.sale_price_unit = line.unit; return line; }), costs: legacyCosts };
  }
  function summary() {
    const inputs = rows('production-inputs').filter(r => r.product_id && Number(r.quantity) > 0), outputs = rows('production-outputs').filter(r => (r.product_id || r.product_name) && Number(r.quantity) > 0);
    $('production-summary').textContent = !outputs.length ? 'Completa las materias primas y los productos elaborados' : `${inputs.length} materias primas · ${outputs.length} productos · ${outputs.map(r => `${U.amount(r.quantity)} ${U.measures[r.unit]?.label || r.unit}`).join(' + ')} para inventario`;
    $('production-source-label').textContent = meta.recipe_id ? 'Basada en receta' : 'Desde cero';
    const recipe = state?.recipes.find(item => item.id === Number(meta.recipe_id));
    $('production-recipe-reference').hidden = !recipe;
    $('production-recipe-instructions').textContent = recipe ? JSON.parse(recipe.payload).notes || 'Sin descripción registrada.' : '';
  }
  function showLegacyCosts() {
    const box = $('legacy-production-costs'); box.hidden = !legacyCosts.length;
    box.innerHTML = legacyCosts.length ? `<strong>Este borrador anterior incluye costos adicionales.</strong><p>Se conservarán al confirmar: ${legacyCosts.map(c => `${U.esc(c.name)}: ${U.money(c.amount)}`).join(' · ')}. Las nuevas producciones registran estos pagos en Gastos.</p><button type="button" id="remove-legacy-costs" class="btn btn-sm btn-outline-secondary">Quitar costos de este borrador</button>` : '';
    if (legacyCosts.length) $('remove-legacy-costs').onclick = () => { if (confirm('¿Quitar estos costos de la producción? Los gastos registrados no se borrarán.')) { legacyCosts = []; showLegacyCosts(); save(); } };
  }
  function save() {
    summary(); if (!ready) return;
    localStorage.setItem(key, JSON.stringify({ meta, fields: { 'production-name': $('production-name').value, 'production-date': $('production-date').value, 'production-notes': $('production-notes').value }, tables: { 'production-inputs': rows('production-inputs'), 'production-outputs': rows('production-outputs'), 'production-costs': legacyCosts } }));
    localStorage.setItem(recipeKey, JSON.stringify({ fields: Object.fromEntries(['recipe-product', 'recipe-name', 'recipe-description', 'recipe-unit'].map(id => [id, $(id).value])), inputs: rows('recipe-inputs') }));
  }
  function resetProduction() {
    meta = { request_id: crypto.randomUUID() }; legacyCosts = [];
    $('production-name').value = ''; $('production-notes').value = ''; $('production-date').value = day();
    for (const target of ['production-inputs', 'production-outputs']) { $(target).replaceChildren(); add(target); }
    $('production-status').textContent = 'Sin movimientos de inventario hasta confirmar.'; showLegacyCosts(); save();
  }
  function recipeMeasure(value) {
    const p = finished().find(p => p.id === Number(value)); $('recipe-unit').innerHTML = U.options(p?.unit); $('recipe-unit').value = p ? preferred(p) : 'unit';
    $('recipe-name').readOnly = Boolean(p); if (p) $('recipe-name').value = p.name;
  }
  function resetRecipe() { $('recipe-form').reset(); $('recipe-product').value = ''; recipeMeasure(''); $('recipe-inputs').replaceChildren(); add('recipe-inputs'); $('recipe-edit-state').textContent = 'Nueva receta'; save(); }
  function renderRecipes() {
    const search = $('recipe-search').value.trim().toLocaleLowerCase('es');
    $('recipe-list').innerHTML = table(['Producto / receta', 'Versión', 'Materias primas', 'Acciones'], state.recipes.filter(r => r.name.toLocaleLowerCase('es').includes(search)).map(r => {
      const p = JSON.parse(r.payload);
      return [`<strong>${U.esc(r.name)}</strong>`, `<span class="badge bg-secondary">v${r.version}</span>`, p.inputs.length, `<div class="d-flex flex-wrap gap-2"><button type="button" class="btn btn-sm btn-outline-secondary" data-recipe-view="${r.id}">Ver receta</button><button type="button" class="btn btn-sm btn-outline-primary" data-recipe-use="${r.id}">Crear producción</button></div>`];
    }));
  }
  function render() {
    const selected = $('recipe-select').value; $('recipe-select').innerHTML = '<option value="">Seleccionar receta…</option>' + options(state.recipes, r => `${r.name} · v${r.version}`); $('recipe-select').value = selected;
    const product = $('recipe-product').value; $('recipe-product').innerHTML = '<option value="">Crear un producto nuevo</option>' + options(finished()); restore($('recipe-product'), product);
    renderRecipes();
    $('bakery-productions').innerHTML = table(['N.º / fecha', 'Producción', 'Productos y cantidad buena', 'Estado', 'Costo de materias primas¹', 'Responsable', 'Acciones'], state.documents.filter(d => d.kind === 'production').map(d => {
      const p = JSON.parse(d.payload);
      return [`<strong>#${d.id}</strong><br>${U.esc(d.doc_date)}`, U.esc(p.name), p.outputs.map(o => `${U.esc(state.items.find(i => i.id === Number(o.product_id))?.name || o.product_name || `#${o.product_id}`)}: ${U.amount(o.quantity)} ${U.esc(U.measures[o.unit]?.label || o.unit)}`).join('<br>'), `<span class="badge ${d.status === 'confirmed' ? 'bg-success' : d.status === 'draft' ? 'bg-warning text-dark' : 'bg-secondary'}">${status(d.status)}</span>`, d.total_cost == null || d.status === 'draft' ? '—' : U.money(d.total_cost), U.esc(d.author_name), `<div class="d-flex flex-wrap gap-2"><button type="button" class="btn btn-sm btn-outline-secondary" data-detail="${d.id}">Detalle</button>${d.status === 'draft' ? `<button type="button" class="btn btn-sm btn-outline-primary" data-load="${d.id}">Continuar</button>` : ''}${state.admin && d.status !== 'annulled' ? `<button type="button" class="btn btn-sm btn-outline-danger" data-reverse="${d.id}">Anular</button>` : ''}</div>`];
    })) + '<p class="production-line-help mt-3">¹ Los registros anteriores pueden incluir costos adicionales asignados. Los nuevos toman el costo de la materia prima consumida.</p>';
  }
  async function refresh() { state = await api('state'); render(); }
  function load(doc) {
    const p = JSON.parse(doc.payload); meta = { id: doc.id, revision: doc.revision, request_id: doc.request_id, recipe_id: p.recipe_id }; legacyCosts = p.costs || [];
    $('production-name').value = p.name; $('production-notes').value = p.notes || ''; $('production-date').value = doc.doc_date;
    for (const [target, data] of [['production-inputs', p.inputs], ['production-outputs', p.outputs]]) { $(target).replaceChildren(); (data || []).forEach(line => add(target, line)); }
    $('production-status').textContent = `Borrador #${doc.id} · versión ${doc.revision}`; showLegacyCosts(); tab('batch'); save();
  }
  function applyRecipe(id) {
    const recipe = state.recipes.find(r => r.id === Number(id));
    if (!recipe) throw new Error('Selecciona una receta.');
    if ($('production-name').value && !confirm('¿Reemplazar el formulario de producción actual? Los borradores guardados permanecen en el historial.')) return;
    resetProduction(); meta.recipe_id = recipe.id; const p = JSON.parse(recipe.payload); $('production-name').value = recipe.name;
    for (const [target, data] of [['production-inputs', p.inputs], ['production-outputs', p.outputs]]) {
      $(target).replaceChildren(); for (const source of data || []) { const line = { ...source }; line.quantity = ''; delete line.expected_quantity; for (const k of ['lot_id', 'expiration_date', 'sale_price', 'sale_price_unit', 'cost_total', 'unit_cost', 'base_quantity']) delete line[k]; if (target === 'production-outputs') line.waste_quantity = 0; add(target, line); }
    }
    $('recipe-select').value = recipe.id; tab('batch'); save(); $('production-name').focus();
  }
  try {
    state = await api('state'); if (!state.admin && !state.permissions.includes('production')) throw new Error('Tu usuario no tiene asignada la responsabilidad de producción.');
    document.querySelector('a[href^="products"]').hidden = !state.admin && !state.permissions.includes('inventory');
    key = `production:${state.instance}:${state.user.id}`; recipeKey = `recipe:${state.instance}:${state.user.id}`;
    render(); $('production-date').value = day(); $('production-date').max = day(); $('production-history-start').value = day(); $('production-history-end').value = day(); recipeMeasure('');
    const draft = JSON.parse(localStorage.getItem(key) || localStorage.getItem(`bakery:draft:${state.instance}:${state.user.id}`) || 'null');
    if (draft) {
      meta = draft.meta || meta; for (const [id, value] of Object.entries(draft.fields || {})) if ($(id)) $(id).value = value;
      for (const target of ['production-inputs', 'production-outputs']) (draft.tables?.[target] || []).forEach(line => add(target, line));
      legacyCosts = draft.tables?.['production-costs'] || [];
      if (meta.id) { const result = await api('document', { id: meta.id }); if (result.document.status !== 'draft') resetProduction(); }
    }
    const recipeDraft = JSON.parse(localStorage.getItem(recipeKey) || 'null');
    if (recipeDraft) { restore($('recipe-product'), recipeDraft.fields['recipe-product']); recipeMeasure($('recipe-product').value); for (const [id, value] of Object.entries(recipeDraft.fields)) if ($(id)) $(id).value = value; (recipeDraft.inputs || []).forEach(line => add('recipe-inputs', line)); }
    for (const target of ['recipe-inputs', 'production-inputs', 'production-outputs']) if (!$(target).children.length) add(target);
    tab(localStorage.getItem(`${key}:tab`) || (draft?.fields?.['production-name'] ? 'batch' : 'recipe')); showLegacyCosts(); ready = true; summary();
  } catch (error) { message(error.message, true); $('recipe-form').hidden = true; $('bakery-production-form').hidden = true; return; }
  document.addEventListener('input', save); document.addEventListener('change', save); window.addEventListener('pagehide', save);
  for (const form of [$('recipe-form'), $('bakery-production-form')]) form.addEventListener('invalid', event => { const details = event.target.closest('details'); if (details) details.open = true; }, true);
  document.querySelectorAll('.add-line').forEach(button => button.onclick = () => { add(button.dataset.target); save(); });
  $('recipe-product').onchange = () => { recipeMeasure($('recipe-product').value); save(); };
  $('recipe-search').oninput = renderRecipes;
  $('new-recipe').onclick = () => { if (confirm('¿Limpiar el formulario de receta?')) resetRecipe(); };
  $('recipe-form').onsubmit = event => { event.preventDefault(); perform(async () => {
    if (!$('recipe-form').reportValidity()) return;
    const result = await api('saveRecipe', { name: $('recipe-name').value.trim(), notes: $('recipe-description').value.trim(), reference_only: true, inputs: rows('recipe-inputs').map(line => { if (line.quantity === '') delete line.quantity; return line; }), outputs: [{ product_id: Number($('recipe-product').value) || null, product_name: $('recipe-name').value.trim(), unit: $('recipe-unit').value, cost_share: 1 }], costs: [] });
    await refresh(); resetRecipe(); message(`Receta guardada · versión ${result.version}. El producto está en inventario y no se modificaron sus existencias.`);
  }); };
  async function saveDraft() {
    const result = await api('saveDraft', { ...meta, date: $('production-date').value, payload: payload() }); meta.id = result.id; meta.revision = result.revision; save();
    await refresh(); const detail = await api('document', { id: result.id }); load(detail.document); return result;
  }
  $('bakery-production-form').onsubmit = event => { event.preventDefault(); perform(async () => { await saveDraft(); message('Borrador guardado. Aún no se ha consumido materia prima ni aumentado las existencias.'); }); };
  $('confirm-production').onclick = () => perform(async () => {
    if (!$('bakery-production-form').reportValidity() || !confirm('¿Confirmar la producción? Se descontará la materia prima y se sumarán las cantidades buenas al inventario.')) return;
    await saveDraft(); const result = await api('confirm', { id: meta.id, revision: meta.revision });
    try { await refresh(); resetProduction(); message(`Producción #${result.id} confirmada. Materias primas descontadas y productos disponibles en inventario.`); }
    catch (_) { resetProduction(); message(`Producción #${result.id} confirmada. Recarga la vista para actualizar existencias e historial; no repitas el registro.`); }
  });
  for (const id of ['new-production', 'discard-production']) $(id).onclick = () => { if (confirm('¿Limpiar el formulario de producción? Los borradores guardados se conservan.')) { resetProduction(); tab('batch'); } };
  $('apply-recipe').onclick = () => { try { applyRecipe($('recipe-select').value); } catch (error) { message(error.message, true); } };
  $('recipe-list').onclick = event => {
    const use = event.target.closest('[data-recipe-use]'), view = event.target.closest('[data-recipe-view]');
    if (use) { try { applyRecipe(use.dataset.recipeUse); } catch (error) { message(error.message, true); } }
    if (view) {
      const recipe = state.recipes.find(r => r.id === Number(view.dataset.recipeView)), p = JSON.parse(recipe.payload);
      let detail = $('recipe-detail'); if (!detail) { detail = document.createElement('div'); detail.id = 'recipe-detail'; $('recipe-list').after(detail); }
      detail.innerHTML = `<div class="production-explainer mt-3"><strong>${U.esc(recipe.name)} · versión ${recipe.version}</strong><p style="white-space:pre-wrap">${U.esc(p.notes || 'Sin descripción registrada.')}</p>${table(['Materia prima', 'Cantidad de referencia'], p.inputs.map(line => [U.esc(state.items.find(i => i.id === Number(line.product_id))?.name || `#${line.product_id}`), line.quantity == null || line.quantity === '' ? 'La registra el responsable al producir' : `${U.amount(line.quantity)} ${U.esc(U.measures[line.unit]?.label || line.unit)}`]))}</div>`; detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };
  async function history(append) { const result = await api('history', { kind: 'production', start: $('production-history-start').value, end: $('production-history-end').value, offset: append ? offset : 0 }); state.documents = append ? [...state.documents, ...result.documents].filter((d, i, all) => all.findIndex(x => x.id === d.id) === i) : result.documents; offset = result.next_offset; $('production-history-more').hidden = !result.has_more; render(); }
  $('production-history-form').onsubmit = event => { event.preventDefault(); perform(() => history(false)); }; $('production-history-more').onclick = () => perform(() => history(true));
  $('bakery-productions').onclick = event => {
    const loadBtn = event.target.closest('[data-load]'), reverse = event.target.closest('[data-reverse]'), detail = event.target.closest('[data-detail]');
    if (loadBtn) { load(state.documents.find(d => d.id === Number(loadBtn.dataset.load))); $('production-name').focus(); }
    if (reverse) perform(async () => { const reason = prompt('Motivo de anulación (solo si los productos permanecen completos):'); if (!reason) return; await api('reverse', { id: Number(reverse.dataset.reverse), reason }); await refresh(); message('Producción anulada con su historial.'); });
    if (detail) perform(async () => {
      const result = await api('document', { id: Number(detail.dataset.detail) }), d = result.document, p = JSON.parse(d.payload);
      $('bakery-production-detail').innerHTML = `<div class="production-explainer"><strong>#${d.id} · ${U.esc(p.name)} · ${status(d.status)}</strong><p style="white-space:pre-wrap">${U.esc(p.notes)}</p>${table(['Producto elaborado', 'Cantidad buena', 'Desperdicio', 'Costo asignado'], p.outputs.map(line => [U.esc(state.items.find(i => i.id === Number(line.product_id))?.name || line.product_name || `#${line.product_id}`), `${U.amount(line.quantity)} ${U.esc(U.measures[line.unit]?.label || line.unit)}`, U.amount(line.waste_quantity || 0), line.cost_total == null ? '—' : U.money(line.cost_total)]))}${table(['Materia prima utilizada', 'Cantidad', 'Lote'], (p.inputs || []).map(line => [U.esc(state.items.find(i => i.id === Number(line.product_id))?.name || `#${line.product_id}`), `${U.amount(line.quantity)} ${U.esc(U.measures[line.unit]?.label || line.unit)}`, line.lot_id ? `#${line.lot_id}` : 'Asignación automática']))}</div>`;
      $('bakery-production-detail').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  };
});
