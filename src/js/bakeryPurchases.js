window.BakeryPurchases=(()=>{
  const U=window.BakeryUnits,$=id=>document.getElementById(id);let product=null;const result={active:false};
  result.ready=window.api.getBusinessModuleConfig().then(config=>{
    if(config.businessType?.code!=='PANADERIA')return;result.active=true;
    const unit=document.createElement('div');unit.className='col-md-2';unit.innerHTML='<label class="form-label" for="purchase-measure">Medida</label><select id="purchase-measure" class="form-select"></select>';
    $('newOrderQty').parentElement.after(unit);
    const lot=document.createElement('div');lot.className='col-md-3';lot.innerHTML='<label class="form-label" for="purchase-lot">Lote (opcional)</label><input id="purchase-lot" class="form-control">';unit.after(lot);
    const expiry=document.createElement('div');expiry.className='col-md-3';expiry.innerHTML='<label class="form-label" for="purchase-expiry">Vencimiento (opcional)</label><input id="purchase-expiry" class="form-control" type="date">';lot.after(expiry);
    $('newOrderQty').step='any';$('newOrderQty').min='0.000001';$('newOrderCost').step='any';
    $('purchase-measure').onchange=()=>{if(product)$('newOrderCost').value=product.purchase_price*U.measures[$('purchase-measure').value].factor;label();};
  }).catch(error=>console.error('Perfil de compras:',error));
  function label(){const l=$('newOrderCost').parentElement.querySelector('label');if(l)l.textContent=`Costo por ${U.measures[$('purchase-measure').value]?.label||'medida'} ($)`;}
  result.select=p=>{if(!result.active)return;product=p;$('purchase-measure').innerHTML=U.options(p.bakery?.unit);$('purchase-measure').value=U.preferred(p);$('newOrderCost').value=p.purchase_price*U.measures[$('purchase-measure').value].factor;label();};
  result.filter=rows=>result.active?rows.filter(p=>p.bakery&&p.bakery.kind!=='finished'):rows;
  result.line=(p,quantity,price)=>{
    if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(price)||price<0)throw new Error('Indica cantidad y costo válidos.');
    return{product_id:p.id,product_name:p.name,quantity,price,subtotal:quantity*price,bakery_unit:$('purchase-measure').value,
      bakery_lot_number:$('purchase-lot').value.trim(),bakery_expiration_date:$('purchase-expiry').value||null};
  };
  result.same=(a,b)=>a.product_id===b.product_id&&a.bakery_unit===b.bakery_unit&&a.price===b.price&&a.bakery_lot_number===b.bakery_lot_number&&a.bakery_expiration_date===b.bakery_expiration_date;
  result.quantity=item=>result.active?`${U.amount(item.quantity)} ${U.measures[item.bakery_unit]?.label||'medida base'}`:item.quantity;
  result.cancel=async id=>{
    const reason=prompt('Motivo para anular la recepción. Solo procede sin pagos y con los lotes completos:');if(!reason)return;
    const response=await window.api.bakery('reversePurchase',{id,reason});
    await Swal.fire(response.success?'Recepción anulada':'No se pudo anular',response.message||'Inventario y deuda revertidos con historial.',response.success?'success':'error');
    if(response.success)loadOrders();
  };
  return result;
})();
