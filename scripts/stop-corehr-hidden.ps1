param(
    [int] $BackendPort = 8000,
    [int] $FrontendPort = 5173
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$RuntimeDir = Join-Path $RootDir ".corehr-runtime"

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

function Stop-ProcessTree {
    param([int] $ProcessId)

    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
        Stop-ProcessTree -ProcessId ([int] $child.ProcessId)
    }

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($process) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
}

function Stop-PortListener {
    param([int] $Port)

    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        $processId = [int] $listener.OwningProcess
        if ($processId -le 0) {
            continue
        }

        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process) {
            Stop-ProcessTree -ProcessId $process.Id
            Add-Content -Path (Join-Path $RuntimeDir "corehr-launcher.log") -Value "$(Get-Date -Format s) Stopped listener on port $Port with PID $($process.Id)."
        }
    }
}

foreach ($name in @("backend", "frontend")) {
    $pidFile = Join-Path $RuntimeDir "$name.pid"

    if (-not (Test-Path $pidFile)) {
        continue
    }

    $processId = Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1

    if ($processId) {
        $process = Get-Process -Id ([int] $processId) -ErrorAction SilentlyContinue
        if ($process) {
            Stop-ProcessTree -ProcessId $process.Id
            Add-Content -Path (Join-Path $RuntimeDir "corehr-launcher.log") -Value "$(Get-Date -Format s) Stopped $name with PID $($process.Id)."
        }
    }

    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

Stop-PortListener -Port $BackendPort
Stop-PortListener -Port $FrontendPort

Write-Output "CoreHR background processes stopped."
