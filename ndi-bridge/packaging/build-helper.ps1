$ErrorActionPreference = "Stop"

$project = Split-Path -Parent $PSScriptRoot
$release = Join-Path $project "release\H5-NDI-Helper"
$nodeRoot = Join-Path $project ".tools\node-v20.20.2-win-x64"
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$ndiRoot = "C:\Program Files\NDI\NDI 6 Runtime\v6"

if (-not (Test-Path $csc)) { throw "C# compiler not found: $csc" }
if (-not (Test-Path (Join-Path $nodeRoot "node.exe"))) { throw "Node 20 runtime not found" }
if (-not (Test-Path (Join-Path $project "dist\nativeHost.js"))) { throw "Run npm run build first" }
if (-not (Test-Path (Join-Path $ndiRoot "Processing.NDI.Lib.x64.dll"))) { throw "NDI Runtime not found" }

if (Test-Path $release) { Remove-Item -LiteralPath $release -Recurse -Force }
New-Item -ItemType Directory -Force $release | Out-Null
New-Item -ItemType Directory -Force (Join-Path $release "runtime") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $release "dist") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $release "ndi-runtime") | Out-Null

Copy-Item (Join-Path $nodeRoot "node.exe") (Join-Path $release "runtime\node.exe") -Force
Copy-Item (Join-Path $project "dist\*") (Join-Path $release "dist") -Recurse -Force
Copy-Item (Join-Path $project "node_modules") (Join-Path $release "node_modules") -Recurse -Force
Copy-Item (Join-Path $ndiRoot "*.dll") (Join-Path $release "ndi-runtime") -Force

$outputExe = Join-Path $release "H5-NDI-Helper.exe"
$sourceFile = Join-Path $PSScriptRoot "HelperLauncher.cs"
& $csc /nologo /target:exe "/out:$outputExe" $sourceFile
if ($LASTEXITCODE -ne 0) { throw "Helper launcher compilation failed" }

Write-Host "Built $release\H5-NDI-Helper.exe"
