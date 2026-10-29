const ServiceCommercial = {
  isService(item) {
    return !item.product_id && Boolean(item.service_id || item.is_service || item.product_code === 'SERV' ||
      String(item.product_name).toLowerCase().startsWith('[servicio]'));
  },
  isValid(item) {
    return item.quantity !== '' && item.price !== '' && item.quantity != null && item.price != null &&
      Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0 &&
      Number.isFinite(Number(item.price)) && Number(item.price) >= 0;
  },
  edit(item, field, value) {
    if (!this.isService(item) || !['quantity', 'price'].includes(field)) return false;
    item[field] = value === '' ? '' : Number(value);
    item.subtotal = this.isValid(item) ? Math.round(Number(item.quantity) * Number(item.price) * 100) / 100 : 0;
    return true;
  },
  inputsValid(items) {
    return items.every(item => !this.isService(item) || this.isValid(item));
  }
};
if (typeof module !== 'undefined') module.exports = ServiceCommercial;
