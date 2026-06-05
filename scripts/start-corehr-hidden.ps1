param(
    [string] $PhpPath = $env:COREHR_PHP_PATH,
    [int] $BackendPort = 8000,
    [int] $FrontendPort = 5173,
    [string] $HostAddress = "0.0.0.0"
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
    param([int] $Port)

    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    return [bool] $listener
}

function Start-HiddenProcess {
    param(
        [string] $Name,
        [string] $FilePath,
        [string[]] $Arguments,
        [string] $WorkingDirectory,
        [int] $Port
    )

    $pidFile = Join-Path $RuntimeDir "$Name.pid"

    if (Test-PortListener $Port) {
        Add-Content -Path (Join-Path $RuntimeDir "corehr-launcher.log") -Value "$(Get-Date -Format s) $Name port $Port already has a listener."
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

Start-HiddenProcess `
    -Name "backend" `
    -FilePath $php `
    -Arguments @("artisan", "serve", "--host=$HostAddress", "--port=$BackendPort") `
    -WorkingDirectory $BackendDir `
    -Port $BackendPort

Start-HiddenProcess `
    -Name "frontend" `
    -FilePath $npm `
    -Arguments @("run", "dev", "--", "--host", $HostAddress, "--port", "$FrontendPort") `
    -WorkingDirectory $RootDir `
    -Port $FrontendPort
