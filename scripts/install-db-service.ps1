<#
.SYNOPSIS
    Install or manage the Orbit Database Service

.DESCRIPTION
    This script installs, uninstalls, or manages the Orbit Database Windows Service.
    The service hosts the SQLite database with vector search support for the Orbit AI assistant.

.PARAMETER Action
    The action to perform: install, uninstall, start, stop, status

.EXAMPLE
    .\install-db-service.ps1 -Action install
    .\install-db-service.ps1 -Action uninstall
    .\install-db-service.ps1 -Action status
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("install", "uninstall", "start", "stop", "status")]
    [string]$Action
)

$ServiceName = "OrbitDatabaseService"
$DisplayName = "Orbit Database Service"
$Description = "Manages the Orbit application database for AI assistant features"

# Determine binary path
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Check if we're in dev or production
if (Test-Path "$ProjectRoot\resources\bin\orbit-db-service.exe") {
    $BinaryPath = "$ProjectRoot\resources\bin\orbit-db-service.exe"
} elseif (Test-Path "$ProjectRoot\src\services\target\release\orbit-db-service.exe") {
    $BinaryPath = "$ProjectRoot\src\services\target\release\orbit-db-service.exe"
} else {
    Write-Error "orbit-db-service.exe not found. Build it first with: cargo build --release -p orbit-db-service"
    exit 1
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Install-Service {
    if (-not (Test-Administrator)) {
        Write-Error "Administrator privileges required to install the service"
        exit 1
    }

    # Check if service already exists
    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "Service already exists. Stopping and removing..." -ForegroundColor Yellow
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        sc.exe delete $ServiceName | Out-Null
        Start-Sleep -Seconds 2
    }

    Write-Host "Installing $DisplayName..." -ForegroundColor Cyan
    Write-Host "Binary: $BinaryPath" -ForegroundColor Gray

    # Create the service
    $result = sc.exe create $ServiceName binPath= "`"$BinaryPath`"" start= auto DisplayName= "`"$DisplayName`""
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create service: $result"
        exit 1
    }

    # Set description
    sc.exe description $ServiceName "$Description" | Out-Null

    # Configure recovery options (restart on failure)
    sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null

    Write-Host "Service installed successfully!" -ForegroundColor Green

    # Start the service
    Write-Host "Starting service..." -ForegroundColor Cyan
    Start-Service -Name $ServiceName

    $service = Get-Service -Name $ServiceName
    if ($service.Status -eq "Running") {
        Write-Host "Service is running" -ForegroundColor Green
    } else {
        Write-Warning "Service may not have started correctly. Check Event Viewer for details."
    }
}

function Uninstall-Service {
    if (-not (Test-Administrator)) {
        Write-Error "Administrator privileges required to uninstall the service"
        exit 1
    }

    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $existing) {
        Write-Host "Service not found" -ForegroundColor Yellow
        return
    }

    Write-Host "Stopping service..." -ForegroundColor Cyan
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    Write-Host "Removing service..." -ForegroundColor Cyan
    sc.exe delete $ServiceName | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Service uninstalled successfully!" -ForegroundColor Green
    } else {
        Write-Error "Failed to uninstall service"
    }

    # Clean up port file
    $portFile = "$env:APPDATA\Orbit\services\db-service.port"
    if (Test-Path $portFile) {
        Remove-Item $portFile -Force
        Write-Host "Removed port file" -ForegroundColor Gray
    }
}

function Start-DbService {
    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $existing) {
        Write-Error "Service not installed"
        exit 1
    }

    if ($existing.Status -eq "Running") {
        Write-Host "Service is already running" -ForegroundColor Yellow
        return
    }

    Write-Host "Starting service..." -ForegroundColor Cyan
    Start-Service -Name $ServiceName

    $service = Get-Service -Name $ServiceName
    Write-Host "Service status: $($service.Status)" -ForegroundColor $(if ($service.Status -eq "Running") { "Green" } else { "Yellow" })
}

function Stop-DbService {
    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $existing) {
        Write-Error "Service not installed"
        exit 1
    }

    if ($existing.Status -eq "Stopped") {
        Write-Host "Service is already stopped" -ForegroundColor Yellow
        return
    }

    Write-Host "Stopping service..." -ForegroundColor Cyan
    Stop-Service -Name $ServiceName -Force

    $service = Get-Service -Name $ServiceName
    Write-Host "Service status: $($service.Status)" -ForegroundColor $(if ($service.Status -eq "Stopped") { "Green" } else { "Yellow" })
}

function Get-ServiceStatus {
    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $existing) {
        Write-Host "Service: Not installed" -ForegroundColor Yellow
        return
    }

    Write-Host "Service: $DisplayName" -ForegroundColor Cyan
    Write-Host "Status: $($existing.Status)" -ForegroundColor $(if ($existing.Status -eq "Running") { "Green" } else { "Yellow" })
    Write-Host "Start Type: $($existing.StartType)" -ForegroundColor Gray

    # Check port file
    $portFile = "$env:APPDATA\Orbit\services\db-service.port"
    if (Test-Path $portFile) {
        $port = Get-Content $portFile
        Write-Host "Port: $port" -ForegroundColor Gray

        # Try to connect
        try {
            $response = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -Method Get -TimeoutSec 5
            Write-Host "Health: $($response.data.status) (v$($response.data.version))" -ForegroundColor Green
        } catch {
            Write-Host "Health: Unable to connect" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Port file: Not found" -ForegroundColor Yellow
    }
}

# Execute action
switch ($Action) {
    "install" { Install-Service }
    "uninstall" { Uninstall-Service }
    "start" { Start-DbService }
    "stop" { Stop-DbService }
    "status" { Get-ServiceStatus }
}
