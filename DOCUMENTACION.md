# GestorFX - Sistema ERP Profesional

## Descripción General
GestorFX es una solución de software de escritorio robusta y moderna para la gestión integral de negocios (ERP). Desarrollada con **Electron** y **Node.js**, utiliza una arquitectura asíncrona para garantizar un rendimiento fluido y una experiencia de usuario ágil. El sistema está optimizado para el comercio minorista y de servicios, con un fuerte enfoque en la precisión del inventario y la trazabilidad financiera.

## Características Principales

### 🚀 Arquitectura y Rendimiento
- **Comunicación Asíncrona:** Toda la interacción entre la interfaz (Frontend) y la base de datos (Backend) se realiza mediante `IPC (Inter-Process Communication)` de forma asíncrona (`async/await`), asegurando que la aplicación nunca se congele durante operaciones pesadas.
- **Base de Datos Local:** Utiliza SQLite (`better-sqlite3`) para un almacenamiento rápido, seguro y sin necesidad de servidores externos.
- **Seguridad:** Aislamiento de contexto (`contextIsolation: true`) y precarga segura de APIs.

### 📦 Módulos del Sistema
1.  **Dashboard Interactivo:**
    - **Estadísticas Avanzadas:** Análisis de utilidad bruta (Ventas - Costos), top 5 productos más vendidos y desglose de métodos de pago.
    - **Centro de Alertas:** Notificaciones de stock mínimo, órdenes de compra pendientes, deudores de crédito y cuentas por pagar vencidas.
    - **Gestión Operativa:** Widgets en tiempo real para servicios programados y borradores de trabajo.
    - **Actividad Reciente:** Historial rápido de las últimas transacciones y modificaciones.
2.  **Punto de Venta (POS):**
    - Facturación rápida con soporte para lector de código de barras.
    - Manejo de variantes de productos (Unidades de medida) con precios y costos específicos.
    - **Precios Múltiples:** Selección de 3 listas de precios (Normal, Especial 1, Especial 2).
    - Pagos mixtos (Efectivo + Transferencia).
    - Ventas a crédito y gestión de abonos.
    - **Recibos de Caja Oficiales:** Generación de comprobantes de ingreso con valor en letras y detalles de saldo.
    - **Edición Avanzada:** Modificación de facturas existentes con ajuste automático de stock y conciliación financiera (pagos adicionales o egresos por devolución).
    - **Anulación Protegida:** Permite anular ventas restaurando el stock y dejando rastro en auditoría.
3.  **Inventario Avanzado:**
    - **Variantes Pro:** Cada presentación (Bulto, Caja, Unidad) tiene su propio costo de compra y 3 niveles de precios de venta.
    - **Gestión de Costos:** Cálculo de utilidad basado en el costo específico de la variante vendida para reportes financieros precisos.
    - **Trazabilidad:** Control de números de serial para garantías.
    - Exportación de inventario a Excel y PDF.
4.  **Servicios:**
    - **Gestión de Anticipos:** Los abonos a servicios impactan la caja del día y se reflejan como pagos previos al facturar.
    - **Ciclo Operativo:** Control de fechas programadas y registro de "Realizado" con marca de tiempo.
    - **Integración POS:** Conversión directa de servicios a Venta o Cotización con un solo clic, evitando la doble deducción de stock.
5.  **Compras y Proveedores:**
    - **Contabilidad de Compras:** Manejo de IVA (19%) opcional, descuentos comerciales y fechas de vencimiento.
    - **Retenciones DIAN:** Aplicación de retenciones en la fuente (Compras, Servicios, Honorarios) al registrar pagos a proveedores.
    - **Cuentas por Pagar:** Seguimiento de saldos pendientes con historial de pagos y generación de Comprobantes de Egreso.
6.  **Cotizaciones:**
    - **Validación Pre-Venta:** Al aprobar una cotización, el sistema valida el stock real actual antes de permitir la conversión a factura.
    - **Borradores:** Persistencia automática del carrito para evitar pérdida de datos.
7.  **Finanzas y Caja:**
    - **Cierre de Caja Detallado:** Arqueo por denominaciones de billetes/monedas con cálculo de diferencias.
    - **Reportes Contables:** Utilidad Neta Real (Ingresos - Costos - Gastos), Reporte de Retenciones (DIAN) y Reporte de Egresos Detallado.
    - **Auditoría de Sistema:** Registro log de todas las modificaciones críticas realizadas por los usuarios.
8.  **Soporte Técnico:**
    - Envío de tickets de soporte directamente desde la aplicación.

## GESTOR-REBORN/ ESTRUCTURA DEL PROYECTO

├── .gitignore                # Archivos y carpetas omitidos por Git
├── database.sqlite           # Base de datos local (SQLite)
├── DOCUMENTACION.md          # Documentación técnica general
├── forge.config.js           # Configuración de empaquetado (Electron Forge)
├── MANUAL_TECNICO.md         # Manual para desarrolladores
├── MANUAL_USUARIO.md         # Manual para el cliente/usuario
├── node_modules/             # Dependencias del proyecto
├── npm-install.log           # Registro de instalación de dependencias
├── package.json              # Metadatos y scripts del proyecto
├── package-lock.json         # Versiones exactas de dependencias
└── src/                      # Código fuente de la aplicación
    ├── cashRegister.js       # Lógica principal de operaciones de caja
    ├── database.js           # Configuración y conexión a la DB
    ├── index.js              # Punto de entrada (Proceso Principal)
    ├── preload.js            # Script de pre-carga (Seguridad/API)
    ├── styles.css            # Estilos CSS globales
    ├── js/                   # Lógica modular del Frontend
    │   ├── cash_register.js
    │   ├── clients.js
    │   ├── dashboard.js
    │   ├── expenses.js
    │   ├── layout.js
    │   ├── login.js
    │   ├── price_lookup.js
    │   ├── products.js
    │   ├── purchase_orders.js
    │   ├── quotes.js
    │   ├── report.js
    │   ├── sales.js
    │   ├── services.js
    │   ├── settings.js
    │   ├── suppliers.js
    │   └── support.js
    ├── logo/                 # Recursos gráficos y multimedia
    │   ├── gestorfx_logo.png
    │   └── gestorfx_logof.ico
    └── views/                # Interfaces de usuario (HTML)
        ├── cash_register.html
        ├── clients.html
        ├── expenses.html
        ├── index.html
        ├── login.html
        ├── products.html
        ├── purchase_orders.html
        ├── quotes.html
        ├── reports.html
        ├── sales.html
        ├── services.html
        ├── settings.html
        ├── suppliers.html
        └── support.html

---


## Instalación y ejecución
1. Instala Node.js (https://nodejs.org/)
2. Instala dependencias:
   ```
   npm install
   ```
3. Ejecuta la aplicación:
   ```
   npm start
   ```

## Empaquetado para distribución
Recomendado usar [Electron Forge](https://www.electronforge.io/) o [Electron Builder](https://www.electron.build/):
1. Instala Electron Forge:
   ```
   npm install --save-dev @electron-forge/cli
   npx electron-forge import
   ```
2. Empaqueta:
   ```
   npm run make
   ```
   Los instaladores se generan en la carpeta `out/`.

## Usuario y contraseña por defecto
- **Usuario:** admin
- **Contraseña:** 12345

## Notas de seguridad
- Cambia el usuario/contraseña en producción.
- El valor inicial del día se guarda en localStorage.

## Contacto y soporte
Para soporte, mejoras o reportes de errores, contacta al desarrollador (Samuel Grisales - 3113449097).
