<#
.SYNOPSIS
  End-to-End 12-Minute Endurance / Soak Test Runner with Automatic Resource Telemetry.
  1. Resets & seeds SUT cleanly via scripts/reset_sut.ps1
  2. Finds the active backend node.exe PID and launches scripts/monitor_node_resources.ps1 in background
  3. Runs k6 Endurance test (40 VUs, 12m) outputting full raw CSV + HTML report
  4. Stops resource monitor and prints peak CPU/RAM summary
#>

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$RootDir = Split-Path -Parent $PSScriptRoot
Push-Location $RootDir

# 1. Clean Reset & Seed
powershell -ExecutionPolicy Bypass -File scripts/reset_sut.ps1
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

# 2. Identify active backend PID listening on port 3000
$netMatch = netstat -ano | Select-String -Pattern ":3000\s+.*LISTENING\s+(\d+)$" | Select-Object -First 1
if (-not $netMatch) {
    Write-Error "Could not identify backend PID listening on port 3000."
    Pop-Location
    exit 1
}
$backendPid = [int](($netMatch.Line -split "\s+")[-1])
Write-Host "[ENDURANCE] Starting background resource monitor (every 30s) for node.exe PID=$backendPid..." -ForegroundColor Cyan

$monitorJob = Start-Job -ScriptBlock {
    param($scriptPath, $targetPid, $outPath)
    & $scriptPath -TargetPid $targetPid -IntervalSec 30 -MaxDurationSec 780 -OutputCsv $outPath
} -ArgumentList (Join-Path $PSScriptRoot "monitor_node_resources.ps1"), $backendPid, (Join-Path $RootDir "reports\endurance_resource_log.csv")

# 3. Run k6 12-minute Endurance Test
Write-Host "[ENDURANCE] Running k6 Endurance test (40 VUs, 12m00s)..." -ForegroundColor Yellow
Write-Host "            TIP: Capture RAW Split-Screen screenshot around 08:00-10:00 and at completion!" -ForegroundColor Yellow
k6 run --out csv=raw-logs/23120256_Endurance_20261122.csv test-plans/23120256_Endurance_20261122.js
$k6Exit = $LASTEXITCODE

# 4. Stop resource monitor & print summary
Stop-Job -Job $monitorJob -ErrorAction SilentlyContinue
Remove-Job -Job $monitorJob -Force -ErrorAction SilentlyContinue

if (Test-Path "reports\endurance_resource_log.csv") {
    $rows = Import-Csv "reports\endurance_resource_log.csv"
    if ($rows.Count -gt 0) {
        $maxCpu = ($rows | Measure-Object -Property CPU_Pct_System -Maximum).Maximum
        $avgCpu = [math]::Round(($rows | Measure-Object -Property CPU_Pct_System -Average).Average, 2)
        $minRam = ($rows | Measure-Object -Property WorkingSet_MB -Minimum).Minimum
        $maxRam = ($rows | Measure-Object -Property WorkingSet_MB -Maximum).Maximum
        Write-Host "============================================================" -ForegroundColor Green
        Write-Host "  ENDURANCE HARDWARE TELEMETRY SUMMARY (node.exe PID=$backendPid)" -ForegroundColor Green
        Write-Host "  Samples Collected : $($rows.Count) (every 30s)" -ForegroundColor Green
        Write-Host "  CPU % (System)    : Avg=${avgCpu}% | Peak=${maxCpu}%" -ForegroundColor Green
        Write-Host "  Working Set RAM   : Min=${minRam} MB -> Peak=${maxRam} MB" -ForegroundColor Green
        Write-Host "  CSV Telemetry Log : reports/endurance_resource_log.csv" -ForegroundColor Green
        Write-Host "============================================================" -ForegroundColor Green
    }
}

Pop-Location
exit $k6Exit
