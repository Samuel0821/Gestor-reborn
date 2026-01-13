# GestorFX - Sistema ERP Profesional

## Descripción General
GestorFX es una solución de software de escritorio robusta y moderna para la gestión integral de negocios (ERP). Desarrollada con **Electron** y **Node.js**, utiliza una arquitectura asíncrona para garantizar un rendimiento fluido y una experiencia de usuario ágil. Todos los procesos de base de datos y generación de archivos se ejecutan en segundo plano sin bloquear la interfaz.

## Características Principales

### 🚀 Arquitectura y Rendimiento
- **Comunicación Asíncrona:** Toda la interacción entre la interfaz (Frontend) y la base de datos (Backend) se realiza mediante `IPC (Inter-Process Communication)` de forma asíncrona (`async/await`), asegurando que la aplicación nunca se congele durante operaciones pesadas.
- **Base de Datos Local:** Utiliza SQLite (`better-sqlite3`) para un almacenamiento rápido, seguro y sin necesidad de servidores externos.
- **Seguridad:** Aislamiento de contexto (`contextIsolation: true`) y precarga segura de APIs.

### 📦 Módulos del Sistema
1.  **Dashboard Interactivo:**
    - Gráficos de ventas en tiempo real (Chart.js).
    - Indicadores clave de rendimiento (KPIs).
    - Alertas automáticas de stock mínimo.
2.  **Punto de Venta (POS):**
    - Facturación rápida con soporte para lector de código de barras.
    - Manejo de variantes de productos (Unidades de medida).
    - Pagos mixtos (Efectivo + Transferencia).
    - Ventas a crédito y gestión de abonos.
3.  **Inventario Avanzado:**
    - Gestión de productos, categorías y proveedores.
    - Control de stock y alertas de reabastecimiento.
    - Exportación de inventario a Excel y PDF.
4.  **Servicios:**
    - Creación de paquetes de servicios (Mano de obra + Insumos).
    - Descuento automático de materiales del inventario al vender un servicio.
5.  **Compras y Proveedores:**
    - Generación de Órdenes de Compra.
    - Recepción de mercancía con actualización automática de stock.
    - Base de datos de proveedores.
6.  **Cotizaciones:**
    - Generación de cotizaciones profesionales en PDF.
    - Conversión de cotización a venta con un solo clic.
7.  **Finanzas y Caja:**
    - Apertura y cierre de caja (Arqueo ciego).
    - Registro de movimientos de efectivo.
    - Reportes de utilidad real (Ventas - Costos).
8.  **Soporte Técnico:**
    - Módulo integrado para envío de reportes de error directamente al desarrollador.

## Estructura del Proyecto
El proyecto sigue una estructura modular clara:

```
database.sqlite
package.json
src/
  database.js
  index.js
  preload.js
  js/
    clients.js
    dashboard.js
    login.js
    products.js
    quotes.js
    report.js
    sales.js
    settings.js
  views/
    clients.html
    index.html
    login.html
    products.html
    quotes.html
    reports.html
    sales.html
    settings.html
```

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
