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

# Step 1: Stop ANY existing eshop-sut backend node.exe or listener on port 3000
$pidsToKill = New-Object System.Collections.Generic.HashSet[int]

# 1a. Match by TCP listener (netstat handles both IPv4 0.0.0.0:3000 and IPv6 [::]:3000 reliably)
$netstatLines = netstat -ano | Select-String -Pattern ":${Port}\s+.*LISTENING\s+(\d+)$"
foreach ($m in $netstatLines) {
    $pidVal = [int](($m.Line -split "\s+")[-1])
    if ($pidVal -gt 0) { [void]$pidsToKill.Add($pidVal) }
}

# 1b. Match any node.exe running server.js (catches processes during startup/shutdown)
$nodeProcs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match "server\.js" }
foreach ($np in $nodeProcs) {
    [void]$pidsToKill.Add([int]$np.ProcessId)
}

if ($pidsToKill.Count -gt 0) {
    foreach ($procId in $pidsToKill) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "[1/4] Stopping existing backend process: $($proc.ProcessName) (PID=$procId)..." -ForegroundColor Yellow
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "[1/4] No existing backend process found on port $Port." -ForegroundColor Gray
}

# Step 2: Start fresh node server.js (triggers database.js initDatabase() -> resets DB & lockouts)
Write-Host "[2/4] Starting fresh EShop Backend in $BackendDir..." -ForegroundColor Yellow
$backendProc = Start-Process -FilePath "node" `
    -ArgumentList "server.js" `
    -WorkingDirectory $BackendDir `
    -PassThru `
    -WindowStyle Minimized

# Wait briefly so SQLite initDatabase() completes all DROP/CREATE/SEED statements cleanly
Start-Sleep -Seconds 1

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

