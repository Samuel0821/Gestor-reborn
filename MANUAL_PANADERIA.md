# Manual de Panadería — GestorFX

## Organización de los módulos

Selecciona **Panadería** en la instalación inicial o desde **Ajustes**. Las funciones de esta industria se distribuyen en los módulos habituales; la única vista nueva es **Recetas y producción**.

| Módulo | Uso |
|---|---|
| Productos | Materias primas, empaques, elaborados y reventa; medidas, mínimos, precios y atributos |
| Proveedores | Datos de quienes suministran ingredientes y mercancía |
| Órdenes de Compra | Compras, recepción, cuentas por pagar y pagos a proveedores |
| Recetas y producción | Recetas, consumo real de ingredientes y productos obtenidos |
| Ventas | Venta de elaborados y reventa |
| Gastos | Pagos del negocio y bajas de inventario |
| Reportes | Producción, ventas, costos, gastos y resultado operativo |
| Ajustes | Datos del negocio, usuarios y responsabilidades |

Los accesos antiguos a Panadería redirigen a Recetas y producción. Los artículos y documentos anteriores se conservan: no registres nuevamente sus existencias.

## Un computador o servidor local

En un computador, el administrador puede realizar todo con su cuenta. Si hay varios responsables, cada uno inicia y cierra sesión con su usuario en ese mismo equipo.

Para servidor y estaciones, sigue [RED_LOCAL.md](RED_LOCAL.md). La base permanece en el servidor y las estaciones utilizan la API local. No abras SQLite desde una carpeta compartida ni trabajes sobre copias independientes del negocio. Cada estación necesita conexión al servidor para guardar operaciones. Antes de trasladar el negocio, genera un respaldo consistente y detén la instalación anterior.

Los borradores locales de producción se separan por instalación y usuario. Para continuar desde otra estación, guarda primero el borrador en el servidor y ábrelo desde el historial.

## Usuarios y responsabilidades

En **Ajustes → Usuarios**, crea las cuentas habituales. En esa misma sección aparece **Responsabilidades para Panadería**. Puedes asignar varias áreas a una persona:

- **Productos y compras:** catálogo, proveedores, compras, gastos y bajas.
- **Recetas y producción:** recetas y producciones.
- **Ventas y caja:** ventas, clientes, cotizaciones y caja.
- **Reportes:** costos y resultados.

El administrador general conserva acceso completo. Después de guardar los permisos, el usuario debe recargar o iniciar sesión para actualizar su menú.

## Registrar materia prima en Productos

Abre **Productos → Registrar Nuevo Producto**. Ejemplo:

| Campo | Ejemplo |
|---|---|
| Código | MP-HARINA |
| Nombre | Harina de trigo |
| Clase de artículo | Materia prima / Empaque |
| Unidad de medida | KG |
| Costo por KG | 3000 |
| Cantidad actual KG | 50 si ya tienes existencias; 0 si aún no tienes |
| Cantidad mínima | 5.3 |
| Medida del mínimo | KG |
| Precio de venta | 0 si solo se usa en producción |
| Proveedor | Molino o distribuidor |
| Presentación | Bulto de 50 KG |
| Conservación | Lugar seco, protegido de humedad |
| Observaciones | Marca y características necesarias |

Completa los atributos aplicables y, cuando corresponda, lote y vencimiento iniciales. Guarda el producto.

Puedes ingresar mínimos como **5 KG**, **5.3 KG**, **500 GR**, **1.5 L** o **250 ML**. Se admiten fracciones de peso y volumen; las unidades físicas deben ser enteras. El mínimo genera una referencia de alerta y no agrega inventario. El costo y los precios corresponden a la medida seleccionada. No se convierte peso a volumen.

Marca **Permitir venta directa de esta materia prima** solo si también vendes ese ingrediente al cliente.

Las existencias iniciales se valorizan con el costo indicado: 50 KG a $3000 por KG representan $150.000. No vuelvas a registrar esa misma cantidad como compra. Puedes editar todos los campos del artículo desde Productos. Si cambias existencias, el sistema registra un movimiento de corrección y actualiza sus lotes; si cambias el costo con inventario disponible, revaloriza los lotes actuales sin alterar el costo histórico de ventas.

Los artículos anteriores de Panadería aparecen en Productos con presentación, conservación y observaciones. Edita ese registro, sin duplicarlo. Un producto antiguo todavía sin clasificación puede clasificarse al editarlo, revisando su unidad y valoración.

Crea los elaborados también en Productos: por ejemplo **Pan de queso**, clase **Producto elaborado**, medida **UN**, existencia inicial 0 y precio de venta. La producción agregará cantidades y calculará costos. Para leche empacada, bebidas, huevos o embutidos comprados para vender, utiliza **Mercancía de reventa**.

Las variantes expresan contenido en la unidad seleccionada: si el producto está en KG, una bolsa de 500 GR tiene contenido **0.5**; si está en UN, un paquete de seis panes tiene contenido **6**. Revisa contenido y precio antes de vender.

## Comprar y recibir

1. Registra al proveedor en **Proveedores**, si no existe.
2. En **Órdenes de Compra**, crea una orden y selecciona proveedor y artículo.
3. Selecciona medida, cantidad y costo por medida: **5.5 KG** a **$4000 por KG** equivalen a **$22.000**.
4. Indica lote y vencimiento cuando corresponda. Agrega las demás líneas y guarda.
5. Cuando llegue la mercancía, utiliza **Recibir Mercancía**. Crear la orden no incrementa existencias.
6. Registra pagos desde las acciones habituales de esa orden.

Las conversiones son automáticas. Los elaborados ingresan mediante producción. Repetir una recepción no duplica inventario. El administrador puede usar **Anular recepción** cuando no existen pagos y los lotes siguen completos; si ya hubo consumo o venta, se rechaza para conservar la trazabilidad.

## Recetas y producción

El módulo tiene dos pestañas independientes. La receta describe cómo preparar un producto; la producción registra las cantidades realmente fabricadas.

### Pestaña Registrar receta

1. En **Producto del inventario**, selecciona uno existente o deja **Crear un producto nuevo**.
2. Escribe el nombre, por ejemplo **PAN BOLA PIÑA**.
3. En **Descripción y preparación**, explica mezcla, amasado, reposo y cocción.
4. Selecciona la medida del producto, por ejemplo **UN** para panes.
5. En **Materias primas de la receta**, selecciona los ingredientes y sus medidas. Las cantidades de referencia son opcionales y no se trasladan automáticamente a producción.
6. Pulsa **Guardar receta**.

Si el producto no existe, se crea automáticamente en Productos con existencia **0**. Guardar una receta no significa haber fabricado panes y no consume materias primas. Si el nombre ya corresponde a un elaborado existente, se reutiliza ese producto. Si corresponde a una materia prima, un artículo inactivo u otro registro incompatible, se solicita revisar el catálogo.

Debajo aparece la tabla **Recetas registradas**. **Ver receta** muestra la descripción y los ingredientes. **Crear producción** carga esa fórmula en la otra pestaña. Guardar nuevamente una receta con el mismo nombre conserva una nueva versión.

### Pestaña Crear producción

1. Selecciona una receta y pulsa **Cargar receta**, o utiliza **Crear producción** desde su tabla. Se seleccionan los ingredientes y el producto; las cantidades quedan vacías para registrar lo realmente utilizado y fabricado. Puedes consultar la preparación sin salir del formulario.
2. Comprueba nombre y fecha de la producción.
3. En **Materias primas utilizadas**, ingresa lo realmente consumido. Si la receta sugería 5 KG de harina y usaste 5.2 KG, registra 5.2 KG. Incluye empaques solo si se controlan en inventario y se usaron en esa fabricación.
4. En **Productos elaborados**, registra la **Cantidad buena** y el **Desperdicio**, con la medida seleccionada. Si obtuviste 98 panes buenos y 2 dañados, registra **98 UN** y desperdicio **2**. Al inventario entran 98, no 100.
5. Explica el desperdicio en **Observaciones y motivo del desperdicio**.
6. Puedes abrir **Precio, vencimiento y otros datos** para indicar cantidad esperada, nuevo precio de venta o vencimiento. Si fabricas varios productos en la misma producción, reparte el costo con proporciones coherentes; con un solo producto deja 1.
7. Pulsa **Confirmar producción** para descontar las materias primas y sumar los productos buenos. Si deseas continuar después, utiliza **Guardar borrador**.

**Producción desde cero** permite trabajar sin receta. En el selector de producto elaborado puedes elegir **Crear producto nuevo** y escribir su nombre. Al guardar se crea su ficha con existencia cero; al confirmar se agregan las unidades buenas. Si ya existe, se usa ese registro. No se crean duplicados por repetir una producción del mismo producto.

Un producto nuevo empieza sin precio de venta. Puedes indicarlo en los datos opcionales de la producción o configurarlo en Productos antes de vender.

Guardar borrador no reserva ni descuenta ingredientes y no suma existencias fabricadas. La confirmación es atómica: si falta materia prima, no se registra una producción parcial. Los lotes se asignan por vencimiento; para elegir uno específico abre la opción de lote de esa materia prima.

El formulario se conserva al salir y se separa por usuario. Para continuar desde otra estación, guarda el borrador y ábrelo desde **Historial de producción → Continuar**. Si otra estación lo modificó, carga la versión actual antes de guardar.

Al final de esta pestaña aparece **Historial de producción**, con productos, cantidades buenas, fecha, estado y responsable. **Detalle** muestra consumos y desperdicios. El administrador puede anular una producción solo si sus lotes siguen completos y no tuvieron salidas.

Los formularios nuevos no solicitan mano de obra, gas o energía: esos pagos se registran en **Gastos** cuando corresponda. Si cargas un borrador anterior que contiene costos adicionales, se muestran expresamente; puedes conservarlos o quitarlos de ese borrador sin borrar los gastos ya registrados.

## Gastos y bajas

Registra gas, energía, alquiler, mano de obra y otros pagos en **Gastos**, con fecha y valor. Registra cada pago una sola vez cuando corresponda: servicios públicos mensualmente y mano de obra según la periodicidad real. No es necesario ingresarlos en cada producción.

En **Gastos → Bajas y consumo de inventario de Panadería**, registra daños, vencimientos, consumo interno, obsequios o ajustes por conteo: artículo, cantidad, medida, fecha y motivo. Para vencidos selecciona el lote.

La baja descuenta inventario y reconoce su costo como pérdida; no representa otro pago de caja. El administrador puede anularla con justificación desde su historial.

## Ventas y reportes

Utiliza **Ventas** y la caja habitual. Puedes combinar elaborados y reventa en una factura. Vender pan descuenta pan: la harina ya se descontó al producirlo. Cada venta conserva su costo histórico; producciones posteriores no cambian la utilidad anterior. Para corregir ventas de Panadería, el administrador utiliza Anular y registra la operación correcta.

En **Reportes → Producción y utilidad**, selecciona fechas y agrupación diaria, semanal, quincenal o mensual. Consulta inversión, cantidades producidas y vendidas por producto, desperdicio, ventas, costo vendido, gastos, bajas y resultado operativo.

**Resultado operativo = ventas sin IVA − costo de lo vendido − bajas − gastos netos.** Compras y producción no se descuentan nuevamente: el costo se reconoce al vender o dar de baja el inventario. Los gastos asignados a producción se reclasifican para evitar doble conteo.

El resultado depende de registrar todos los costos y gastos reales. Un costo sin gasto relacionado se identifica como estimado. Registra también los impuestos adicionales y costos financieros aplicables. El inventario valorizado muestra el saldo actual, no el inventario histórico al cierre del rango.

Una venta a crédito sigue siendo una venta aunque no se haya cobrado. Cobrar una deuda anterior no genera otra venta. Pagar al proveedor tampoco genera otra compra ni otro costo de producción.

## Rutina para capacitación

1. Activar Panadería, revisar usuarios y crear proveedores, materias primas, elaborados y reventa.
2. Al abrir, comprobar caja, inventario, mínimos y vencimientos.
3. Registrar y recibir compras reales con medidas, lotes y costos correctos.
4. Registrar consumos y producción buena; revisar antes de confirmar.
5. Facturar ventas con sus formas de pago.
6. Registrar gastos y bajas; revisar caja y consultar producción y utilidad.
7. Mantener respaldos consistentes de la instalación.