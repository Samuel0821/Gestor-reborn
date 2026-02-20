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
    - **Gestión Operativa:** Widgets para visualizar Servicios Programados pendientes y Borradores de servicios abiertos.
    - Alertas automáticas de stock mínimo.
2.  **Punto de Venta (POS):**
    - Facturación rápida con soporte para lector de código de barras.
    - Manejo de variantes de productos (Unidades de medida) con precios y costos específicos.
    - **Precios Múltiples:** Selección de 3 listas de precios (Normal, Especial 1, Especial 2).
    - Pagos mixtos (Efectivo + Transferencia).
    - Ventas a crédito y gestión de abonos.
    - **Recibos de Caja:** Generación de comprobantes de ingreso numerados y exportables a PDF.
    - **Edición de Facturas:** Permite modificar ventas existentes recalculando inventario y saldos automáticamente.
3.  **Inventario Avanzado:**
    - Gestión de productos, categorías y proveedores.
    - **Cálculo de Precios:** Lógica bidireccional automática (Margen % <-> Precio Venta). Soporte para decimales en stock y precios.
    - **Variantes de Producto:** Soporte para múltiples presentaciones (ej. Kilo, Bulto) con factor de conversión y costo de compra individual.
    - Control de stock y alertas de reabastecimiento.
    - Exportación de inventario a Excel y PDF.
4.  **Servicios:**
    - Creación de paquetes de servicios (Mano de obra + Insumos).
    - **Ciclo de Vida:** Estados (Abierto, Cotizado, Finalizado, Anulado) y Ejecución (Pendiente, Realizado).
    - **Programación:** Asignación de fecha programada y control de realización operativa.
    - **Abonos:** Registro de pagos parciales (anticipos) que impactan caja y se descuentan al facturar.
    - **Soporte de Variantes:** Los materiales asociados pueden ser variantes específicas, calculando el costo y precio correctamente.
    - Vinculación de clientes a las órdenes de servicio.
    - Descuento automático de materiales del inventario al guardar un servicio (Gestión inteligente para evitar doble descuento al facturar).
5.  **Compras y Proveedores:**
    - Generación de Órdenes de Compra.
    - Soporte para **IVA Opcional** y **Fecha de Vencimiento** en compras.
    - Edición de órdenes de compra pendientes.
    - Recepción de mercancía con actualización automática de stock.
    - Gestión de pagos a proveedores con aplicación de **Retenciones en la Fuente**.
    - Base de datos de proveedores.
6.  **Cotizaciones:**
    - Generación de cotizaciones profesionales en PDF.
    - Persistencia de datos (guardado automático al cambiar de pantalla).
    - Edición de cotizaciones existentes respetando variantes seleccionadas.
    - Conversión de cotización a venta con validación de stock (conversión automática de unidades) y gestión de pagos.
7.  **Finanzas y Caja:**
    - Apertura y cierre de caja (Arqueo ciego).
    - Registro de movimientos de efectivo.
    - Reportes de utilidad real (Ventas - Costos).
    - **Gestión de Gastos:** Registro, visualización de detalles y generación de Comprobantes de Egreso en PDF.
    - **Reporte de Egresos:** Control detallado de gastos con exportación a PDF.
    - **Reporte de Retenciones:** Informe para la DIAN con el detalle de retenciones aplicadas en compras.
    - **Auditoría:** Registro de modificaciones sensibles (ej. edición de ventas).
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
    expenses.js
    login.js
    products.js
    purchase_orders.js
    quotes.js
    report.js
    sales.js
    services.js
    settings.js
    suppliers.js
    support.js
  views/
    clients.html
    expenses.html
    index.html
    login.html
    products.html
    purchase_orders.html
    quotes.html
    reports.html
    sales.html
    services.html
    settings.html
    suppliers.html
    support.html
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
