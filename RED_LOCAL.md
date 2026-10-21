# Manual de instalación de GestorFX en la ferretería

Guía para instalar desde cero un servidor central y cuatro puestos Windows en la misma red local. No existe una base anterior que copiar: GestorFX creará una base vacía en el servidor y se configurará desde la primera estación. Siga las etapas en orden.

## 1. Qué hará cada equipo

- **Servidor Windows:** mantiene la única base de datos y atiende las conexiones seguras. Debe estar encendido durante el horario de trabajo.
- **Estaciones:** dos puestos de ventas, secretaría y administración. Ejecutan la interfaz y se conectan al servidor por la LAN. Cada persona usa su propia cuenta de GestorFX.
- No comparta la base por carpeta de red/SMB. Solo GestorFX en el servidor debe abrir la base central.

## 2. Revise la USB: qué archivos debe llevar

Por las capturas, la USB está organizada correctamente: carpeta `Instaladores` con los tres archivos de estación, carpeta `Servidor` con el ZIP y carpeta `RED_LOCAL` con este manual. En Windows puede que las extensiones `.exe`, `.nupkg` y `.md` estén ocultas; confirme los nombres completos en Propiedades. No cambie los nombres.

| Archivo en la USB | Se usa para |
| --- | --- |
| `Servidor\GestorFX-win32-x64-1.0.9.zip` | Instalar la aplicación en el servidor. |
| `Instaladores\GestorFX-1.0.9 Setup.exe` | Instalar GestorFX en las estaciones. |
| `Instaladores\gestorfx-1.0.9-full.nupkg` | Paquete que acompaña al instalador de estación. |
| `Instaladores\RELEASES` | Manifiesto que acompaña al instalador de estación. |
| `RED_LOCAL\RED_LOCAL.md` | Este manual. |

Los tres archivos de `Instaladores` deben permanecer juntos. No lleve ni copie la carpeta `.tools` que aparece en el computador de desarrollo; contiene herramientas de compilación y no se necesita. Tampoco se necesita el código fuente.

El certificado **todavía no está** en la USB. El servidor lo generará. Después se copiará el certificado público `C:\ProgramData\GestorFX\server-root-ca.cer` a una carpeta `CertificadoServidor` en la USB, junto con la huella que mostrará el servidor. No copie `server.pfx`, `run-server.ps1`, contraseñas ni una base de datos.

## 3. Primera etapa: revisar la red existente sin interrumpirla

El servidor ya ejecuta el programa de facturación del contador. **No reinicie el router ni el servidor, no cambie la configuración de Internet/WAN, el rango DHCP, las reglas existentes ni la configuración de facturación. No abra puertos en el router hacia Internet.** GestorFX solo necesita comunicación dentro de la LAN; no r iere publicar el servidor en Internet. Antes de instalar, coordine un horario en que no se esté usando el sistema del contador y confirme que exista respaldo de ese programa.

1. Conecte las estaciones a la misma red del servidor. Evite Wi-Fi de invitados. No haga cambios en el router todavía.
2. En el servidor, abra PowerShell y ejecute:

```powershell
hostname
Get-NetIPConfiguration
Get-NetIPInterface -AddressFamily IPv4 | Select-Object InterfaceAlias,Dhcp,ConnectionState
Get-NetConnectionProfile
```

Anote el nombre del equipo, IPv4, máscara/prefijo, puerta de enlace, si DHCP está habilitado y el perfil (Domain/Private/Public) de la interfaz conectada a la LAN. Ignore adaptadores desconectados, VPN y direcciones `169.254.x.x`.

3. En cada estación, ejecute `Get-NetIPConfiguration` y anote IPv4, máscara/prefijo y puerta de enlace de la conexión activa. Compruebe que pertenezca a la misma red local que el servidor. Por ejemplo, con máscara `/24`, servidor `192.168.1.20` y estación `192.168.1.35` están en la misma subred `192.168.1.0/24`. Si las redes no coinciden, si hay una Wi-Fi de invitados, o si no puede determinarlo, **deténgase antes de modificar el router**.

4. Desde cada estación, compruebe que puede llegar a la IP LAN del servidor:

```powershell
ping -4 192.168.1.20
```

Cambie el ejemplo por la IP anotada. Si hay respuesta, la conectividad básica está comprobada. Si hay “tiempo de espera”, el firewall puede estar bloqueando ping; ejecute `arp -a` después del intento y busque la IP del servidor. Si no aparece una dirección física/MAC, los equipos podrían estar aislados entre sí o en redes distintas. No desactive el firewall de Windows: revise conexión/cable/Wi-Fi y aislamiento del router, y no instale GestorFX hasta confirmar la LAN.

5. Determine si la IP del servidor es estable. Si DHCP está deshabilitado, normalmente es una IP fija: anótela y no la cambie. Si DHCP está habilitado, anote la IP actual y, **solo si tiene acceso autorizado y entiende la pantalla del router**, revise la concesión DHCP y cree una reserva para la MAC del servidor conservando su IP actual. La MAC se consulta en `Get-NetAdapter`. No cambie el rango DHCP, puerta de enlace, DNS de Internet ni otra reserva. Si no está seguro, no cambie el router: acuerde con el dueño/operador de la red cómo mantener la IP estable antes de producción.

6. Use un nombre DNS que las estaciones resuelvan hacia esa IP. Pruebe el nombre actual del servidor desde las estaciones:

```powershell
[System.Net.Dns]::GetHostAddresses("NOMBRE-DEL-SERVIDOR")
```

Si no resuelve y no hay DNS local, puede usar el nombre `GESTOR-SRV` y agregar en el archivo `C:\Windows\System32\drivers\etc\hosts` de **cada estación** una línea con IP y nombre, por ejemplo `192.168.1.20 GESTOR-SRV`. Abra Bloc de notas como administrador, abra el archivo seleccionando “Todos los archivos” y guárdelo. Reemplace los ejemplos con los valores reales y compruebe que `[System.Net.Dns]::GetHostAddresses("GESTOR-SRV")` muestre la IP correcta desde las cuatro estaciones. Esto evita cambiar DNS o DHCP del router; si la IP del servidor cambia, habrá que actualizar esas entradas y la conexión.

Complete y conserve estos datos:

| Dato | Valor |
| --- | --- |
| Nombre DNS que se usará (resuelve desde cada estación) | _____________________ |
| IP LAN actual/estable del servidor | _____________________ |
| Máscara o prefijo del servidor | _____________________ |
| Subred CIDR (por ejemplo `192.168.1.0/24`) | _____________________ |
| Perfil de red del servidor (Domain/Private/Public) | _____________________ |
| Puerto de GestorFX | `47821` |

7. Antes de la instalación, confirme en el servidor que el puerto elegido no está en uso:

```powershell
Get-NetTCPConnection -LocalPort 47821 -State Listen -ErrorAction SilentlyContinue
```

Si aparece una aplicación escuchando en ese puerto, no continúe ni cierre el proceso: elija con criterio otro puerto y adapte firewall/documentación, o deténgase para investigarlo. Si no aparece salida, el puerto está libre.

**Condición para avanzar:** las cuatro estaciones alcanzan la IP del servidor en la LAN, resuelven el mismo nombre DNS a esa IP, la IP del servidor se mantendrá estable, y no hay conflicto con el puerto. Si alguna condición falla, primero resuelva la red sin alterar el sistema de facturación.

## 4. Segunda etapa: instalar y preparar el servidor

Haga estos pasos en el computador que será servidor. Use una cuenta administradora. Instale en su disco local, no en la USB ni en una unidad de red.

1. Conecte la USB y abra la carpeta `Servidor`. En `GestorFX-win32-x64-1.0.9.zip`, haga clic derecho y seleccione **Extraer todo**. Como destino use `C:\Program Files\GestorFX` (cree la carpeta si hace falta). Al terminar debe existir exactamente `C:\Program Files\GestorFX\GestorFX.exe`. Si quedó una carpeta anidada adicional, mueva su contenido para que el EXE quede en esa ruta. No copie solo el EXE.
2. Abra **Windows PowerShell como administrador**. Sustituya el nombre y la subred del ejemplo por los anotados. Esta es una instalación nueva, así que **no agregue `-DatabaseSource`**:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
& "C:\Program Files\GestorFX\resources\scripts\configure-server.ps1" `
  -ExecutablePath "C:\Program Files\GestorFX\GestorFX.exe" `
  -ServerAddress "GESTOR-SRV" `
  -LanSubnet "192.168.1.0/24" `
  -Port 47821
```

3. Espere a que termine. Anote o fotografíe la huella **SHA1** que se muestra. En el servidor, copie `C:\ProgramData\GestorFX\server-root-ca.cer` a una carpeta nueva `CertificadoServidor` en la USB. Llevará este certificado público y la huella a las estaciones. No copie `server.pfx`.
4. Compruebe que la tarea del servidor exista y se haya ejecutado:

```powershell
Get-ScheduledTask -TaskName "GestorFX LAN Server" | Get-ScheduledTaskInfo
```

El script crea el inicio automático y la carpeta protegida `C:\ProgramData\GestorFX\Data`. La base vacía se crea al iniciar el servidor. La aplicación funciona sin ventana. Agrega una regla al Firewall de Windows para TCP 47821 desde la subred indicada; no configura el router ni publica el puerto en Internet. Si el perfil activo del servidor era `Public`, la regla del script (que cubre Domain/Private) no lo incluye. No cambie el perfil a ciegas ni desactive el firewall. Solo si confirmó que la subred está correcta y los cinco equipos están en esa LAN, agregue esta regla limitada a dicha subred, adaptando el CIDR:

```powershell
New-NetFirewallRule -DisplayName "GestorFX LAN TCP 47821 perfil Public" `
  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 47821 `
  -RemoteAddress "192.168.1.0/24" -Profile Public
```

La comprobación HTTPS se hará desde la primera estación, después de instalar allí el certificado.

## 5. Tercera etapa: instalar y enlazar cada estación

Repita todos estos pasos en los dos puestos de ventas, secretaría y administración:

1. En la estación, copie la carpeta `Instaladores` de la USB a `C:\Instaladores\GestorFX`. Deben estar juntos `GestorFX-1.0.9 Setup.exe`, `gestorfx-1.0.9-full.nupkg` y `RELEASES`.
2. Ejecute `GestorFX-1.0.9 Setup.exe` e instale. Abra GestorFX una vez y ciérrelo.
3. Conecte la USB que contiene `CertificadoServidor\server-root-ca.cer`. Abra PowerShell como administrador y ejecute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
$stationScript = Get-ChildItem "$env:LOCALAPPDATA\gestorfx\app-*\resources\scripts\configure-station.ps1" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $stationScript) { throw "No se encontró configure-station.ps1; confirme la instalación." }
& $stationScript.FullName `
  -ServerAddress "GESTOR-SRV" `
  -ServerCertificate "E:\CertificadoServidor\server-root-ca.cer" `
  -ExpectedThumbprint "PEGUE_AQUI_LA_HUELLA_SHA1_MOSTRADA_EN_EL_SERVIDOR" `
  -Port 47821
```

Cambie `GESTOR-SRV` por el nombre elegido, `E:` por la letra real de la USB y el texto de huella por la huella mostrada en el servidor. No escriba signos `< >`. El script debe terminar indicando la URL `https://NOMBRE:47821`.

4. El script instala el certificado en el computador y guarda el enlace en el perfil Windows que está ejecutando PowerShell. Lo más sencillo es iniciar sesión como el usuario del puesto y elevar PowerShell con esa misma cuenta. Si ingresó credenciales de otra cuenta administradora, tanto la búsqueda del script como el archivo de configuración deben apuntar al perfil del usuario del puesto. Para buscar el script, reemplace las líneas `$stationScript = Get-ChildItem ...` por estas dos, cambiando `USUARIO_DEL_PUESTO`:

```powershell
$stationProfile = "C:\Users\USUARIO_DEL_PUESTO\AppData\Local"
$stationScript = Get-ChildItem "$stationProfile\gestorfx\app-*\resources\scripts\configure-station.ps1" |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
```

En cualquier caso, el archivo de configuración debe quedar en el perfil Windows de la persona que usará GestorFX. Si ingresó credenciales de otra cuenta administradora, copie el archivo creado por el script desde el `%APPDATA%` de esa cuenta a:

```text
C:\Users\USUARIO_DEL_PUESTO\AppData\Roaming\GestorFX\gestorfx-network.json
```

Cree la carpeta `GestorFX` si no existe. El contenido debe tener la URL correcta, por ejemplo:

```json
{"apiUrl":"https://GESTOR-SRV:47821"}
```

Cada perfil Windows que vaya a usar la aplicación necesita ese archivo. Si solo hay un usuario Windows por puesto, basta configurarlo para ese perfil.

5. Abra GestorFX y desde PowerShell de esa estación compruebe:

```powershell
Invoke-RestMethod -Uri "https://GESTOR-SRV:47821/health"
```

Debe responder `status: ok`. En la primera estación GestorFX mostrará el asistente inicial, porque la base es nueva. Si muestra una instalación local vacía o no conecta, cierre la aplicación y revise el nombre DNS, el certificado y `gestorfx-network.json` en el perfil correcto.

## 6. Cuarta etapa: configurar la ferretería y las cuentas

1. En una sola estación, complete el asistente inicial con los datos de la ferretería y cree la cuenta administradora. Esto inicializa la base central vacía.
2. Cierre y vuelva a abrir GestorFX; inicie sesión como administrador.
3. Cree cuentas distintas para vendedor 1, vendedor 2, secretaría y administración. Asigne los roles/permisos que correspondan. No compartan una cuenta entre trabajadores.
4. En las otras estaciones, abra GestorFX e inicie sesión con la cuenta de cada persona.
5. Antes de empezar a trabajar, haga una operación de prueba aprobada y compruebe que aparece desde otra estación. Pruebe los dos puestos de ventas a la vez. Pruebe impresora local y exportación/guardado desde cada puesto.

## 7. Si algo falla

- **El nombre no resuelve:** no continúe; configure el DNS local del router o la entrada `hosts` en cada estación. Puede revisar con `Resolve-DnsName GESTOR-SRV`.
- **No conecta:** confirme que el servidor está encendido, la tarea `GestorFX LAN Server` ejecutándose, que los equipos comparten la LAN y que el firewall permite TCP 47821 desde la subred anotada.
- **Error HTTPS/certificado:** use el `server-root-ca.cer` generado por este servidor y la huella copiada exactamente. No omita la validación. Ejecute de nuevo la configuración de estación como administrador.
- **Aparece una instalación local:** revise `%APPDATA%\GestorFX\gestorfx-network.json` del perfil que abrió el programa. Su URL debe ser `https://NOMBRE-DEL-SERVIDOR:47821`.
- **El instalador no abre:** confirme que `Setup.exe`, `.nupkg` y `RELEASES` se copiaron juntos desde la misma compilación.
- **El servidor se desconecta:** las estaciones no pueden consultar datos mientras esté apagado. No use copias locales de la base para continuar ventas.

## 8. Cuidado diario y lista antes de irse

- Mantenga el servidor encendido, conectado a la red y sin suspensión durante el horario de trabajo.
- GestorFX guarda respaldos diarios en `C:\ProgramData\GestorFX\Data\backups` y conserva 30 días. Programe además una copia a otro disco o almacenamiento seguro; la copia en el mismo servidor no protege contra daño o robo.
- No borre `C:\ProgramData\GestorFX`, no comparta `Data`, no restaure respaldos con GestorFX activo y no ejecute otra copia como servidor.
- Mantenga la USB bajo custodia. No guarde en ella el PFX, contraseñas ni la base de datos.

Antes de irse, confirme:

- [ ] El nombre DNS resuelve desde las cuatro estaciones a la IP reservada del servidor.
- [ ] La tarea `GestorFX LAN Server` está en ejecución y se iniciará con Windows.
- [ ] `/health` responde `status: ok` desde cada estación.
- [ ] La base vacía se inicializó y se crearon las cuentas individuales.
- [ ] Una operación de prueba se ve desde otro puesto.
- [ ] Impresión y exportación se probaron desde las estaciones.
- [ ] Se definió quién hará la copia externa de respaldos.
