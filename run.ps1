# Starts AgroTwin on Windows from this folder.
#   .\run.ps1              production: builds the frontend once, then serves it
#   .\run.ps1 dev          hot-reloading dev servers
#   .\run.ps1 -Lan         also listen on the LAN (0.0.0.0) so phones running
#                          the mobile app can reach :8000 and :3000
# Backend :8000 (from backend\.venv-gpu when present, else backend\.venv),
# frontend :3000. Ctrl-C stops both. Logs go to .\logs\.
# Everything project-related stays on this drive: temp files, package caches
# and compiled CUDA kernels live under .\.cache\.
param([ValidateSet("prod", "dev")][string]$Mode = "prod", [switch]$Lan)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

foreach ($d in "logs", ".cache\tmp", ".cache\uv", ".cache\pip", ".cache\torch_extensions") {
  New-Item -ItemType Directory -Force -Path (Join-Path $root $d) | Out-Null
}
$env:TEMP = "$root\.cache\tmp"; $env:TMP = $env:TEMP
$env:UV_CACHE_DIR = "$root\.cache\uv"
$env:PIP_CACHE_DIR = "$root\.cache\pip"
$env:TORCH_EXTENSIONS_DIR = "$root\.cache\torch_extensions"

$python = "$root\backend\.venv-gpu\Scripts\python.exe"
if (-not (Test-Path $python)) { $python = "$root\backend\.venv\Scripts\python.exe" }
if (-not (Test-Path $python)) {
  Write-Host "No backend virtualenv found. Create one first, e.g.:"
  Write-Host "  uv venv backend\.venv-gpu --python 3.11"
  Write-Host "  uv pip install --python backend\.venv-gpu\Scripts\python.exe -r backend\requirements.txt"
  exit 1
}
if (-not (Test-Path "$root\frontend\node_modules")) {
  Write-Host "frontend\node_modules missing - run: cd frontend; npm ci"
  exit 1
}

# stored absolute paths -> this checkout (no-op when nothing moved)
& $python -m scripts.relocate_paths 2>$null | Out-Null

$bind = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }
$backendArgs = "-m uvicorn app.main:app --host $bind --port 8000"
if ($Mode -eq "dev") { $backendArgs += " --reload" }
$backend = Start-Process -FilePath $python -ArgumentList $backendArgs -WorkingDirectory "$root\backend" -PassThru -NoNewWindow `
  -RedirectStandardOutput "$root\logs\backend.log" -RedirectStandardError "$root\logs\backend.err.log"

$next = "node_modules\next\dist\bin\next"
if ($Mode -eq "dev") {
  $frontendArgs = "$next dev -H $bind -p 3000"
} else {
  if (-not (Test-Path "$root\frontend\.next\BUILD_ID")) {
    Write-Host "Building the frontend (first run only)..."
    Push-Location "$root\frontend"
    & node scripts\copy-cesium.mjs
    & node $next build
    Pop-Location
  }
  $frontendArgs = "$next start -H $bind -p 3000"
}
$frontend = Start-Process -FilePath "node" -ArgumentList $frontendArgs -WorkingDirectory "$root\frontend" -PassThru -NoNewWindow `
  -RedirectStandardOutput "$root\logs\frontend.log" -RedirectStandardError "$root\logs\frontend.err.log"

Write-Host "AgroTwin: http://localhost:3000   (API docs: http://localhost:8000/docs)   mode=$Mode"
if ($Lan) {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1).IPAddress
  if ($ip) { Write-Host "LAN: http://${ip}:3000  API http://${ip}:8000  (use these in mobile\.env; allow ports 3000/8000 in Windows Firewall)" }
}
Write-Host "Logs: logs\backend.log, logs\frontend.log   Ctrl-C stops both servers."
try {
  while (-not $backend.HasExited -and -not $frontend.HasExited) { Start-Sleep -Seconds 1 }
  if ($backend.HasExited) { Write-Host "backend exited ($($backend.ExitCode)) - see logs\backend.err.log" }
  if ($frontend.HasExited) { Write-Host "frontend exited ($($frontend.ExitCode)) - see logs\frontend.err.log" }
} finally {
  foreach ($p in $backend, $frontend) {
    if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  }
}
