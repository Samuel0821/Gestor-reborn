/**
 * GestorFX - Módulo de Consulta de Precios Global
 * Permite verificar precios de productos y variantes desde cualquier pantalla.
 */

(function() {
    const initPriceLookup = () => {
        // 1. Inyectar Estilos (Soporte para diseño actual y Modo Oscuro)
        const styles = document.createElement('style');
        styles.innerHTML = `
            .price-lookup-trigger {
                position: fixed;
                bottom: 25px;
                left: 25px;
                width: 45px;
                height: 45px;
                border-radius: 50%;
                background: linear-gradient(135deg, #0d6efd, #0a58ca);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 2000;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .price-lookup-trigger:hover { transform: scale(1.1) rotate(10deg); }
            
            .lookup-suggestion-item {
                cursor: pointer;
                transition: all 0.2s;
            }
            .lookup-suggestion-item:hover { background-color: #f8f9fa; padding-left: 20px; border-left: 4px solid #0d6efd; }
            body.dark-mode .lookup-suggestion-item { background-color: #1e293b; color: #c9d1d9; border-color: #444c56; }
            body.dark-mode .lookup-suggestion-item:hover { background-color: #2d333b; color: #fff; border-left-color: #0d6efd; }
            
            #lookup-detail-view { margin-top: 20px; }

            #lookup-results .lookup-card {
                border-radius: 12px;
                border: 1px solid #e1e4e8;
                padding: 15px;
                margin-bottom: 12px;
                background-color: #ffffff;
                transition: border-color 0.2s;
            }
            
            body.dark-mode #lookup-results .lookup-card {
                background-color: #2d333b;
                border-color: #444c56;
                color: #c9d1d9;
            }

            .lookup-variant-badge {
                background-color: #f0f2f5;
                border-radius: 6px;
                padding: 6px 10px;
                margin-top: 8px;
                font-size: 0.85rem;
                transition: transform 0.2s;
            }
            .lookup-variant-badge:hover { transform: translateX(5px); background-color: #e9ecef; }
            
            body.dark-mode .lookup-variant-badge { background-color: #22272e; }
            body.dark-mode .lookup-variant-badge:hover { background-color: #2d333b; }
            
            .text-price { font-weight: 700; color: #198754; }
            body.dark-mode .text-price { color: #3fb950; }

            #clear-lookup-btn {
                cursor: pointer;
                border-left: none;
                background: white;
            }
            body.dark-mode #clear-lookup-btn { background-color: #0d1117; color: #c9d1d9; border-color: #444c56; }
        `;
        document.head.appendChild(styles);

        // 2. Inyectar HTML del Modal y Botón Flotante
        const modalHtml = `
        <div class="modal fade" id="priceLookupModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content shadow-lg border-0" style="border-radius: 15px;">
                    <div class="modal-header bg-primary text-white border-0">
                        <h5 class="modal-title fw-bold"><i class="fas fa-search-dollar me-2"></i>Consulta Rápida de Precios</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-4">
                        <div class="input-group input-group-lg mb-4 shadow-sm">
                            <span class="input-group-text bg-white border-end-0"><i class="fas fa-search text-muted"></i></span>
                            <input type="text" id="lookup-query" class="form-control border-start-0 border-end-0 ps-0" placeholder="Buscar por nombre o código..." autocomplete="off">
                            <span class="input-group-text border-start-0" id="clear-lookup-btn" title="Limpiar"><i class="fas fa-times-circle text-muted"></i></span>
                        </div>
                        <div id="lookup-results-list">
                            <div class="text-center py-5">
                                <i class="fas fa-tag fa-3x text-light mb-3"></i>
                                <p class="text-muted">Escribe el nombre de un producto para ver sus precios y variantes</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer bg-light border-0 py-2">
                        <small class="text-muted">Atajo: <kbd>Ctrl + B</kbd></small>
                    </div>
                </div>
            </div>
        </div>
        <div class="price-lookup-trigger" id="open-lookup-btn" title="Consultar Precios (Ctrl+B)">
            <i class="fas fa-search-dollar fa-lg"></i>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 3. Lógica Funcional
        let modal;
        try {
            // Intentar inicializar, pero no morir si bootstrap no está listo
            if (typeof bootstrap !== 'undefined') {
                modal = new bootstrap.Modal(document.getElementById('priceLookupModal'));
            }
        } catch (e) { console.warn("Price Lookup: Esperando a Bootstrap..."); }

        const input = document.getElementById('lookup-query');
        const container = document.getElementById('lookup-results-list');
        const formatCOP = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n || 0);

        let allProductsCache = [];

        async function refreshCache() {
            allProductsCache = await window.api.getProducts();
        }

        async function handleSearch() {
            const q = input.value.trim().toLowerCase();
            if (q.length < 2) {
                container.innerHTML = `<div class="text-center py-5">
                    <i class="fas fa-tag fa-3x text-light mb-3"></i>
                    <p class="text-muted">Escribe el nombre de un producto para ver sus precios y variantes</p>
                </div>`;
                return;
            }

            if (allProductsCache.length === 0) await refreshCache();
            const results = allProductsCache.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)).slice(0, 10);

            if (results.length === 0) {
                container.innerHTML = `<div class="alert alert-warning text-center">No se encontraron productos coincidentes.</div>`;
                return;
            }

            container.innerHTML = `
                <div class="list-group mb-3 shadow-sm border rounded">
                    ${results.map(p => `
                        <div class="list-group-item list-group-item-action lookup-suggestion-item" data-id="${p.id}">
                            <div class="d-flex justify-content-between align-items-center">
                                <span><strong>${p.name}</strong> <small class="text-muted ms-2">[${p.code}]</small></span>
                                <i class="fas fa-chevron-right text-primary small"></i>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div id="lookup-detail-view"></div>
            `;

            // Listener para seleccionar producto de la lista
            container.querySelectorAll('.lookup-suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    const pid = parseInt(item.dataset.id);
                    const prod = results.find(p => p.id === pid);
                    renderPriceDetail(prod);
                });
            });
        }

        function renderPriceDetail(p) {
            const detailView = document.getElementById('lookup-detail-view');
            detailView.innerHTML = `
                <div class="lookup-card shadow-lg border-primary">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="mb-0 fw-bold text-primary">${p.name} <small class="text-muted ms-1">[${p.code}]</small></h5>
                        <span class="badge bg-success">Stock: ${p.stock}</span>
                    </div>
                    <div class="row g-3 mb-3 text-center">
                        <div class="col-4 border-end"> <small class="text-muted d-block text-uppercase fw-bold" style="font-size:0.65rem;">Normal</small> <span class="text-price fs-5">${formatCOP(p.sale_price)}</span> </div>
                        <div class="col-4 border-end"> <small class="text-muted d-block text-uppercase fw-bold" style="font-size:0.65rem;">Especial 1</small> <span class="text-price text-info fs-5">${formatCOP(p.special_price)}</span> </div>
                        <div class="col-4"> <small class="text-muted d-block text-uppercase fw-bold" style="font-size:0.65rem;">Especial 2</small> <span class="text-price text-warning fs-5">${formatCOP(p.special_price_2)}</span> </div>
                    </div>
                    ${p.variants && p.variants.length > 0 ? `
                        <div class="mt-4 pt-3 border-top">
                            <small class="text-uppercase fw-bold text-muted d-block mb-2" style="font-size: 0.75rem;">Presentaciones / Variantes:</small>
                            ${p.variants.map(v => `
                                <div class="lookup-variant-badge d-flex justify-content-between">
                                    <span class="fw-bold">${v.name} <small class="text-muted ms-1">(x${v.conversion_factor})</small></span>
                                    <div class="d-flex gap-3">
                                        <span class="text-price" title="Normal">${formatCOP(v.sale_price)}</span>
                                        <span class="text-info" title="Esp 1">${formatCOP(v.special_price)}</span>
                                        <span class="text-warning" title="Esp 2">${formatCOP(v.special_price_2)}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        input.addEventListener('input', handleSearch);
        document.getElementById('clear-lookup-btn').addEventListener('click', () => {
            input.value = '';
            input.focus();
            handleSearch();
        });

        // Función segura para mostrar el modal
        const showModal = () => {
            if (!modal && typeof bootstrap !== 'undefined') {
                modal = new bootstrap.Modal(document.getElementById('priceLookupModal'));
            }
            if (modal) modal.show();
        };

        document.getElementById('open-lookup-btn').addEventListener('click', showModal);
        document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key.toLowerCase() === 'b') { e.preventDefault(); showModal(); }});
        document.getElementById('priceLookupModal').addEventListener('shown.bs.modal', () => { refreshCache(); input.focus(); if(input.value) handleSearch(); });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPriceLookup);
    else initPriceLookup();
})();