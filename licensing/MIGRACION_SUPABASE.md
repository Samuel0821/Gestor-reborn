# Migración de licencias a Grisalis Web

Fecha de verificación: 2026-11-17.

El servicio utiliza https://fteuajrvyjjdjbphlulp.supabase.co. La conexión pública está en src/licensing.js; la clave pública Ed25519 existente se conserva para verificar las licencias originales. Las claves privadas de Supabase y de firma no forman parte del cliente.

## Validación

Se ejecutó el cliente real contra el destino con datos temporales: generación, activación, verificación de firma y equipo, registro del cliente, rechazo de reutilización y de token incorrecto. Se confirmó que las tablas no permiten lecturas con la clave anónima. Los registros temporales se retiraron y el contenido previo quedó idéntico.

El usuario confirmó el panel de producción y las variables del alojamiento. Los dos códigos históricos importados fueron eliminados intencionalmente por el usuario.

## Distribución

Versión: 1.0.11. Ejecutar npm.cmd run make:windows para reconstruir.

- Instalador: out/make/squirrel.windows/x64/GestorFX-1.0.11 Setup.exe.
- ZIP: out/make/zip/win32/x64/GestorFX-win32-x64-1.0.11.zip.

Se verificó que el paquete contiene la conexión nueva y no contiene archivos .env ni la carpeta de backend licensing.

Las versiones anteriores conservan el endpoint antiguo. El usuario confirmó que hay instalaciones por actualizar. Sustituir los instaladores publicados y actualizar los equipos que deban activar o enviar datos antes de retirar uesoiiawrkziijrdowkx. El proyecto antiguo aún no se ha eliminado.

Para una instalación LAN, identificar primero si el servidor funciona mediante la tarea GestorFX LAN Server: ese servidor usa el ZIP y una ruta fija, y no debe actualizarse como una estación sin revisar su configuración.

## Instalación individual

La versión 1.0.11 incorpora el tipo standalone. El asistente exige activar antes de configurar la empresa. Se mantienen los tipos server y station; las estaciones requieren un cliente con servidor LAN activo para emitir su código. La migración 003 y la función redeem actualizada se aplicaron y probaron en grisalis-web. El usuario confirmó la publicación del panel actualizado.

## Pruebas de una instalación nueva

`npm.cmd start` conserva la configuración y la licencia existentes. Si el asistente indica que la instalación está activada, el tipo queda fijo porque forma parte de la licencia firmada.

Para probar la selección y activación desde cero sin borrar los datos actuales, ejecutar `npm.cmd run start:fresh`. Solo en desarrollo se crea un directorio temporal nuevo con SQLite, licencia y perfil de navegador separados; también se omite la conexión LAN guardada. La ruta se muestra en la consola. Cada ejecución crea otra instalación de prueba; las activaciones siguen usando códigos reales de un solo uso. No ejecutar este comando para retomar datos de una prueba anterior.

Las instalaciones empaquetadas no habilitan este modo de desarrollo. La versión del programa continúa siendo 1.0.11. Para comprobar el aislamiento automáticamente: `npm.cmd run test:installation`.

## Estaciones LAN

El asistente ya muestra los tres tipos del panel web. Véase ESTACIONES_LAN.md para la activación propia de la estación, la conexión con el servidor, la migración 004 y los resultados de pruebas. Se mantiene la versión 1.0.11.
