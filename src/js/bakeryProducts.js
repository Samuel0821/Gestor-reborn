window.BakeryProducts = (() => {
  const $ = id => document.getElementById(id), U = window.BakeryUnits;
  let config, previousMeasure='kg', current=null;
  const result={ active:false, canManage:false };
  const fields=['product-stock','product-purchase-price','product-sale-price','product-special-price','product-special-price-2'];
  function measure() { return U.fromCode[config.units.find(unit=>String(unit.id)===$('product-base-unit').value)?.code] || 'kg'; }
  function choose(code) { $('product-base-unit').value=config.units.find(unit=>U.fromCode[unit.code]===code)?.id || ''; }
  function labels() {
    const label=U.measures[measure()].label;
    document.querySelector('label[for="product-base-unit"]').textContent='Unidad de medida';
    for(const [id,text] of [['product-stock','Cantidad actual'],['product-purchase-price','Costo por'],['product-sale-price','Precio de venta por']]) {
      const input=$(id), element=input.closest('[class*="col-"]')?.querySelector('label');
      if(element) element.textContent=`${text} ${label}`;
    }
    $('product-base-content').value='1'; $('fractioned-base-content-group').hidden=true;
    $('product-min-stock-label').textContent='Cantidad mínima';
    $('product-variants-help').textContent=`Contenido y factor expresados en ${label}; por ejemplo 0.5 KG para una bolsa de 500 GR, o 6 UN para seis panes. Precios por presentación.`;
    document.querySelectorAll('.pharmacy-content-heading').forEach(el=>el.textContent=`Contenido ${label}`);
    document.querySelector('label[for="product-special-price"]')?.replaceChildren(document.createTextNode(`Precio especial 1 por ${label}`));
    document.querySelector('label[for="product-special-price-2"]')?.replaceChildren(document.createTextNode(`Precio especial 2 por ${label}`));
  }
  function minimum(code,value) {
    $('product-min-unit').innerHTML=U.options(U.measures[measure()].family);
    $('product-min-unit').value=code;
    $('product-min-stock').value=value;
  }
  result.initialize=async cfg=>{
    if(cfg.businessType?.code!=='PANADERIA') return;
    config=cfg; result.active=true;
    const access=await window.api.bakery('access'); result.canManage=access.admin || access.permissions?.includes('inventory');
    if(!$('bakery-product-kind')) {
      const group=document.createElement('div');group.className='col-md-4';
      group.innerHTML='<label class="form-label" for="bakery-product-kind">Clase de artículo</label><select id="bakery-product-kind" class="form-select"><option value="raw">Materia prima / Empaque</option><option value="finished">Producto elaborado</option><option value="resale">Mercancía de reventa</option></select><label class="form-check-label mt-2"><input id="bakery-product-retail" type="checkbox"> Permitir venta directa de esta materia prima</label>';
      $('product-type').parentElement.before(group); $('product-type').parentElement.hidden=true;
      const opening=document.createElement('div');opening.className='col-12';opening.id='bakery-opening-fields';opening.innerHTML='<p class="small text-muted mb-2">Las existencias iniciales se valorizan con el costo por medida. Las compras posteriores se reciben en Órdenes de Compra.</p><div class="row g-3"><div class="col-md-6"><label class="form-label" for="bakery-opening-lot">Lote inicial (opcional)</label><input id="bakery-opening-lot" class="form-control"></div><div class="col-md-6"><label class="form-label" for="bakery-opening-expiry">Vencimiento inicial (opcional)</label><input id="bakery-opening-expiry" type="date" class="form-control"></div></div>';
      group.after(opening);$('product-lots-section').hidden=true;
      $('bakery-product-kind').addEventListener('change',()=>{ $('product-type').value=config.productTypes.find(type=>type.code===({raw:'MATERIAL',finished:'ALIMENTO',resale:'PRODUCTO'}[$('bakery-product-kind').value]))?.id || ''; });
      const input=$('product-min-stock'), wrap=document.createElement('div');wrap.className='input-group';input.replaceWith(wrap);wrap.appendChild(input);
      const select=document.createElement('select');select.id='product-min-unit';select.className='form-select';select.setAttribute('aria-label','Unidad de existencia mínima');wrap.appendChild(select);
      $('product-min-stock-label').textContent='Cantidad mínima'; input.min='0';input.step='any';
      $('product-stock').min='0';$('product-stock').step='any';
      $('product-base-unit').addEventListener('change',()=>{
        const next=measure(), before=U.measures[previousMeasure], after=U.measures[next];
        if(before.family!==after.family && current?.bakery){choose(previousMeasure);return;}
        if(before.family===after.family) for(const id of fields) $(id).value=Number($(id).value||0)*(id==='product-stock'?before.factor/after.factor:after.factor/before.factor);
        if(before.family===after.family) document.querySelectorAll('.variant-content,.variant-factor').forEach(input=>{if(input.value)input.value=Number(input.value)*before.factor/after.factor;});
        else { for(const id of fields) $(id).value='0'; minimum(next,0); }
        const oldMin=$('product-min-unit').value;
        if(!oldMin || U.measures[oldMin]?.family!==after.family)minimum(next,0);
        previousMeasure=next;labels();
      });
    }
    const selected=measure();
    $('product-base-unit').innerHTML=config.units.filter(unit=>U.fromCode[unit.code]).map(unit=>`<option value="${unit.id}">${U.measures[U.fromCode[unit.code]].label}</option>`).join('');
    choose(selected); result.reset();
  };
  result.reset=()=>{
    if(!result.active)return;
    current=null; choose(new URLSearchParams(location.search).get('new')==='finished'?'unit':'kg'); previousMeasure=measure();
    $('bakery-product-kind').value=new URLSearchParams(location.search).get('new')==='finished'?'finished':'raw';
    $('bakery-product-kind').disabled=false;$('bakery-product-kind').dispatchEvent(new Event('change'));
    $('bakery-product-retail').checked=false; minimum(measure(),0);
    $('bakery-opening-fields').hidden=false;$('bakery-opening-lot').value='';$('bakery-opening-expiry').value='';
    $('product-stock').readOnly=false; $('product-purchase-price').readOnly=false;labels();
  };
  result.fill=p=>{
    if(!result.active)return;current=p;
    $('bakery-opening-fields').hidden=Boolean(p.bakery);
    const original=U.fromCode[config.units.find(unit=>unit.id===p.base_unit_id)?.code] || 'unit';
    const code=p.bakery?U.preferred(p):original; choose(code); previousMeasure=code;
    const factor=p.bakery?U.measures[code].factor:1;
    document.querySelectorAll('.variant-content,.variant-factor').forEach(input=>{if(input.value)input.value=Number(input.value)/factor;});
    $('bakery-product-kind').value=p.bakery?.kind || (config.productTypes.find(type=>type.id===p.product_type_id)?.code==='MATERIAL'?'raw':'resale');
    $('bakery-product-kind').disabled=Boolean(p.bakery);$('bakery-product-retail').checked=Boolean(p.bakery?.retail_allowed);
    for(const [id,key] of [['product-stock','stock'],['product-purchase-price','purchase_price'],['product-sale-price','sale_price'],['product-special-price','special_price'],['product-special-price-2','special_price_2']]) $(id).value=Number(p[key]||0)*(id==='product-stock'?1/factor:factor);
    const minCode=p.bakery?.attributes?._ui?.minimum_unit || (p.bakery?.unit==='g' && p.min_stock>=1000?'kg':p.bakery?.unit==='ml' && p.min_stock>=1000?'l':p.bakery?.unit) || code;
    minimum(minCode,Number(p.min_stock||0)/(p.bakery?U.measures[minCode].factor:1));
    $('product-stock').readOnly=false;$('product-purchase-price').readOnly=false;
    labels();
  };
  result.payload=data=>{
    if(!result.active)return data;
    return {...data,lots:[],base_content_units:data.sale_type==='FRACCIONADO'?1:null,bakery:{kind:$('bakery-product-kind').value,measure:measure(),minimum_unit:$('product-min-unit').value,retail_allowed:$('bakery-product-retail').checked,lot_number:$('bakery-opening-lot').value.trim(),expiration_date:$('bakery-opening-expiry').value||null}};
  };
  result.quantity=(p,value,min=false)=>{
    if(!result.active || !p.bakery)return null;
    const code=(min?p.bakery.attributes?._ui?.minimum_unit:null)||U.preferred(p);
    return `${U.amount(value/U.measures[code].factor)} ${U.measures[code].label}`;
  };
  result.price=p=>result.active&&p.bakery?`${U.money(p.sale_price*U.measures[U.preferred(p)].factor)} / ${U.measures[U.preferred(p)].label}`:null;
  result.refresh=()=>{if(!result.active)return;labels();};
  return result;
})();
