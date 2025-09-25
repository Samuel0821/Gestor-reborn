document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("exportExcelBtn")?.addEventListener("click", async () => {
        const res = await window.api.exportInventoryExcel();
        showAlert(res.success ? "success" : "danger", res.message);
    });

    document.getElementById("exportPdfBtn")?.addEventListener("click", async () => {
        const res = await window.api.exportInventoryPDF();
        showAlert(res.success ? "success" : "danger", res.message);
    });

    function formatCOP(value) {
        const num = Number(value) || 0;
        return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            minimumFractionDigits: 0,
        }).format(Math.round(num));
    }

    function showAlert(type, message) {
        let alertDiv = document.getElementById('inventory-alert');
        if (!alertDiv) {
            alertDiv = document.createElement('div');
            alertDiv.id = 'inventory-alert';
            alertDiv.className = 'mt-3';
            document.querySelector('.card').before(alertDiv);
        }
        alertDiv.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
            <i class="fa fa-info-circle me-2"></i>${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>`;
    }

    async function loadProducts() {
    // La función ahora devuelve un objeto con la lista de productos y el valor total
        const { products: fetchedProducts, totalInventoryValue } = await window.api.getInventory();
        products = fetchedProducts;
        renderTable(products);
        
        // Muestra el valor del inventario en la UI
        const totalValueElement = document.getElementById('total-inventory-value');
        if (totalValueElement) {
            totalValueElement.textContent = formatCOP(totalInventoryValue);
        }
    }

    function renderTable(list) {
        table.innerHTML = '';
        list.forEach(p => {
            const tr = document.createElement('tr');
            const stockAlert = (p.stock <= p.min_stock) ? `<span class="badge bg-danger ms-2">Stock mínimo</span>` : '';
            tr.innerHTML = `
                <td>${p.code}</td>
                <td>${p.name}</td>
                <td>${p.sale_price}</td>
                <td>${p.stock} ${stockAlert}</td>
                <td>${p.min_stock || 0}</td>
                <td>
                    <button class="btn btn-sm btn-primary edit" data-id="${p.id}" title="Editar"><i class="fa fa-edit"></i> Editar</button>
                    <button class="btn btn-sm btn-danger del" data-id="${p.id}" title="Eliminar"><i class="fa fa-trash"></i> Eliminar</button>
                </td>
            `;
            table.appendChild(tr);
            tr.querySelector('.edit').addEventListener('click', () => {
                idInput.value = p.id;
                codeInput.value = p.code;
                nameInput.value = p.name;
                categorySelect.value = p.category || '';
                categoryNew.value = '';
                purchaseInput.value = p.purchase_price || 0;
                saleInput.value = p.sale_price || 0;
                document.getElementById('product-special-price').value = p.special_price || 0;
                stockInput.value = p.stock || 0;
                minStockInput.value = p.min_stock || 0;
                cancelBtn.style.display = 'inline-block';
            });
            tr.querySelector('.del').addEventListener('click', async () => {
                if (!confirm('¿Eliminar producto?')) return;
                await window.api.deleteProduct(p.id);
                await loadProducts();
                await loadCategories();
            });
        });
    }

    const form = document.getElementById('product-form');
    const minStockInput = document.getElementById('product-min-stock');
    const idInput = document.getElementById('product-id');
    const codeInput = document.getElementById('product-code');
    const nameInput = document.getElementById('product-name');
    const categorySelect = document.getElementById('product-category');
    const categoryNew = document.getElementById('product-category-new');
    const purchaseInput = document.getElementById('product-purchase-price');
    const saleInput = document.getElementById('product-sale-price');
    const stockInput = document.getElementById('product-stock');
    const cancelBtn = document.getElementById('cancel-product');
    const table = document.getElementById('products-table');
    const search = document.getElementById('search-product');
    const codeErrorMessageSpan = document.getElementById('code-error-message');

    let products = [];

    async function loadCategories() {
        const cats = await window.api.getCategories();
        categorySelect.innerHTML = '<option value="">(Sin categoría)</option>';
        cats.forEach(c => {
            const o = document.createElement('option');
            o.value = c.name;
            o.textContent = c.name;
            categorySelect.appendChild(o);
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        codeErrorMessageSpan.textContent = '';
        const category = categoryNew.value.trim() || categorySelect.value || null;
        const specialPrice = document.getElementById('product-special-price').value;
        const payload = {
            id: idInput.value ? Number(idInput.value) : undefined,
            code: codeInput.value.trim(),
            name: nameInput.value.trim(),
            category,
            purchase_price: parseFloat(purchaseInput.value) || 0,
            sale_price: parseFloat(saleInput.value) || 0,
            special_price: parseFloat(specialPrice) || 0,
            stock: parseInt(stockInput.value, 10) || 0,
            min_stock: parseInt(minStockInput.value, 10) || 0
        };
        if (!payload.code || !payload.name) {
            alert('Código y nombre obligatorios');
            return;
        }
        if (payload.id) {
            const res = await window.api.updateProduct(payload);
            if (!res.success) {
                if (res.message.includes("UNIQUE constraint failed: products.code")) {
                    codeErrorMessageSpan.textContent = 'El código ya existe';
                    return;
                }
                alert(res.message);
                return;
            }
            cancelBtn.style.display = 'none';
        } else {
            const res = await window.api.addProduct(payload);
            if (!res.success) {
                if (res.message.includes("UNIQUE constraint failed: products.code")) {
                    codeErrorMessageSpan.textContent = 'El código ya existe';
                    return;
                }
                alert(res.message);
                return;
            }
        }
        form.reset();
        idInput.value = '';
        await loadProducts();
        await loadCategories();
    });

    cancelBtn.addEventListener('click', () => { form.reset(); idInput.value=''; cancelBtn.style.display='none'; });
    minStockInput.value = '';
    search.addEventListener('input', () => {
        const q = search.value.toLowerCase();
        renderTable(products.filter(p => p.name.toLowerCase().includes(q)));
    });

    loadProducts();
    loadCategories();
});