<#
.SYNOPSIS
  Samples CPU and Memory usage of the EShop backend node.exe process at regular intervals
  and writes a time-series CSV for empirical Endurance / Soak threshold reporting.
#>
param(
    [Parameter(Mandatory = $true)]
    [int]$TargetPid,
    [int]$IntervalSec = 30,
    [int]$MaxDurationSec = 780,
    [string]$OutputCsv = "reports/endurance_resource_log.csv"
)

$outDir = Split-Path -Parent $OutputCsv
if ($outDir -and -not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

"Timestamp,ElapsedSec,PID,CPU_Pct_System,WorkingSet_MB,PrivateMem_MB,Threads,Handles" | Set-Content -Path $OutputCsv -Encoding UTF8

$logicalCpus = (Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum
if (-not $logicalCpus -or $logicalCpus -le 0) { $logicalCpus = 16 }

$start = Get-Date
$prevCpu = $null
$prevTime = $null

while (((Get-Date) - $start).TotalSeconds -le $MaxDurationSec) {
    $proc = Get-Process -Id $TargetPid -ErrorAction SilentlyContinue
    if (-not $proc) { break }

    $now = Get-Date
    $elapsed = [int](($now - $start).TotalSeconds)
    $curCpu = $proc.CPU
    $cpuPct = 0.0

    if ($null -ne $prevCpu -and $null -ne $prevTime) {
        $dt = ($now - $prevTime).TotalSeconds
        if ($dt -gt 0) {
            $cpuPct = [math]::Round((($curCpu - $prevCpu) / ($dt * $logicalCpus)) * 100.0, 2)
        }
    }

    $prevCpu = $curCpu
    $prevTime = $now

    $wsMb = [math]::Round($proc.WorkingSet64 / 1MB, 2)
    $pmMb = [math]::Round($proc.PrivateMemorySize64 / 1MB, 2)
    $threads = $proc.Threads.Count
    $handles = $proc.HandleCount

    $line = "{0},{1},{2},{3},{4},{5},{6},{7}" -f $now.ToString("yyyy-MM-dd HH:mm:ss"), $elapsed, $TargetPid, $cpuPct, $wsMb, $pmMb, $threads, $handles
    Add-Content -Path $OutputCsv -Value $line -Encoding UTF8

    Start-Sleep -Seconds $IntervalSec
}
