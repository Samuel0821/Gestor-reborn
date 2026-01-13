# Manual de Usuario - GestorFX

**Versión del Sistema:** 1.0.1   
**Desarrollado por:** Grisalis Technologies

---

## 1. Introducción
GestorFX es un sistema de gestión empresarial (ERP) integral diseñado para optimizar la administración de su negocio. Esta plataforma le permite controlar inventarios, ventas, servicios, créditos, compras y facturación desde una interfaz moderna y fácil de usar.

---

## 2. Acceso y Apertura de Caja

### 2.1. Iniciar Sesión
Al abrir la aplicación, encontrará la pantalla de acceso.
*   **Usuario:** Ingrese su nombre de usuario asignado (por defecto: `admin`).
*   **Contraseña:** Ingrese su clave de seguridad (por defecto: `12345`).
*   Haga clic en **"Ingresar"**.

### 2.2. Valor Inicial del Día
Por seguridad y control financiero, el sistema le solicitará ingresar el **Valor Inicial del Día** cada vez que inicie sesión.
*   Ingrese la cantidad de dinero en efectivo con la que abre la caja (base).
*   Esto es fundamental para el cuadre de caja al final del día.

---

## 3. Panel de Control (Dashboard)
Es la pantalla principal que ofrece una visión global del estado de su negocio en tiempo real.

*   **Tarjetas Informativas:** Visualice rápidamente el total de Clientes, Productos, Proveedores, Ventas del día, Cotizaciones, Servicios y Órdenes de Compra.
*   **Gráfico de Rendimiento:** Un gráfico interactivo muestra la tendencia de ventas de los últimos 7 días.
*   **Alertas de Stock:** Si algún producto está por debajo del stock mínimo, aparecerá una alerta roja con la lista de artículos que necesitan reabastecimiento urgente. Puede descargar esta lista en PDF directamente desde la alerta.
*   **Menú Lateral:** Navegación rápida a todos los módulos del sistema. Puede colapsar este menú usando el botón de hamburguesa (☰) en la parte superior izquierda.

---

## 4. Módulo de Ventas (Punto de Venta)
El corazón del sistema para facturación rápida y eficiente.

### 4.1. Realizar una Venta
1.  **Agregar Productos:**
    *   **Escáner:** Use su lector de código de barras en el campo "Escanear / Ingresar código". Si el producto existe, se abrirá una vista previa para confirmar cantidad. Si no existe, el sistema le preguntará si desea crearlo.
    *   **Búsqueda Manual:** Escriba el nombre o código en el campo "Producto" y selecciónelo de la lista desplegable.
    *   **Variantes:** Si el producto tiene presentaciones (ej. "Bulto" vs "Kilo"), el sistema le pedirá seleccionar cuál desea vender.
2.  **Seleccionar Cliente:** Elija un cliente de la lista o déjelo en blanco para "Cliente General".
3.  **Ajustar Precios:** En la tabla de ítems, puede cambiar entre "Precio Normal" y "Precio Especial" si el producto lo permite.
4.  **Finalizar:** Verifique el total y haga clic en **"Finalizar Venta" (F9)**.

### 4.2. Procesar Pago
Al finalizar, se abrirá una ventana de pago:
*   **Tipo de Venta:** Contado o Crédito.
*   **Métodos de Pago:** Ingrese cuánto recibe en **Efectivo** y/o **Transferencia**. El sistema soporta pagos mixtos.
*   **Cambio:** El sistema calculará automáticamente el dinero a devolver al cliente.

### 4.3. Historial de Facturas
Debajo del área de venta verá las últimas transacciones.
*   **Descargar PDF:** Genera la factura digital.
*   **Imprimir:** Envía la factura a la impresora térmica o láser configurada.
*   **Eliminar:** (Solo Administrador) Permite anular una venta, devolviendo automáticamente los productos al inventario.

### 4.4. Gestión de Créditos
En la pestaña lateral o sección inferior, puede ver las ventas a crédito pendientes.
*   **Abonar:** Registre pagos parciales a una deuda.
*   **Historial:** Vea el saldo pendiente y el total abonado por cliente.

---

## 5. Módulo de Productos (Inventario)
Administre todo su catálogo de artículos.

*   **Crear Producto:** Ingrese Código, Nombre, Categoría, Costo, Precio de Venta y Stock.
*   **Variantes (Unidades de Medida):** Ahora puede vender un mismo producto en diferentes presentaciones (ej. Unidad, Caja, Metro) con precios y factores de conversión distintos.
*   **Stock Mínimo:** Defina una cantidad mínima para que el sistema le avise cuándo reabastecer.
*   **Exportar:** Botones para descargar su inventario completo en **Excel** o **PDF**.

---

## 6. Módulo de Servicios
Ideal para negocios que ofrecen mano de obra, reparaciones o paquetes.

*   **Crear Servicio:** Defina el nombre del servicio (ej. "Mantenimiento PC") y su precio de mano de obra.
*   **Asociar Materiales:** Puede vincular productos del inventario al servicio (ej. "Pasta térmica"). Al vender el servicio, estos productos se descontarán automáticamente del stock.
*   **Acciones Rápidas:** Desde la lista de servicios puede enviarlos directamente a la pantalla de **Ventas** o **Cotizaciones** con un solo clic.

---

## 7. Módulo de Cotizaciones
Genere propuestas comerciales profesionales sin descontar inventario.

*   **Crear:** Seleccione cliente y productos igual que en una venta.
*   **Exportar:** Genere un PDF formal con el logo de su empresa para enviar al cliente.
*   **Aprobar:** Cuando el cliente acepte, haga clic en "Aprobar". La cotización se convertirá automáticamente en una Venta real y se descontará el inventario.

---

## 8. Módulo de Órdenes de Compra
Controle el reabastecimiento con sus proveedores.

*   **Generar Orden:** Seleccione el proveedor y agregue los productos que desea pedir, con sus costos de compra.
*   **Estado:** Las órdenes se crean en estado "Pendiente".
*   **Recibir Mercancía:** Cuando llegue el pedido físico, ingrese a la orden y haga clic en el botón de recibir. Esto **sumará automáticamente** las cantidades al stock de sus productos.

---

## 9. Clientes y Proveedores
Bases de datos para gestionar la información de contacto de sus terceros.

*   **Clientes:** Historial de compras, datos de contacto y NIT/Cédula para facturación.
*   **Proveedores:** Gestión de datos para órdenes de compra.

---

## 10. Reportes y Estadísticas
Analice la salud financiera de su negocio.

*   **Generar Reporte:** Seleccione un rango de fechas y el tipo (Diario, Semanal, Mensual).
*   **Información Detallada:**
    *   Total vendido.
    *   **Utilidad Real:** (Precio Venta - Precio Compra).
    *   Desglose por medios de pago (Efectivo vs Transferencia).
*   **Exportar:** Descargue el reporte detallado en PDF para su contabilidad.

---

## 11. Configuración (Ajustes)
Personalice el sistema a su medida.

*   **Datos de Empresa:** Configure Nombre, NIT, Dirección, Teléfono y cargue su **Logo**. Estos datos aparecerán en todas las facturas y reportes PDF.
*   **Impresión:** Seleccione su impresora predeterminada y el tamaño de papel (Ticket 80mm, 57mm o Carta A4).
*   **Usuarios:** (Solo Admin) Cree, edite o elimine usuarios del sistema. Asigne roles de "Administrador" (acceso total) o "Usuario" (acceso restringido a ventas e inventario básico).

---

## 12. Soporte Técnico
GestorFX cuenta con un módulo de ayuda integrado.

*   Si encuentra un error o tiene una duda, vaya al menú **Soporte Técnico**.
*   Llene el formulario con el Asunto y la Descripción del problema.
*   Al hacer clic en "Enviar Reporte", el sistema abrirá su cliente de correo predeterminado listo para enviar la información directamente al equipo de desarrollo (`contacto.grisalistech@gmail.com`).

---

## Preguntas Frecuentes (FAQ)

**¿Cómo cierro la caja?**
El sistema realiza el cierre lógico al generar el reporte del día. Asegúrese de que el "Total en Efectivo" del reporte coincida con el dinero físico en su cajón (Valor Inicial + Ventas en Efectivo - Gastos).

**¿Puedo usar el sistema sin internet?**
Sí, GestorFX es una aplicación de escritorio y funciona 100% offline. Solo necesita internet si desea enviar un reporte de soporte técnico por correo.

**¿Cómo hago una copia de seguridad?**
La base de datos se encuentra en su equipo local. Se recomienda copiar periódicamente el archivo `database.sqlite` a una memoria USB o nube.  
