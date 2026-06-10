# Manual Técnico - GestorFX

**Versión del Sistema:** 1.0.8
**Desarrollado por:** Grisalis Technologies

---

## 1. Información General del Sistema
**Nombre del Software:** GestorFX
**Tipo de Aplicación:** Sistema ERP de Escritorio (Desktop).
**Arquitectura:** Monolítica modular basada en Electron (Chromium + Node.js).
**Base de Datos:** SQLite3 (Local, embebida).
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
15. **services / service_products:** Definición de servicios (incluye `client_id`, `status`, `scheduled_date`, `performed_at`) y recetas de materiales.
16. **service_payments:** Registro de abonos a servicios (relacionado con `services`).
17. **company_settings:** Configuración global (Logo, NIT, Datos de contacto).
18. **audit_logs:** Registro de acciones críticas para auditoría (usuario, acción, detalles, fecha).

## 6. Seguridad

*   **Almacenamiento Local:** Los datos residen exclusivamente en el equipo del usuario, reduciendo riesgos de ataques remotos a servidores.
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