param(
  [switch]$IncludeSystemNode,
  [string[]]$Profiles = @("Domain", "Private")
)

$ErrorActionPreference = "Stop"

# NDI sends discovery and media traffic back into the sender process.
# The rule is limited to the project's Node runtimes and the needed protocols.
$project = Split-Path -Parent $PSScriptRoot
$nodePaths = @(
  (Join-Path $project ".tools\node-v20.20.2-win-x64\node.exe"),
  (Join-Path $project "release\H5-NDI-Helper\runtime\node.exe")
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -Unique

if ($IncludeSystemNode -and (Test-Path -LiteralPath "C:\Program Files\nodejs\node.exe")) {
  $nodePaths += "C:\Program Files\nodejs\node.exe"
}

if (-not $nodePaths) {
  throw "No Node.js runtime was found. Build the helper first or install Node.js."
}

foreach ($nodePath in $nodePaths) {
  $safeName = ($nodePath -replace "[^A-Za-z0-9]+", "_").Trim("_")
  foreach ($protocol in @("TCP", "UDP")) {
    $name = "H5-NDI-Helper ($safeName) $protocol"
    if (-not (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue)) {
      New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Profile $Profiles -Program $nodePath -Protocol $protocol | Out-Null
      Write-Host "Added $protocol rule for $nodePath"
    } else {
      Write-Host "Already present: $name"
    }
  }
}

Write-Host "H5 NDI Helper firewall rules are ready."
