# GestorFX

## Descripción
GestorFX es una aplicación de escritorio multiplataforma (Windows, Linux, macOS) desarrollada con Electron y SQLite, diseñada para la gestión de inventario, ventas, clientes, cotizaciones, reportes y configuración empresarial.

## Características principales
- **Login seguro:** Acceso mediante usuario y contraseña (por defecto: admin / 12345).
- **Inicio de día:** Solicita el valor inicial de caja al iniciar sesión.
- **Gestión de productos:** Registro, edición, eliminación, inventario, stock mínimo, exportación a PDF/Excel.
- **Gestión de clientes:** Registro, edición, eliminación, búsqueda y listado.
- **Gestión de ventas:** Venta rápida, historial, cálculo de totales, facturación.
- **Gestión de cotizaciones:** Creación, historial, exportación.
- **Reportes:** Generación de reportes diarios, semanales y mensuales.
- **Ajustes:** Configuración de datos empresariales y logo.
- **Alertas:** Avisos de productos con stock bajo.
- **Diseño moderno:** Interfaz profesional con Bootstrap y FontAwesome.

## Estructura de carpetas
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
