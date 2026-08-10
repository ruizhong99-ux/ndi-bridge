param(
  [string]$ExtensionId,
  [string]$SourceRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$InstallRoot = (Join-Path ${env:ProgramFiles} "H5-NDI-Bridge"),
  [switch]$SkipFirewall
)

$ErrorActionPreference = "Stop"

function Test-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Quote-ProcessArgument([string]$Value) {
  return '"' + $Value.Replace('"', '\\"') + '"'
}

if (-not (Test-Administrator)) {
  Write-Host "Administrator permission is required. Requesting elevation..."
  $arguments = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", (Quote-ProcessArgument $PSCommandPath),
    "-SourceRoot", (Quote-ProcessArgument $SourceRoot),
    "-InstallRoot", (Quote-ProcessArgument $InstallRoot)
  )
  if ($ExtensionId) { $arguments += @("-ExtensionId", (Quote-ProcessArgument $ExtensionId)) }
  if ($SkipFirewall) { $arguments += "-SkipFirewall" }
  $child = Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $arguments -Wait -PassThru
  exit $child.ExitCode
}

$hostName = "com.h5.ndi.bridge"
$sourceHelper = Join-Path $SourceRoot "release\H5-NDI-Helper"
$absoluteInstall = [IO.Path]::GetFullPath($InstallRoot)
$helperPath = Join-Path $absoluteInstall "H5-NDI-Helper"
$manifestPath = Join-Path $helperPath "$hostName.json"
$helperExe = Join-Path $helperPath "H5-NDI-Helper.exe"

if (-not $ExtensionId) { $ExtensionId = (Get-Clipboard -Raw).Trim() }
if ($ExtensionId -notmatch '^[a-p]{32}$') {
  $ExtensionId = (Read-Host "Paste the 32-character Chrome Extension ID").Trim()
}
if ($ExtensionId -notmatch '^[a-p]{32}$') { throw "Invalid Chrome Extension ID: $ExtensionId" }

if (-not (Test-Path -LiteralPath (Join-Path $sourceHelper "H5-NDI-Helper.exe"))) {
  throw "Packaged Helper was not found: $sourceHelper. Build the Windows release first."
}

New-Item -ItemType Directory -Force -Path $absoluteInstall | Out-Null
if ([IO.Path]::GetFullPath($sourceHelper) -ne $helperPath) {
  if (Test-Path -LiteralPath $helperPath) { Remove-Item -LiteralPath $helperPath -Recurse -Force }
  Copy-Item -LiteralPath $sourceHelper -Destination $absoluteInstall -Recurse -Force
}

$manifest = @{
  name = $hostName
  description = "H5 NDI Bridge Native Messaging host"
  path = $helperExe
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 3
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($manifestPath, $manifest, $utf8NoBom)

$registryPath = "HKLM:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
New-Item -Path $registryPath -Force | Out-Null
Set-ItemProperty -Path $registryPath -Name "(default)" -Value $manifestPath

if (-not $SkipFirewall) {
  $runtimeNode = Join-Path $helperPath "runtime\node.exe"
  $safeName = ($runtimeNode -replace "[^A-Za-z0-9]+", "_").Trim("_")
  foreach ($protocol in @("TCP", "UDP")) {
    $ruleName = "H5-NDI-Bridge ($safeName) $protocol"
    if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
      New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Profile Domain,Private -Program $runtimeNode -Protocol $protocol | Out-Null
    }
  }
}

$extensionSource = Join-Path $SourceRoot "extension"
if (Test-Path -LiteralPath $extensionSource) { Copy-Item -LiteralPath $extensionSource -Destination $absoluteInstall -Recurse -Force }

Write-Host "H5-NDI-Bridge Windows installation completed."
Write-Host "Extension ID: $ExtensionId"
Write-Host "Helper: $helperExe"
Write-Host "Native host manifest: $manifestPath"
Write-Host "Extension files: $(Join-Path $absoluteInstall 'extension')"
