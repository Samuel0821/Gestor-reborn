window.BakeryUnits = {
  measures: { kg:{family:'g',factor:1000,label:'KG'},g:{family:'g',factor:1,label:'GR'},l:{family:'ml',factor:1000,label:'L'},ml:{family:'ml',factor:1,label:'ML'},unit:{family:'unit',factor:1,label:'UN'} },
  fromCode: { KILOGRAMO:'kg',GRAMO:'g',LITRO:'l',MILILITRO:'ml',UNIDAD:'unit' },
  preferred(product) { return product.bakery?.attributes?._ui?.measure || ({g:'kg',ml:'l',unit:'unit'}[product.bakery?.unit]) || this.fromCode[product.base_unit_code] || 'unit'; },
  options(family) { return Object.entries(this.measures).filter(([,m])=>!family || m.family===family).map(([code,m])=>`<option value="${code}">${m.label}</option>`).join(''); },
  esc(value) { return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  money(value) { return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:4}).format(Number(value)||0); },
  amount(value) { return new Intl.NumberFormat('es-CO',{maximumFractionDigits:6}).format(Number(value)||0); }
};
