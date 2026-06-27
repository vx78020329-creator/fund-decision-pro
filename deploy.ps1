# Fund Decision Pro - Deployment Script
# Auto-starts server and ensures all data stays updated

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $projectDir "server"

Write-Host "=== Fund Decision Pro Deployment ===" -ForegroundColor Cyan
Write-Host "Project: $projectDir"

# Check if server is already running
$existing = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like "*fund-decision*index*"
}

if ($existing) {
    Write-Host "Server already running (PID: $($existing.Id))" -ForegroundColor Yellow
    Write-Host "Restarting..." -ForegroundColor Yellow
    Stop-Process -Id $existing.Id -Force
    Start-Sleep -Seconds 2
}

# Build frontend
Write-Host "`nBuilding frontend..." -ForegroundColor Cyan
Set-Location $projectDir
& npx vite build 2>&1 | Out-Null
Write-Host "Frontend built successfully" -ForegroundColor Green

# Start server
Write-Host "`nStarting server..." -ForegroundColor Cyan
$serverLog = Join-Path $logDir "backend.log"
$serverErr = Join-Path $logDir "backend_err.log"
$tsxLoader = Join-Path $projectDir "node_modules\tsx\dist\loader.mjs"

Start-Process -FilePath "node" `
    -ArgumentList "--import file:///$($tsxLoader -replace '\\','/' -replace ':','') server/src/index.ts" `
    -WorkingDirectory $projectDir `
    -RedirectStandardOutput $serverLog `
    -RedirectStandardError $serverErr `
    -WindowStyle Hidden

Start-Sleep -Seconds 4

# Verify server is running
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -TimeoutSec 5
    Write-Host "Server running: $($health.status)" -ForegroundColor Green
    Write-Host "Database: $($health.dbPath)"
    Write-Host "Frontend: http://localhost:3001" -ForegroundColor Cyan
} catch {
    Write-Host "ERROR: Server failed to start!" -ForegroundColor Red
    Write-Host "Check logs: $serverErr"
    exit 1
}

# Trigger initial sync if needed
$sync = Invoke-RestMethod -Uri "http://localhost:3001/api/funds/sync/progress" -TimeoutSec 5
if (-not $sync.running -and $sync.total -eq 0) {
    Write-Host "`nTriggering initial data sync..." -ForegroundColor Cyan
    Invoke-RestMethod -Uri "http://localhost:3001/api/funds/sync" -Method POST -TimeoutSec 3 -ErrorAction SilentlyContinue
    Write-Host "Sync started in background" -ForegroundColor Green
} else {
    Write-Host "`nSync status: running=$($sync.running) progress=$($sync.processed)/$($sync.total)" -ForegroundColor Green
}

Write-Host "`n=== Deployment Complete ===" -ForegroundColor Green
Write-Host "Access: http://localhost:3001"
Write-Host "Logs: $serverLog"
Write-Host "Errors: $serverErr"
