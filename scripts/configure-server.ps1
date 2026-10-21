param(
    [Parameter(Mandatory = $true)]
    [string]$ExecutablePath,
    [Parameter(Mandatory = $true)]
    [string]$ServerAddress,
    [string]$LanSubnet = "192.168.1.0/24",
    [int]$Port = 47821,
    [string]$DatabaseSource
)

$ErrorActionPreference = "Stop"
$ExecutablePath = (Resolve-Path -LiteralPath $ExecutablePath).Path
if (-not (Test-Path -LiteralPath $ExecutablePath -PathType Leaf)) {
    throw "No se encontró el ejecutable: $ExecutablePath"
}
if ($Port -lt 1024 -or $Port -gt 65535) { throw "Puerto fuera de rango." }
if ($ServerAddress -notmatch '^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*$') {
    throw "Indique el nombre DNS del servidor, por ejemplo GESTOR-SRV o gestor-srv.empresa.local."
}
$parsedAddress = $null
if ([System.Net.IPAddress]::TryParse($ServerAddress, [ref]$parsedAddress)) {
    throw "Use el nombre DNS del servidor para que el certificado TLS coincida con la dirección de las estaciones."
}

$root = Join-Path $env:ProgramData "GestorFX"
$dataDirectory = Join-Path $root "Data"
$databasePath = Join-Path $dataDirectory "database.sqlite"
$runnerPath = Join-Path $root "run-server.ps1"
$logPath = Join-Path $root "server.log"
$pfxPath = Join-Path $root "server.pfx"
$certificatePath = Join-Path $root "server-root-ca.cer"
$taskName = "GestorFX LAN Server"

New-Item -ItemType Directory -Path $root -Force | Out-Null
New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
if (-not (Test-Path -LiteralPath $databasePath)) {
    if ($DatabaseSource) {
        $source = (Resolve-Path -LiteralPath $DatabaseSource).Path
        Copy-Item -LiteralPath $source -Destination $databasePath
    }
}

$rootAcl = Get-Acl -LiteralPath $root
$rootAcl.SetAccessRuleProtection($true, $false)
foreach ($rule in @($rootAcl.Access)) { [void]$rootAcl.RemoveAccessRule($rule) }
foreach ($identity in @("NT AUTHORITY\SYSTEM", "BUILTIN\Administrators")) {
    $access = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $identity, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
    )
    [void]$rootAcl.AddAccessRule($access)
}
Set-Acl -LiteralPath $root -AclObject $rootAcl

$acl = Get-Acl -LiteralPath $dataDirectory
$acl.SetAccessRuleProtection($true, $false)
foreach ($rule in @($acl.Access)) { [void]$acl.RemoveAccessRule($rule) }
foreach ($identity in @("NT AUTHORITY\SYSTEM", "BUILTIN\Administrators")) {
    $access = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $identity, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
    )
    [void]$acl.AddAccessRule($access)
}
Set-Acl -LiteralPath $dataDirectory -AclObject $acl
$databaseAcl = Get-Acl -LiteralPath $databasePath -ErrorAction SilentlyContinue
if ($databaseAcl) {
    $databaseAcl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($databaseAcl.Access)) { [void]$databaseAcl.RemoveAccessRule($rule) }
    foreach ($identity in @("NT AUTHORITY\SYSTEM", "BUILTIN\Administrators")) {
        $access = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, "FullControl", "Allow")
        [void]$databaseAcl.AddAccessRule($access)
    }
    Set-Acl -LiteralPath $databasePath -AclObject $databaseAcl
}

$existingCertificateFiles = @($pfxPath, $certificatePath) | Where-Object { Test-Path -LiteralPath $_ }
if ($existingCertificateFiles.Count -gt 0) {
    throw "Ya existe un certificado GestorFX. No se sobrescribió. Renueve el certificado con un procedimiento controlado."
}
$rootCertificate = New-SelfSignedCertificate -Subject "CN=GestorFX LAN Root CA" -CertStoreLocation "Cert:\LocalMachine\My" -KeyAlgorithm RSA -KeyLength 3072 -KeyUsage CertSign,CRLSign,DigitalSignature -KeyUsageProperty Sign -TextExtension @("2.5.29.19={critical}{text}ca=1&pathlength=0") -NotAfter (Get-Date).AddYears(10) -FriendlyName "GestorFX LAN Root CA"
$certificate = New-SelfSignedCertificate -Type SSLServerAuthentication -DnsName $ServerAddress -Signer $rootCertificate -CertStoreLocation "Cert:\LocalMachine\My" -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy Exportable -NotAfter (Get-Date).AddYears(3) -FriendlyName "GestorFX LAN API"
$randomBytes = New-Object byte[] 32
$randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$randomGenerator.GetBytes($randomBytes)
$randomGenerator.Dispose()
$tlsPassword = [Convert]::ToBase64String($randomBytes)
$secureTlsPassword = ConvertTo-SecureString $tlsPassword -AsPlainText -Force
Export-PfxCertificate -Cert $certificate -FilePath $pfxPath -Password $secureTlsPassword | Out-Null
Export-Certificate -Cert $rootCertificate -FilePath $certificatePath -Type CERT | Out-Null

$escapedExe = $ExecutablePath.Replace("'", "''")
$escapedDatabase = $databasePath.Replace("'", "''")
$escapedPfx = $pfxPath.Replace("'", "''")
$escapedLog = $logPath.Replace("'", "''")
$escapedTlsPassword = $tlsPassword.Replace("'", "''")
$runner = @"
if ((Test-Path -LiteralPath '$escapedLog' -PathType Leaf) -and (Get-Item -LiteralPath '$escapedLog').Length -gt 5MB) {
  Move-Item -LiteralPath '$escapedLog' -Destination '$escapedLog.1' -Force
}
`$env:GESTORFX_SERVER_MODE = '1'
`$env:GESTORFX_API_HOST = '0.0.0.0'
`$env:GESTORFX_API_PORT = '$Port'
`$env:GESTORFX_DATABASE_PATH = '$escapedDatabase'
`$env:GESTORFX_TLS_PFX_PATH = '$escapedPfx'
`$env:GESTORFX_TLS_PFX_PASSWORD = '$escapedTlsPassword'
& '$escapedExe' *>> '$escapedLog'
"@
Set-Content -LiteralPath $runnerPath -Value $runner -Encoding UTF8

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runnerPath`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "API LAN y base de datos central de GestorFX" -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

$firewallName = "GestorFX LAN TCP $Port"
Get-NetFirewallRule -DisplayName $firewallName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $firewallName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -RemoteAddress $LanSubnet -Profile Domain,Private | Out-Null

Write-Host "Configuración creada. El servicio iniciará al arrancar Windows."
Write-Host "Base de datos: $databasePath"
Write-Host "URL para estaciones: https://${ServerAddress}:$Port"
Write-Host "Certificado raíz público para instalar en estaciones: $certificatePath"
Write-Host "Huella SHA1 de la raíz (confirmar al configurar cada estación): $($rootCertificate.Thumbprint)"
Write-Host "Tarea: $taskName"
Write-Host "Si se suministró una base existente, verificar que la aplicación estaba cerrada antes de copiarla."
