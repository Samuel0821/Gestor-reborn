# Estaciones LAN de GestorFX 1.0.11

## Tipos de instalación

El panel web y el asistente muestran Un solo computador, Servidor LAN y Estación LAN. El tipo queda fijo después de activar una licencia. Para probar desde cero sin borrar la licencia actual: npm.cmd run start:fresh. Cada ejecución crea un perfil nuevo.

## Preparación

1. Actualizar primero el servidor con este código de GestorFX.
2. El servidor debe tener una licencia server activa y su negocio registrado. Al iniciar, se recupera el identificador del cliente si una licencia anterior ya estaba registrada pero no lo guardaba localmente. Esta recuperación requiere conexión al servicio de licencias.
3. Preparar la confianza del certificado del servidor en cada estación siguiendo RED_LOCAL.md y configure-station.ps1. El asistente no instala certificados ni omite su validación.
4. Generar en la web un código Estación LAN asociado al cliente del servidor.

## Activación

Seleccionar Estación LAN, indicar la dirección HTTPS del servidor (por ejemplo https://GESTOR-SRV:47821), introducir el código y pulsar Activar y conectar. También se admite un nombre de servidor sin protocolo; se usa HTTPS y el puerto 47821.

Primero se verifica el servidor y su cliente. Después se canjea el código en este equipo y se guarda la conexión. La licencia queda vinculada al equipo y al cliente del servidor. Un código de otro cliente se rechaza antes de consumirlo. Una falla de red o certificado tampoco consume el código.

La estación pasa directamente al login del servidor: no crea otra empresa ni otro administrador ni registra un cliente adicional. La configuración queda en gestorfx-network.json dentro del perfil de la aplicación y se utiliza al volver a abrir.

Si el servidor aún no está configurado y la conexión LAN ya fue preparada con el script, se mantiene el asistente remoto para activar/configurar el servidor. Al finalizar, se solicita activar esta estación por separado con su propio código.

## Supabase

La migración licensing/supabase/004_station_customer_binding.sql añade redeem_code_for_station. El usuario confirmó su aplicación en grisalis-web y el despliegue del código actualizado de redeem. register-customer no necesita un nuevo despliegue. Las firmas mantienen la clave pública original.

## Validación

- 14 comprobaciones locales de SQL, firma, direcciones HTTPS, cliente, códigos de un solo uso y reconexión.
- Pruebas de Electron con servidor y licencia simulados: estación nueva, conexión persistida/reapertura y configuración inicial del servidor desde una estación.
- 10 comprobaciones reales contra Supabase: licencia server, identificación del cliente, código station, rechazo de cliente incorrecto sin consumo, firma, reconexión y ausencia de cliente duplicado. Los registros temporales se retiraron y el contenido anterior quedó idéntico.
- Pruebas de foco en 14 vistas y operaciones consecutivas de panadería correctas.

La conexión con un servidor físico y su certificado debe probarse en la LAN real; las pruebas de interfaz utilizan una respuesta de servidor controlada. No se generó un instalador en este cambio.
