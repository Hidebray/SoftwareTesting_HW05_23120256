<#
.SYNOPSIS
  Cleanly restarts the EShop Backend (port 3000) to reset SQLite DB & login lockouts,
  then seeds baseline HW05 test data (30 admin staff + 3 lockout probes + 20 orders).

.DESCRIPTION
  Required between Load, Stress, Spike, and Endurance runs so account lockouts
  (locked_until / login_attempts) and accumulated coupon_usage rows do not contaminate
  subsequent test scenarios.
#>

$ErrorActionPreference = "Stop"

$BackendDir = "d:\Project\Software Testing\eshop-sut\backend"
$SeedScript = Join-Path $PSScriptRoot "seed_sut.js"
$Port = 3000
$HealthUrl = "http://localhost:$Port/api/categories"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  HW05 SUT Reset & Seed Procedure (EShop Backend Port $Port)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Step 1: Stop existing process listening on port 3000 (if any)
$existingConns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existingConns) {
    $pids = $existingConns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        Write-Host "[1/4] Stopping existing process on port ${Port}: $($proc.ProcessName) (PID=$procId)..." -ForegroundColor Yellow
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
} else {
    Write-Host "[1/4] No existing process listening on port $Port." -ForegroundColor Gray
}

# Step 2: Start fresh node server.js (triggers database.js initDatabase() -> resets DB & lockouts)
Write-Host "[2/4] Starting fresh EShop Backend in $BackendDir..." -ForegroundColor Yellow
$backendProc = Start-Process -FilePath "node" `
    -ArgumentList "server.js" `
    -WorkingDirectory $BackendDir `
    -PassThru `
    -WindowStyle Minimized

# Step 3: Poll health endpoint until HTTP 200 (max 15 seconds)
Write-Host "[3/4] Waiting for $HealthUrl to become ready (PID=$($backendProc.Id))..." -ForegroundColor Yellow
$ready = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
        if ($resp.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {
        Start-Sleep -Milliseconds 500
    }
}

if (-not $ready) {
    Write-Error "Backend failed to become ready on port $Port within 15 seconds."
    exit 1
}
Write-Host "      Backend is UP! (PID=$($backendProc.Id))" -ForegroundColor Green

# Step 4: Run seed_sut.js
Write-Host "[4/4] Running seed_sut.js to populate 30 staff admins, 3 lockout probes, and 20 orders..." -ForegroundColor Yellow
& node $SeedScript
if ($LASTEXITCODE -ne 0) {
    Write-Error "seed_sut.js exited with code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "============================================================" -ForegroundColor Green
Write-Host "  [READY] SUT is clean, unlocked, and seeded!" -ForegroundColor Green
Write-Host "  Track in Task Manager -> Details -> node.exe (PID: $($backendProc.Id))" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

