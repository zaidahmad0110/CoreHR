param(
    [string] $PhpPath = $env:COREHR_PHP_PATH,
    [int] $BackendPort = $(if ($env:COREHR_BACKEND_PORT) { [int] $env:COREHR_BACKEND_PORT } else { 8000 }),
    [int] $FrontendPort = $(if ($env:COREHR_FRONTEND_PORT) { [int] $env:COREHR_FRONTEND_PORT } else { 5173 }),
    [string] $HostAddress = $(if ($env:COREHR_HOST_ADDRESS) { $env:COREHR_HOST_ADDRESS } else { "0.0.0.0" }),
    [string] $ApiBaseUrl = $env:VITE_API_BASE_URL
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $RootDir "backend"
$RuntimeDir = Join-Path $RootDir ".corehr-runtime"

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

function Resolve-PhpExecutable {
    param([string] $RequestedPath)

    if ($RequestedPath -and (Test-Path $RequestedPath)) {
        return (Resolve-Path $RequestedPath).Path
    }

    $candidates = @(
        "G:\xampp\php\php.exe",
        "C:\xampp\php\php.exe",
        "D:\xampp\php\php.exe",
        "E:\xampp\php\php.exe",
        "F:\xampp\php\php.exe"
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    $fromPath = Get-Command php.exe -ErrorAction SilentlyContinue
    if ($fromPath) {
        return $fromPath.Source
    }

    throw "PHP executable was not found. Set COREHR_PHP_PATH to your php.exe path."
}

function Resolve-NpmExecutable {
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($npm) {
        return $npm.Source
    }

    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if ($npm) {
        return $npm.Source
    }

    throw "npm was not found in PATH."
}

function Test-PidFile {
    param([string] $PidFile)

    if (-not (Test-Path $PidFile)) {
        return $false
    }

    $processId = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $processId) {
        return $false
    }

    return [bool](Get-Process -Id ([int] $processId) -ErrorAction SilentlyContinue)
}

function Test-PortListener {
    param(
        [int] $Port,
        [string] $Address
    )

    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

    if ($Address -in @("0.0.0.0", "::", "*")) {
        return [bool]($listeners | Select-Object -First 1)
    }

    $listener = $listeners | Where-Object {
        $_.LocalAddress -in @($Address, "0.0.0.0", "::")
    } | Select-Object -First 1

    return [bool] $listener
}

function Start-HiddenProcess {
    param(
        [string] $Name,
        [string] $FilePath,
        [string[]] $Arguments,
        [string] $WorkingDirectory,
        [int] $Port = 0,
        [string] $Address = ""
    )

    $pidFile = Join-Path $RuntimeDir "$Name.pid"

    if ($Port -gt 0 -and (Test-PortListener -Port $Port -Address $Address)) {
        Add-Content -Path (Join-Path $RuntimeDir "corehr-launcher.log") -Value "$(Get-Date -Format s) $Name $Address`:$Port already has a listener."
        return
    }

    if (Test-PidFile $pidFile) {
        Add-Content -Path (Join-Path $RuntimeDir "corehr-launcher.log") -Value "$(Get-Date -Format s) $Name already running."
        return
    }

    $stdout = Join-Path $RuntimeDir "$Name.out.log"
    $stderr = Join-Path $RuntimeDir "$Name.err.log"

    $process = Start-Process `
        -FilePath $FilePath `
        -ArgumentList $Arguments `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -PassThru

    Set-Content -Path $pidFile -Value $process.Id
    Add-Content -Path (Join-Path $RuntimeDir "corehr-launcher.log") -Value "$(Get-Date -Format s) Started $Name with PID $($process.Id)."
}

if (-not (Test-Path $BackendDir)) {
    throw "Backend directory not found: $BackendDir"
}

$php = Resolve-PhpExecutable $PhpPath
$npm = Resolve-NpmExecutable
$resolvedApiHost = if ($HostAddress -in @("0.0.0.0", "::", "*")) { "localhost" } else { $HostAddress }

if (-not $ApiBaseUrl) {
    $ApiBaseUrl = "http://$resolvedApiHost`:$BackendPort"
}

$env:VITE_API_BASE_URL = $ApiBaseUrl
Set-Content -Path (Join-Path $RuntimeDir "corehr-config.json") -Value (@{
    backend_port = $BackendPort
    frontend_port = $FrontendPort
    host_address = $HostAddress
    api_base_url = $ApiBaseUrl
} | ConvertTo-Json)
Add-Content -Path (Join-Path $RuntimeDir "corehr-launcher.log") -Value "$(Get-Date -Format s) CoreHR host=$HostAddress backend=$BackendPort frontend=$FrontendPort api=$ApiBaseUrl."

Start-HiddenProcess `
    -Name "backend" `
    -FilePath $php `
    -Arguments @("artisan", "serve", "--host=$HostAddress", "--port=$BackendPort") `
    -WorkingDirectory $BackendDir `
    -Port $BackendPort `
    -Address $HostAddress

Start-HiddenProcess `
    -Name "frontend" `
    -FilePath $npm `
    -Arguments @("run", "dev", "--", "--host", $HostAddress, "--port", "$FrontendPort") `
    -WorkingDirectory $RootDir `
    -Port $FrontendPort `
    -Address $HostAddress

Start-HiddenProcess `
    -Name "scheduler" `
    -FilePath $php `
    -Arguments @("artisan", "schedule:work") `
    -WorkingDirectory $BackendDir
