# Registro de clientes y desactivación (GestorFX 1.0.11)

## Aplicar en Supabase grisalis-web (fteuajrvyjjdjbphlulp)

1. Ejecutar completo 005_customer_registration_and_deactivation.sql en SQL Editor. Es aditivo: conserva clientes, códigos e instalaciones, y repara la vinculación de códigos a clientes existentes.
2. Crear Edge Function license-status con functions/license-status/index.ts y Verify JWT desactivado. Verifica el token privado de la activación y el identificador del equipo; no necesita una clave de firma nueva. Usa los secretos automáticos SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
3. El código de register-customer no cambia; confirmar que exista desplegado y con Verify JWT desactivado.
4. Publicar los cambios de la web en src/components/GestorFXLicenses.tsx y src/app/api/admin/gestorfx/route.ts. No subir .env.local ni respaldos.
5. Reiniciar GestorFX con estos cambios y con Internet. Recupera de la base local los datos de instalaciones que no terminaron de registrar al cliente; los reintenta cada cinco minutos. Recargar el panel.

## Comportamiento

El cliente se vincula a la instalación y a su código usado. El panel también puede resolver esa relación desde la instalación para datos anteriores. No se registra un cliente adicional al conectar una estación LAN.

Revocar código impide consumir un código disponible. Desactivar licencia cambia la instalación a released y revoca su código de forma atómica, conserva los datos y no permite reutilizar el código. Puede hacerse desde Instalaciones o desde un código usado. Desactivar el servidor también impide las operaciones LAN en ese servidor al detectar el cambio.

El programa comprueba el estado al iniciar y cada cinco minutos; la comprobación tarda como máximo veinte segundos por solicitud. Sin conexión o ante un error del servicio se conserva el estado local. Por tanto la desactivación remota se aplica cuando el equipo vuelve a consultar correctamente con Internet; no es inmediata en equipos desconectados. Una desactivación confirmada se conserva aunque después falte Internet. Se requiere una actualización del programa para que instalaciones antiguas consulten ese estado.

Una nueva activación conserva la base local existente y vuelve al login si el negocio ya estaba configurado. No borra información para forzar el asistente.

No se ha generado un instalador ni cambiado la versión 1.0.11. No ejecutar 001_schema.sql para aplicar este cambio.
