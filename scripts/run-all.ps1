# Supervises the Smart Inventory backend and frontend (localhost only).
# Restarts either one if it dies.

$root = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $root "server"
$clientDir = Join-Path $root "client"
$logDir = Join-Path $root ".run-logs"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Test-Port($port) {
    try {
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        return $null -ne $conn
    } catch { return $false }
}

function Test-ProcessAlive($processVar) {
    if (-not $processVar) { return $false }
    try {
        $p = Get-Process -Id $processVar.Id -ErrorAction SilentlyContinue
        return $null -ne $p
    } catch { return $false }
}

$backendProc = $null
$frontendProc = $null

while ($true) {
    if (-not (Test-ProcessAlive $backendProc) -and -not (Test-Port 4000)) {
        Write-Host "$(Get-Date -Format o) Starting backend..."
        $backendProc = Start-Process -FilePath "node" -ArgumentList "index.js" -WorkingDirectory $serverDir `
            -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $logDir "backend.log") `
            -RedirectStandardError (Join-Path $logDir "backend.err.log")
    }

    if (-not (Test-ProcessAlive $frontendProc) -and -not (Test-Port 5173)) {
        Write-Host "$(Get-Date -Format o) Starting frontend..."
        $frontendProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $clientDir `
            -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $logDir "frontend.log") `
            -RedirectStandardError (Join-Path $logDir "frontend.err.log")
    }

    Start-Sleep -Seconds 15
}
