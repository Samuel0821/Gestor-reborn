# Manual Técnico - GestorFX

**Versión del Sistema:** 1.0.9
**Desarrollado por:** Grisalis Technologies

---

## 1. Información General del Sistema
**Nombre del Software:** GestorFX: Sistema Integral Para Gestionar Inventarios y Puntos De Ventas
**Tipo de Aplicación:** Sistema ERP de Escritorio (Desktop).
**Arquitectura:** Electron con modo local y modo servidor LAN.
**Base de Datos:** SQLite3; en modo LAN, un único proceso servidor mantiene la base en disco local y las estaciones se conectan por HTTPS.
**Licencia:** Propietaria / Comercial.

## 2. Requisitos del Sistema

### Hardware Mínimo
*   **Procesador:** Intel Core i3 (2.0 GHz) o equivalente AMD.
*   **Memoria RAM:** 4 GB (Recomendado 8 GB para reportes grandes).
*   **Almacenamiento:** 500 MB de espacio libre en disco (más espacio para backups).
*   **Pantalla:** Resolución mínima de 1366x768 píxeles.

### Software
*   **Sistema Operativo:** Windows 10/11 (64-bits), macOS o Linux.
*   **Dependencias:** No requiere instalación de servidores externos (SQL Server, Apache, etc.). El entorno de ejecución está autocontenido.

## 3. Stack Tecnológico (Tecnologías Usadas)

El sistema utiliza tecnologías web modernas encapsuladas para ejecutarse como una aplicación nativa de escritorio.

### Core & Backend
*   **[Electron JS](https://www.electronjs.org/):** Framework principal que permite crear aplicaciones de escritorio con tecnologías web. Maneja el proceso principal (`Main Process`) y las ventanas (`Renderer Process`).
*   **Node.js:** Entorno de ejecución para la lógica de negocio, acceso al sistema de archivos y manejo de base de datos.
*   **IPC (Inter-Process Communication):** Comunicación segura entre el frontend y el backend mediante `ipcMain` y `ipcRenderer` (contextBridge).
*   **API LAN:** Adaptador HTTPS para enrutar al servidor las mismas operaciones registradas por IPC. Ver `RED_LOCAL.md` para configuración y límites actuales.

### Frontend (Interfaz de Usuario)
*   **HTML5:** Estructura semántica de las vistas.
*   **CSS3:** Estilos personalizados y diseño responsivo.
*   **JavaScript (Vanilla ES6+):** Lógica del lado del cliente, manipulación del DOM y llamadas a la API expuesta por Electron.
*   **Bootstrap 5:** Framework CSS para componentes UI. Uso extensivo de `datalist` para autocompletado en campos de selección de terceros.
*   **Estilos Dinámicos:** Inyección de CSS en tiempo de ejecución para componentes personalizados (Menús desplegables flotantes, Modo Oscuro).
*   **FontAwesome 6:** Iconografía vectorial.
*   **Chart.js:** Librería para la visualización de datos y gráficos en el Dashboard.

### Base de Datos y Persistencia
*   **better-sqlite3:** Driver de SQLite de alto rendimiento y síncrono, ideal para aplicaciones locales rápidas.
*   **SQLite:** Motor de base de datos relacional serverless. Los datos se almacenan en un único archivo `database.sqlite`.

### Herramientas y Librerías Adicionales
*   **PDFKit:** Generación dinámica de documentos PDF (Facturas, Cotizaciones, Reportes).
*   **ExcelJS:** Exportación de datos a hojas de cálculo (.xlsx).
*   **Electron Forge:** Herramienta para empaquetar y distribuir la aplicación (generación de instaladores .exe, .deb, .rpm).

## 4. Arquitectura y Estructura del Proyecto

La aplicación sigue el patrón de arquitectura de Electron con separación de responsabilidades:

*   **Main Process (`src/index.js`):** Punto de entrada. Gestiona el ciclo de vida de la app, crea ventanas, maneja la base de datos y escucha eventos IPC.
*   **Preload Script (`src/preload.js`):** Puente de seguridad. Expone funciones específicas del backend al frontend mediante `window.api`, manteniendo el aislamiento de contexto (`contextIsolation: true`).
*   **Renderer Process (`src/views/*.html`, `src/js/*.js`):** Interfaz gráfica. Interactúa con el usuario y solicita datos al Main Process.

GESTOR-REBORN/
├── database.sqlite       # Archivo de base de datos (en desarrollo)
├── package.json          # Dependencias y scripts
├── package-lock.json     # Historial de versiones de dependencias
├── forge.config.js       # Configuración del instalador (Electron Forge)
├── .gitignore            # Archivos excluidos de Git
├── DOCUMENTACION.md      # Documentación general del proyecto
├── MANUAL_TECNICO.md     # Guía para desarrolladores
├── MANUAL_USUARIO.md     # Guía para el usuario final
├── npm-install.log       # Registro de instalación de módulos
├── node_modules/         # Módulos y librerías de Node.js
├── src/
│   ├── index.js          # Proceso Principal (Backend)
│   ├── database.js       # Lógica de base de datos y esquemas
│   ├── preload.js        # Puente seguro (ContextBridge API)
│   ├── cashRegister.js   # Lógica de control de caja
│   ├── styles.css        # Estilos globales de la aplicación
│   ├── js/               # Lógica del Frontend (Módulos JS)
│   │   ├── cash_register.js
│   │   ├── clients.js
│   │   ├── dashboard.js
│   │   ├── expenses.js
│   │   ├── layout.js
│   │   ├── login.js
│   │   ├── price_lookup.js
│   │   ├── products.js
│   │   ├── purchase_orders.js
│   │   ├── quotes.js
│   │   ├── report.js
│   │   ├── sales.js
│   │   ├── services.js
│   │   ├── settings.js
│   │   ├── suppliers.js
│   │   └── support.js
│   ├── views/            # Vistas HTML (Interfaces)
│   │   ├── cash_register.html
│   │   ├── clients.html
│   │   ├── expenses.html
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── products.html
│   │   ├── purchase_orders.html
│   │   ├── quotes.html
│   │   ├── reports.html
│   │   ├── sales.html
│   │   ├── services.html
│   │   ├── settings.html
│   │   ├── suppliers.html
│   │   └── support.html
│   └── logo/             # Recursos gráficos (Dentro de src)
│       ├── gestorfx_logo.png
│       └── gestorfx_logof.ico

---
```

## 5. Esquema de Base de Datos
## Cambios técnicos recientes (v1.0.10)

- Caja / Resumen:
    - Se añadió emisión IPC (`cash-data-updated`) desde el proceso principal al cargar la ventana para notificar al renderer sobre la sesión activa.
    - El renderer ahora reintenta la carga de la sesión activa al inicio y al recuperar foco/visibilidad para evitar condiciones de carrera.
- Consultas y reportes:
    - `getSalesForSession` fue ajustada para excluir `sale_type` = 'credit' y 'paid' en la lista de ventas del turno.
    - `session_amount` ahora suma únicamente `cash_movements` con `sub_type` relacionados a la venta (`sale_cash`, `sale_transfer`), evitando sumar abonos a servicios.
- Pagos y créditos:
    - `getCreditPaymentsForSession` devuelve primero movimientos de caja y luego pagos en `sale_payments` que no tengan movimiento asociado (evita duplicados).
    - `markCreditAsPaid` registra el pago restante y agrega movimiento de caja en la sesión activa.
- Servicios:
    - `createSale` marca todos los `service_id` encontrados en los items como `Finalizado` al facturar servicios.


El sistema utiliza un modelo relacional robusto. Las tablas principales son:

1.  **users:** Autenticación (username, password_hash SHA-256, role).
2.  **products:** Inventario maestro (código, costo, `sale_price`, `special_price`, `special_price_2`, stock, stock mínimo).
3.  **product_variants:** Unidades de medida alternativas para productos. Incluye `purchase_price` y su propio set de precios (`sale_price`, `special_price`, `special_price_2`).
4.  **categories:** Categorización de productos.
5.  **clients:** Base de datos de clientes.
6.  **suppliers:** Base de datos de proveedores.
7.  **sales:** Cabecera de ventas (total, fecha, cliente, tipo de pago, estado de crédito, `receipt_number`, `notes`).
8.  **sale_items:** Detalle de productos vendidos (incluye `variant_id`, `conversion_factor`, `serial_number` y `skip_stock`).
9.  **sale_payments:** Desglose de métodos de pago (efectivo, transferencia, referencia bancaria, fecha real de ingreso).
10. **cash_register_sessions:** Control de turnos de caja (apertura/cierre).
11. **cash_movements:** Auditoría de movimientos de dinero en caja.
12. **quotes / quote_items:** Gestión de cotizaciones con soporte para `notes` y `status`. `quote_items` incluye `variant_id` y `skip_stock`.
13. **purchase_orders / purchase_order_items:** Gestión de compras. `purchase_orders` incluye `include_iva` y `due_date`.
14. **purchase_payments:** Registro de pagos a proveedores con soporte para `retention_amount` y `retention_type`.
15. **services / service_items / service_products:** Definición de servicios (incluye `client_id`, `status`, `scheduled_date`, `performed_at`), trabajos con nombre, cantidad y precio unitario, y materiales. La migración 14 convierte cada servicio existente en un trabajo de cantidad 1. `services.price` conserva el subtotal agregado de mano de obra, calculado en el backend, para mantener compatibles abonos y reportes.
16. **service_payments:** Registro de abonos a servicios (relacionado con `services`).
    - La migración 15 agrega `service_id` y `service_item_id` a `quote_items` y `sale_items`. La creación/edición de cotizaciones y la creación de ventas sincronizan cantidad, precio y subtotal de mano de obra dentro de la misma transacción del documento. Se valida que cada trabajo pertenezca al servicio y que este no esté anulado ni finalizado. El envío al formulario no cambia el estado del servicio.
17. **company_settings:** Configuración global (Logo, NIT, Datos de contacto).
18. **audit_logs:** Registro de acciones críticas para auditoría (usuario, acción, detalles, fecha).

## 6. Seguridad

*   **Almacenamiento:** En modo local, la base reside en el equipo. En modo LAN, las estaciones no abren SQLite; solo el proceso servidor lo usa y crea respaldos diarios consistentes.
*   **Hashing de Contraseñas:** Las contraseñas de usuario se almacenan cifradas utilizando el algoritmo **SHA-256**.
*   **Roles de Usuario:**
    *   **Admin:** Acceso total a configuración, usuarios y eliminación de registros.
    *   **User:** Acceso restringido a operaciones diarias (ventas, clientes).
*   **Validación de Caja:** El sistema obliga a declarar un valor inicial y realiza un cierre ciego (comparando lo esperado vs lo real).

## 7. Desarrollo e Instalación

### Prerrequisitos
*   Node.js (v16 o superior)
*   NPM (Node Package Manager)

### Comandos Principales
1.  **Instalar dependencias:**
    ```bash
    npm install
    ```
2.  **Ejecutar en modo desarrollo:**
    ```bash
    npm start
    ```
3.  **Generar ejecutable (Producción):**
    ```bash
    npm run make
    ```
    Esto generará el instalador en la carpeta `out/make/`.

---
**Documentación generada para:** Grisalis Technologies

## Industria Panadería: producción y costos históricos

- Migración 16: registro `PANADERIA`, relaciones de catálogo y tablas `bakery_settings`, `bakery_permissions`, `bakery_items`, `bakery_recipes`, `bakery_documents`, `bakery_lots`, `bakery_lot_movements`, `bakery_audit`, `bakery_sale_events`, `bakery_sale_lines` y `bakery_sale_requests`. Agrega `sale_items.bakery_cost_total`. Las migraciones se respaldan mediante `VACUUM INTO`, incluyendo las páginas confirmadas en WAL.
- Dominio: `src/bakery.js`, inicializado por `src/database.js`. Comprueba el perfil antes de cada operación. El inventario normalizado se mantiene en `products.stock`; las asignaciones a lotes y los costos reales se registran dentro de la misma transacción del movimiento existente. No se modifica la estrategia de inventario de otras industrias.
- Transporte: canal `bakery`, expuesto en preload y registrado mediante el mismo registro de operaciones de IPC y API LAN. El servidor local conserva la base única. La comprobación de responsabilidades lee el usuario y sus permisos actuales; no confía en el rol ni en un identificador enviados por el cliente.
- Responsabilidades: administrador con acceso completo; usuarios con una o varias áreas `inventory`, `production`, `sales`, `reports`. Menús y respuestas con costos se filtran según el acceso. Se invalida la sesión en logout. Los borradores de producción se separan por instalación/usuario y los de cotización/ventas por usuario para Panadería.
- Producción: recetas versionadas; borradores con revisión optimista; confirmación atómica de ingredientes, otros costos y varios productos obtenidos. Las proporciones de costo son pesos relativos positivos. Los identificadores de operación evitan duplicar confirmaciones y recepciones al reintentar.
- Costeo: consumo por vencimiento entre lotes vigentes; instantánea de costo por línea vendida y eventos de venta/reversión. La cantidad del reporte se normaliza con el factor original de la presentación. Una anulación usa el factor y los lotes históricos, aunque las presentaciones se modifiquen posteriormente.
- Productos: la edición de existencias registra movimientos de corrección y conserva el balance con los lotes; la revalorización de costos actualiza solo lotes disponibles y no modifica asignaciones históricas de ventas.
- Reportes: día, semana de lunes a domingo, quincenas civiles y mes. Las compras no se restan nuevamente de la utilidad. Las asignaciones de gastos se reclasifican al costo de producción y se revierten con trazabilidad; los costos sin gasto asociado son estimados. Se muestra resultado operativo según datos registrados, no una utilidad neta que suponga costos e impuestos desconocidos. La valorización de inventario es actual, no una reconstrucción al cierre del rango.
- Migración 17: medidas, lote y vencimiento en líneas de compra; sincronización de atributos anteriores con el catálogo compartido. `bakery_items.attributes._ui` conserva la medida de captura y la del mínimo; el inventario continúa normalizado en gramos, mililitros o unidades.
- Interfaz integrada: `production.html` y `production.js` contienen únicamente recetas y producción. `bakeryProducts.js` adapta Productos, `bakeryPurchases.js` adapta Órdenes de Compra y `bakeryModules.js` integra Gastos, Reportes y responsabilidades en Ajustes. Los accesos antiguos a `bakery.html` redirigen a producción. Las adaptaciones comprueban `PANADERIA`; las demás industrias mantienen sus formularios. El manual operativo está en `MANUAL_PANADERIA.md`.
- Recetas y producción usa dos pestañas con formularios independientes: receta (descripción e insumos de referencia, con cantidades opcionales) y producción (consumo real, cantidades buenas, desperdicio e historial). `resolveOutputProducts` reutiliza elaborados por nombre normalizado o crea fichas con stock cero dentro de la transacción. Solo la confirmación suma cantidades y consume insumos. El permiso de producción permite esta creación interna de elaborados, sin otorgar acceso general a modificar inventario. Las nuevas producciones no capturan gastos adicionales; los borradores históricos conservan sus costos y los muestran explícitamente antes de confirmar.

Pruebas sin modificar la base del negocio:

```powershell
npm run test:bakery
npm run test:bakery:ui
```

El primer comando usa el SQLite nativo de Electron sobre bases temporales y verifica también regresiones de servicios y cotizaciones. El segundo ejecuta una ventana oculta de Electron con perfil temporal, verifica los formularios y el aislamiento entre usuarios. Los lanzadores pasan `ELECTRON_RUN_AS_NODE` solo al proceso de prueba que lo necesita y no dejan esa variable en la terminal.
