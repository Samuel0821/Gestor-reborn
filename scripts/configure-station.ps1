param(
    [Parameter(Mandatory = $true)]
    [string]$ServerAddress,
    [Parameter(Mandatory = $true)]
    [string]$ServerCertificate,
    [Parameter(Mandatory = $true)]
    [string]$ExpectedThumbprint,
    [int]$Port = 47821
)

$ErrorActionPreference = "Stop"
if ($ServerAddress -notmatch '^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*$') {
    throw "Indique el nombre DNS del servidor, sin protocolo ni ruta."
}
if ($Port -lt 1 -or $Port -gt 65535) { throw "Puerto fuera de rango." }
try { [void][System.Net.Dns]::GetHostAddresses($ServerAddress) }
catch { throw "El nombre $ServerAddress no resuelve en esta estación. Configure DNS antes de continuar." }
$ServerCertificate = (Resolve-Path -LiteralPath $ServerCertificate).Path
$certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($ServerCertificate)
if ($certificate.Thumbprint -ne ($ExpectedThumbprint -replace '\s', '').ToUpperInvariant()) {
    throw "La huella del certificado no coincide. No se instaló como confiable."
}
if ($certificate.Subject -ne "CN=GestorFX LAN Root CA") {
    throw "El certificado no es la autoridad raíz de GestorFX."
}
Import-Certificate -FilePath $ServerCertificate -CertStoreLocation "Cert:\LocalMachine\Root" | Out-Null

$uriBuilder = [System.UriBuilder]::new("https", $ServerAddress, $Port)
$configDirectory = Join-Path $env:APPDATA "GestorFX"
$configPath = Join-Path $configDirectory "gestorfx-network.json"
New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null
@{ apiUrl = $uriBuilder.Uri.GetLeftPart([System.UriPartial]::Authority) } |
    ConvertTo-Json | ForEach-Object { [System.IO.File]::WriteAllText($configPath, $_, [System.Text.UTF8Encoding]::new($false)) }

Write-Host "Estación configurada para $($uriBuilder.Uri.GetLeftPart([System.UriPartial]::Authority))"
Write-Host "Archivo: $configPath"
Write-Host "Cierre y vuelva a abrir GestorFX para aplicar la configuración."
