function normalizeServiceItems(data) {
  const source = data.items === undefined
    ? [{ name: data.name, quantity: 1, price: data.price }]
    : data.items;
  if (!Array.isArray(source) || source.length === 0) {
    throw new Error('Agrega al menos un trabajo al servicio.');
  }
  const items = source.map(item => {
    if (!item || typeof item.name !== 'string' || !item.name.trim()) {
      throw new Error('Cada trabajo debe tener un nombre.');
    }
    const quantity = Number(item.quantity);
    const price = Number(item.price);
    if (item.quantity === '' || !Number.isFinite(quantity) || quantity <= 0 ||
        item.price === '' || item.price == null || !Number.isFinite(price) || price < 0) {
      throw new Error('Indica cantidades mayores que cero y valores unitarios válidos.');
    }
    const subtotal = Math.round(quantity * price * 100) / 100;
    if (!Number.isFinite(subtotal)) throw new Error('El subtotal del trabajo es demasiado grande.');
    return { name: item.name.trim(), quantity, price, subtotal };
  });
  const price = Math.round(items.reduce((total, item) => total + item.subtotal, 0) * 100) / 100;
  if (!Number.isFinite(price)) throw new Error('El total del servicio es demasiado grande.');
  return { items, price };
}

module.exports = { normalizeServiceItems };
