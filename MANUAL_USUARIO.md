# Manual de Usuario - GestorFX

## Introducción

GestorFX es una aplicación de escritorio diseñada para la gestión de su negocio. Permite administrar clientes, productos, proveedores, realizar ventas, generar cotizaciones y órdenes de compra, y visualizar reportes.

## Primeros Pasos

Para comenzar a utilizar GestorFX, es necesario iniciar sesión.

### Inicio de Sesión

La pantalla de inicio de sesión le solicitará un nombre de usuario y una contraseña.

**Usuario:** `admin`
**Contraseña:** `12345`

Una vez que ingrese las credenciales correctas, se mostrará una ventana para que ingrese el **valor inicial del día**. Este valor corresponde al dinero en caja al iniciar las operaciones.

Luego de ingresar el valor inicial, será redirigido a la pantalla principal de la aplicación.

## Módulos

A continuación se describen los módulos principales de la aplicación.

### Dashboard

El dashboard es la pantalla principal de la aplicación. Muestra un resumen de la información más importante a través de las siguientes tarjetas:

*   **Clientes:** Número total de clientes registrados.
*   **Productos:** Número total de productos en el inventario.
*   **Proveedores:** Número total de proveedores registrados.
*   **Ventas:** Número total de ventas realizadas.
*   **Cotizaciones:** Número total de cotizaciones generadas.

También muestra una alerta de **"Productos en stock mínimo"** cuando el stock de un producto ha alcanzado su nivel mínimo predefinido.

En la parte superior de la pantalla, encontrará los botones de menú para navegar a las diferentes secciones de la aplicación: Clientes, Productos, Proveedores, Ventas, Órdenes de Compra, Cotizaciones, Reportes y Ajustes.

### Clientes

En esta sección puede administrar la información de sus clientes. Las funcionalidades principales son:

*   **Registrar y Editar Clientes:**
    *   Utilice el formulario "Registrar / Editar Cliente" para agregar nuevos clientes o modificar los existentes.
    *   Los campos "Nombre" y "NIT / Cédula" son obligatorios.
    *   Para editar un cliente, haga clic en el botón "Editar" en la lista de clientes. Los datos del cliente se cargarán en el formulario.
    *   Haga clic en "Guardar" para registrar los cambios.

*   **Listado de Clientes:**
    *   La tabla "Listado de clientes" muestra todos los clientes registrados.
    *   Puede buscar clientes por nombre utilizando la barra de búsqueda.

*   **Eliminar Clientes:**
    *   Haga clic en el botón "Eliminar" para quitar un cliente de la lista. Se le pedirá confirmación antes de eliminarlo.

### Proveedores

En esta sección puede administrar la información de sus proveedores. Las funcionalidades principales son:

*   **Registrar y Editar Proveedores:**
    *   Utilice el formulario "Registrar / Editar Proveedor" para agregar nuevos proveedores o modificar los existentes.
    *   El campo "Nombre del Proveedor" es obligatorio.
    *   Para editar un proveedor, haga clic en el icono de lápiz (<i class="fa fa-edit"></i>) en la lista de proveedores. Los datos del proveedor se cargarán en el formulario.
    *   Haga clic en "Guardar" para registrar los cambios.

*   **Listado de Proveedores:**
    *   La tabla "Listado de Proveedores" muestra todos los proveedores registrados.
    *   Puede buscar proveedores por nombre utilizando la barra de búsqueda.

*   **Eliminar Proveedores:**
    *   Haga clic en el icono de papelera (<i class="fa fa-trash"></i>) para quitar un proveedor de la lista. Se le pedirá confirmación antes de eliminarlo.

*   **Exportar Datos:**
    *   Puede exportar el listado de proveedores a formato Excel haciendo clic en el botón "Exportar Excel".
    *   Puede exportar el listado de proveedores a formato PDF haciendo clic en el botón "Exportar PDF".

### Productos

En esta sección puede administrar su catálogo de productos. Las funcionalidades principales son:

*   **Registrar y Editar Productos:**
    *   Utilice el formulario "Registrar / Editar Producto" para agregar nuevos productos o modificar los existentes.
    *   Los campos "Código", "Nombre" y "Precio venta" son obligatorios.
    *   Puede asignar una categoría existente o crear una nueva.
    *   Puede definir un precio de costo, precio de venta, precio especial, stock actual y stock mínimo.
    *   Puede asociar un proveedor al producto.
    *   **Variantes:** Un producto puede tener múltiples variantes (ej. "1/2 saco"). Cada variante tiene un nombre, un precio de venta y un factor de conversión (ej. 0.5 para medio saco). Utilice el botón "Añadir Variante" para agregar nuevas.
    *   Para editar un producto, haga clic en el botón "Editar" en la lista de productos. Los datos del producto se cargarán en el formulario.
    *   Haga clic en "Guardar" para registrar los cambios.

*   **Listado de Productos (Inventario):**
    *   La tabla "Inventario" muestra todos los productos registrados, incluyendo su código, nombre, precio de venta, stock y stock mínimo.
    *   Se mostrará una alerta si el stock de un producto está en su nivel mínimo.
    *   Se muestra el valor total del inventario.
    *   Puede buscar productos por nombre o código utilizando la barra de búsqueda.

*   **Eliminar Productos:**
    *   Haga clic en el botón "Eliminar" para quitar un producto de la lista. Se le pedirá confirmación antes de eliminarlo.

*   **Exportar Inventario:**
    *   Puede exportar el inventario a formato Excel haciendo clic en el botón "Exportar Excel".
    *   Puede exportar el inventario a formato PDF haciendo clic en el botón "Exportar PDF".

### Cotizaciones

Este módulo le permite generar y administrar cotizaciones para sus clientes.

*   **Crear Nueva Cotización:**
    *   **Seleccionar Cliente:** Puede asociar la cotización a un cliente existente (opcional).
    *   **Agregar Productos:**
        *   Utilice el campo "Producto" para buscar y seleccionar productos.
        *   Ingrese la "Cantidad" deseada.
        *   Si un producto tiene variantes, se le pedirá que seleccione la unidad de venta deseada (ej. "1/2 saco").
        *   Haga clic en "Agregar" para añadir el producto a la cotización.
    *   **Ajustar Precios:** En la tabla de ítems de la cotización, puede seleccionar entre el precio de venta normal o el precio especial (si está disponible) para cada producto.
    *   **Total:** El sistema calculará automáticamente el subtotal de cada ítem y el total general de la cotización.
    *   **Finalizar Cotización:** Una vez que haya agregado todos los productos, haga clic en "Finalizar Cotización" para guardarla.

*   **Historial de Cotizaciones:**
    *   En la sección "Historial de cotizaciones" se muestra un listado de todas las cotizaciones generadas.
    *   **Exportar PDF:** Haga clic en "Exportar PDF" para generar un documento PDF de la cotización. Se le preguntará si desea incluir el 19% de IVA.
    *   **Aprobar:** Haga clic en "Aprobar" para convertir la cotización en una venta. Esto actualizará el stock de los productos.
    *   **Eliminar:** Haga clic en "Eliminar" para borrar una cotización del historial. Se le pedirá confirmación.

### Órdenes de Compra

Este módulo le permite generar y administrar órdenes de compra a sus proveedores.

*   **Registrar / Editar Orden de Compra:**
    *   **Proveedor:** Seleccione el proveedor al que se le realizará la orden.
    *   **Fecha de Orden:** Ingrese la fecha en que se realiza la orden.
    *   **Productos:**
        *   Haga clic en "Agregar Producto" para añadir ítems a la orden.
        *   Para cada ítem, seleccione el producto, ingrese la cantidad y el precio de compra.
    *   Haga clic en "Guardar" para registrar la orden de compra.
    *   Para editar una orden existente, haga clic en el botón de edición (<i class="fa fa-edit"></i>) en la lista.

*   **Listado de Órdenes de Compra:**
    *   La tabla muestra todas las órdenes de compra con su número, proveedor, fecha, total y estado.
    *   Puede buscar órdenes de compra por proveedor o número de orden.

*   **Acciones sobre Órdenes de Compra:**
    *   **Ver Detalles:** Haga clic en el botón de información (<i class="fa fa-eye"></i>) para ver un resumen detallado de la orden, incluyendo los productos y sus subtotales.
    *   **Exportar PDF:** Desde la vista de detalles, puede exportar la orden de compra a un archivo PDF.
    *   **Eliminar:** Haga clic en el botón de eliminar (<i class="fa fa-trash"></i>) para borrar una orden de compra. Se le pedirá confirmación.

### Ventas

En esta sección puede registrar y administrar las ventas de sus productos, así como gestionar créditos.

*   **Venta Rápida (Agregar Productos):**
    *   **Selección Manual:**
        *   Utilice el campo "Producto" para buscar y seleccionar productos de su inventario.
        *   Ingrese la "Cantidad" deseada.
        *   Si el producto tiene variantes, se le pedirá que seleccione la unidad de venta.
        *   Haga clic en "Agregar" para añadir el producto a la lista de ítems de la venta.
    *   **Escaneo de Código de Barras:**
        *   Utilice el campo "Escanear / Ingresar código de barras" para añadir productos rápidamente.
        *   Al escanear o ingresar un código y presionar Enter, se mostrará una vista previa del producto. Desde allí, puede ajustar la cantidad y añadirlo a la venta.
        *   Si el producto no existe, se le preguntará si desea registrarlo.
    *   **Ajuste de Ítems:**
        *   En la tabla "Items de la venta", puede ajustar la cantidad de productos (especialmente para variantes por peso como "kg").
        *   Puede cambiar el precio de venta de un ítem entre el precio normal y el precio especial (si aplica).
        *   Puede eliminar ítems de la venta.
    *   **Total:** El sistema calculará el total de la venta.

*   **Finalizar Venta:**
    *   **Cliente:** Puede asociar la venta a un cliente existente (opcional).
    *   **Tipo de Venta:** Seleccione "Contado" o "Crédito".
    *   **Registro de Pago:** Al hacer clic en "Finalizar Venta", se abrirá un modal de pago donde puede ingresar el monto recibido en efectivo y/o por transferencia. El sistema calculará el cambio a devolver o el monto pendiente.
    *   La venta se registrará, el stock se actualizará y, si es una venta en efectivo, se registrará el movimiento en caja.

*   **Historial de Ventas:**
    *   Muestra un listado de todas las ventas realizadas, con número de factura, fecha y monto total.
    *   **Descargar Factura:** Genera un archivo PDF de la factura. Puede elegir si desea incluir el 19% de IVA.
    *   **Imprimir Factura:** Permite imprimir la factura en una impresora seleccionada, con opciones de tamaño de papel.
    *   **Eliminar Factura:** Elimina una venta del historial (requiere confirmación).

*   **Gestión de Créditos:**
    *   Muestra un listado de ventas a crédito pendientes, con el cliente, total, monto abonado y saldo pendiente.
    *   **Buscar Créditos:** Puede buscar créditos por nombre de cliente.
    *   **Ver Detalle:** Permite ver los detalles de un crédito, registrar abonos parciales y marcar el crédito como pagado.

### Reportes

Este módulo le permite generar reportes de ventas para analizar el rendimiento de su negocio.

*   **Generar Reporte:**
    *   **Tipo de Reporte:** Seleccione el tipo de reporte que desea generar: "Diario", "Semanal" o "Mensual".
    *   **Fechas:** Seleccione una "Fecha de inicio" y una "Fecha de fin" para definir el período del reporte.
    *   Haga clic en "Generar Reporte" para visualizar los datos.

*   **Visualización del Reporte:**
    *   El reporte mostrará una tabla con el detalle de cada venta realizada en el período seleccionado, incluyendo:
        *   Número de factura.
        *   Fecha de la venta.
        *   Monto total de la venta.
        *   Detalle de los productos vendidos (nombre, cantidad, subtotal).
        *   Detalle de los pagos (efectivo, transferencia, crédito).
    *   Al final del reporte, se mostrará un "TOTAL GENERAL" que resume todas las ventas del período.

*   **Exportar Reporte:**
    *   Si el reporte contiene datos, aparecerá un botón "Exportar PDF" que le permitirá guardar el reporte generado como un archivo PDF.

### Configuración

En esta sección puede configurar diferentes aspectos de la aplicación, incluyendo la información de su empresa y las preferencias de impresión.

*   **Ajustes de Empresa:**
    *   **Información General:** Puede ingresar y guardar el nombre de su empresa, NIT/Cédula, dirección, correo electrónico y número de teléfono.
    *   **Logo:** Puede cargar un logo para su empresa (en formato PNG o JPEG). Se mostrará una vista previa del logo cargado.
    *   Haga clic en "Guardar Ajustes" para aplicar los cambios. Un mensaje de estado le indicará si la operación fue exitosa.

*   **Configuración de Impresión:**
    *   **Seleccionar Impresora:** Elija una de las impresoras disponibles en el menú desplegable.
    *   **Tamaño del Papel:** Seleccione el tamaño de papel deseado para las impresiones (A4, Carta, Papel de Rollo 80mm).
    *   Haga clic en "Guardar Configuración de Impresión" para guardar sus preferencias.

## Solución de Problemas

Aquí encontrará soluciones a problemas comunes que pueden surgir al usar GestorFX.

*   **La aplicación no inicia:**
    *   Asegúrese de que su sistema operativo cumpla con los requisitos mínimos.
    *   Intente reiniciar su computadora.
    *   Si el problema persiste, contacte al soporte técnico.

*   **Problemas de inicio de sesión:**
    *   Verifique que el usuario y la contraseña sean correctos. Recuerde que las credenciales por defecto son `admin` y `12345`.
    *   Asegúrese de que la tecla Bloq Mayús no esté activada.

*   **Los datos no se guardan o no se muestran correctamente:**
    *   Verifique su conexión a internet (si la aplicación tiene funcionalidades en línea, aunque esta parece ser de escritorio).
    *   Reinicie la aplicación.
    *   Si el problema persiste, podría haber un problema con la base de datos interna. Contacte al soporte técnico.

*   **Problemas al imprimir:**
    *   Asegúrese de que la impresora esté encendida y conectada a su computadora.
    *   Verifique que la impresora tenga papel y tinta/tóner.
    *   Revise la configuración de impresión en la sección "Ajustes" de la aplicación.
    *   Intente imprimir una página de prueba desde su sistema operativo.

*   **La aplicación se congela o no responde:**
    *   Cierre la aplicación y vuelva a abrirla.
    *   Si el problema es recurrente, anote los pasos que lo llevaron a la situación y contacte al soporte técnico.

Si no encuentra una solución a su problema aquí, por favor, contacte al equipo de soporte técnico para obtener ayuda.
