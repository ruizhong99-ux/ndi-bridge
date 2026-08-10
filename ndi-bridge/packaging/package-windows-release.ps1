param(
  [string]$Version = "1.0.0",
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$OutputRoot = (Join-Path (Split-Path -Parent $PSScriptRoot) "release-assets")
)

$ErrorActionPreference = "Stop"

$ProjectRoot = [IO.Path]::GetFullPath($ProjectRoot)
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
$helperSource = Join-Path $ProjectRoot "release\H5-NDI-Helper"
$extensionSource = Join-Path $ProjectRoot "extension"
$staging = Join-Path $OutputRoot "H5-NDI-Bridge-Windows"
$zipPath = Join-Path $OutputRoot "H5-NDI-Bridge-Windows-v$Version.zip"
$hashPath = Join-Path $OutputRoot "SHA256SUMS.txt"

if ($Version -notmatch '^[0-9A-Za-z][0-9A-Za-z._-]*$') { throw "Invalid release version: $Version" }
foreach ($requiredHelperFile in @(
  "H5-NDI-Helper.exe",
  "runtime\node.exe",
  "dist\nativeHost.js",
  "ndi-runtime\Processing.NDI.Lib.x64.dll"
)) {
  if (-not (Test-Path -LiteralPath (Join-Path $helperSource $requiredHelperFile))) {
    throw "Packaged Helper file was not found: $(Join-Path $helperSource $requiredHelperFile). Build it before packaging."
  }
}
if (-not (Test-Path -LiteralPath (Join-Path $extensionSource "manifest.json"))) {
  throw "Extension manifest was not found: $extensionSource"
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
New-Item -ItemType Directory -Force -Path $staging, (Join-Path $staging "packaging") | Out-Null

Copy-Item -LiteralPath $extensionSource -Destination $staging -Recurse -Force
Copy-Item -LiteralPath $helperSource -Destination $staging -Recurse -Force
Copy-Item -LiteralPath (Join-Path $ProjectRoot "packaging\install-windows.ps1") -Destination (Join-Path $staging "packaging") -Force
Copy-Item -LiteralPath (Join-Path $ProjectRoot "packaging\uninstall-windows.ps1") -Destination (Join-Path $staging "packaging") -Force
Copy-Item -LiteralPath (Join-Path $ProjectRoot "packaging\USAGE-WINDOWS.txt") -Destination $staging -Force

$readme = @"
H5-NDI-Bridge Windows Release v$Version

1. Extract this folder to a local directory.
2. Open Edge and load the extracted extension folder as an unpacked extension.
3. Open the extension popup and click Copy Extension ID.
4. Open PowerShell as Administrator in this extracted folder and run:

   powershell -NoProfile -ExecutionPolicy Bypass -File .\packaging\install-windows.ps1

The installer reads the Extension ID from the clipboard, installs the packaged Helper,
registers Native Messaging, and adds the required Domain/Private firewall rules.
The extension must remain loaded in Edge; this release does not install a signed store extension.

See USAGE-WINDOWS.txt for the complete Chinese usage guide.

To remove the installation, run PowerShell as Administrator:

   powershell -NoProfile -ExecutionPolicy Bypass -File .\packaging\uninstall-windows.ps1
"@
[IO.File]::WriteAllText((Join-Path $staging "README-WINDOWS.txt"), $readme.TrimStart(), (New-Object System.Text.UTF8Encoding($false)))

Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -CompressionLevel Optimal
$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $(Split-Path -Leaf $zipPath)" | Set-Content -LiteralPath $hashPath -Encoding ascii
Remove-Item -LiteralPath $staging -Recurse -Force

Write-Host "Windows release package created: $zipPath"
Write-Host "SHA-256: $hash"
