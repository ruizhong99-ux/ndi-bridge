param(
  [string]$InstallRoot = (Join-Path ${env:ProgramFiles} "H5-NDI-Bridge")
)

$ErrorActionPreference = "Stop"
$hostName = "com.h5.ndi.bridge"
$absoluteInstall = [IO.Path]::GetFullPath($InstallRoot)
$registryPath = "HKLM:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
$runtimeNode = Join-Path $absoluteInstall "H5-NDI-Helper\runtime\node.exe"
$safeName = ($runtimeNode -replace "[^A-Za-z0-9]+", "_").Trim("_")

if (Test-Path -LiteralPath $registryPath) { Remove-Item -LiteralPath $registryPath -Recurse -Force }
foreach ($protocol in @("TCP", "UDP")) {
  $ruleName = "H5-NDI-Bridge ($safeName) $protocol"
  Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
}
if (Test-Path -LiteralPath $absoluteInstall) { Remove-Item -LiteralPath $absoluteInstall -Recurse -Force }
Write-Host "H5-NDI-Bridge Windows installation removed."
