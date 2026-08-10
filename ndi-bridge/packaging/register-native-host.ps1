param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-p]{32}$')]
  [string]$ExtensionId,
  [string]$InstallRoot = (Join-Path (Split-Path -Parent $PSScriptRoot) "release\H5-NDI-Helper")
)

$ErrorActionPreference = "Stop"

$hostName = "com.h5.ndi.bridge"
$absoluteRoot = [IO.Path]::GetFullPath($InstallRoot)
$helperPath = Join-Path $absoluteRoot "H5-NDI-Helper.exe"
$manifestPath = Join-Path $absoluteRoot "$hostName.json"

if (-not (Test-Path -LiteralPath $helperPath)) {
  throw "Packaged Helper was not found: $helperPath. Run packaging/build-helper.ps1 first."
}

$manifest = @{
  name = $hostName
  description = "H5 NDI Bridge Native Messaging host"
  path = $helperPath
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 3

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($manifestPath, $manifest, $utf8NoBom)

$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
New-Item -Path $registryPath -Force | Out-Null
Set-ItemProperty -Path $registryPath -Name "(default)" -Value $manifestPath

Write-Host "Native Messaging host registered for extension $ExtensionId"
Write-Host "Manifest: $manifestPath"
Write-Host "Helper:   $helperPath"
