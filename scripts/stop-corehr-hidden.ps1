param(
    [int] $BackendPort = $(if ($env:COREHR_BACKEND_PORT) { [int] $env:COREHR_BACKEND_PORT } else { 8000 }),
    [int] $FrontendPort = $(if ($env:COREHR_FRONTEND_PORT) { [int] $env:COREHR_FRONTEND_PORT } else { 5173 }),
    [string] $HostAddress = $(if ($env:COREHR_HOST_ADDRESS) { $env:COREHR_HOST_ADDRESS } else { "0.0.0.0" })
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$RuntimeDir = Join-Path $RootDir ".corehr-runtime"

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

$configFile = Join-Path $RuntimeDir "corehr-config.json"
if (Test-Path $configFile) {
    try {
        $config = Get-Content $configFile -Raw | ConvertFrom-Json
        if ($config.backend_port) {
            $BackendPort = [int] $config.backend_port
        }
        if ($config.frontend_port) {
            $FrontendPort = [int] $config.frontend_port
        }
        if ($config.host_address) {
            $HostAddress = [string] $config.host_address
        }
    } catch {
        Add-Content -Path (Join-Path $RuntimeDir "corehr-launcher.log") -Value "$(Get-Date -Format s) Could not read runtime config: $($_.Exception.Message)"
    }
}

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
    param(
        [int] $Port,
        [string] $Address
    )

    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($Address -notin @("0.0.0.0", "::", "*")) {
        $listeners = $listeners | Where-Object { $_.LocalAddress -eq $Address }
    } else {
        $listeners = $listeners | Where-Object { $_.LocalAddress -in @("0.0.0.0", "::") }
    }

    foreach ($listener in $listeners) {
        $processId = [int] $listener.OwningProcess
        if ($processId -le 0) {
            continue
        }

        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process) {
            Stop-ProcessTree -ProcessId $process.Id
            Add-Content -Path (Join-Path $RuntimeDir "corehr-launcher.log") -Value "$(Get-Date -Format s) Stopped listener on $Address`:$Port with PID $($process.Id)."
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

Stop-PortListener -Port $BackendPort -Address $HostAddress
Stop-PortListener -Port $FrontendPort -Address $HostAddress

Write-Output "CoreHR background processes stopped."
