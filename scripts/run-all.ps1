# Supervises the Smart Inventory backend, frontend, and public Cloudflare tunnel.
# Restarts any of the three if it dies, and keeps the current public URL written to tunnel-url.txt.

$root = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $root "server"
$clientDir = Join-Path $root "client"
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$logDir = Join-Path $root ".run-logs"
$urlFile = Join-Path $root "tunnel-url.txt"

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
$tunnelProc = $null

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

    if (-not (Test-ProcessAlive $tunnelProc)) {
        Write-Host "$(Get-Date -Format o) Starting cloudflared tunnel..."
        $tunnelLog = Join-Path $logDir "tunnel.err.log"
        Remove-Item $tunnelLog -ErrorAction SilentlyContinue
        $tunnelProc = Start-Process -FilePath $cloudflared -ArgumentList "tunnel --url http://localhost:5173" `
            -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $logDir "tunnel.log") `
            -RedirectStandardError $tunnelLog

        # Wait for the assigned trycloudflare.com URL to appear in the log, then record it.
        for ($i = 0; $i -lt 20; $i++) {
            Start-Sleep -Seconds 1
            $line = Select-String -Path $tunnelLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($line) {
                $url = ($line.Matches[0].Value)
                Set-Content -Path $urlFile -Value $url
                Write-Host "$(Get-Date -Format o) Tunnel URL: $url"
                break
            }
        }
    }

    Start-Sleep -Seconds 15
}
