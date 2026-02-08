# Tandem Services Startup Registration Script (User-Level, No Admin Required)
# Uses Windows Registry HKCU\Software\Microsoft\Windows\CurrentVersion\Run

param(
    [switch]$Uninstall,
    [switch]$Status,
    [switch]$Silent
)

$ErrorActionPreference = "Stop"

# Configuration
$Services = @{
    "TandemTokenService" = "tandem-token-service.exe"
    "TandemModelService" = "tandem-model-service.exe"
    "TandemQuotaService" = "tandem-quota-service.exe"
    "TandemMemoryService" = "tandem-memory-service.exe"
}

$RegistryPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"

# Get the bin directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallRoot = Split-Path -Parent $ScriptDir
$LocalAppData = [Environment]::GetFolderPath("LocalApplicationData")
$BinCandidates = @(
    (Join-Path $InstallRoot "resources\bin"),
    (Join-Path $InstallRoot "resources\resources\bin"),
    (Join-Path $LocalAppData "Programs\Tandem\resources\bin"),
    (Join-Path $LocalAppData "Programs\Tandem\resources\resources\bin")
)
$BinDir = $BinCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $BinDir) {
    # Keep deterministic fallback for error messages
    $BinDir = $BinCandidates[0]
}

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    if (-not $Silent) {
        Write-Host $Message -ForegroundColor $Color
    }
}

function Get-ServiceStatus {
    Write-Log "`n=== Tandem Services Status ===" "Cyan"

    foreach ($name in $Services.Keys) {
        $exe = $Services[$name]
        $processName = $exe -replace '\.exe$',''
        $process = Get-Process -Name $processName -ErrorAction SilentlyContinue

        # Check registry
        $regValue = Get-ItemProperty -Path $RegistryPath -Name $name -ErrorAction SilentlyContinue

        Write-Log "`n$name :" "Yellow"

        if ($regValue) {
            Write-Log "  Startup Entry: Registered" "Green"
        } else {
            Write-Log "  Startup Entry: Not Registered" "Red"
        }

        if ($process) {
            Write-Log "  Process: Running (PID: $($process.Id))" "Green"
        } else {
            Write-Log "  Process: Not Running" "Gray"
        }

        # Check port file
        $AppData = [Environment]::GetFolderPath("ApplicationData")
        $serviceName = $exe -replace 'tandem-','' -replace '\.exe$',''
        $PortFile = Join-Path $AppData "Tandem\services\$serviceName.port"
        if (Test-Path $PortFile) {
            $port = Get-Content $PortFile
            Write-Log "  Listening on: Port $port" "Green"
        }
    }
}

function Install-Services {
    Write-Log "`n=== Installing Tandem Services ===" "Cyan"

    if (-not (Test-Path $BinDir)) {
        Write-Log "Error: Binary directory not found at $BinDir" "Red"
        exit 1
    }

    # Ensure services directory exists
    $AppData = [Environment]::GetFolderPath("ApplicationData")
    $ServicesDir = Join-Path $AppData "Tandem\services"
    if (-not (Test-Path $ServicesDir)) {
        New-Item -ItemType Directory -Force -Path $ServicesDir | Out-Null
    }

    foreach ($name in $Services.Keys) {
        $exe = $Services[$name]
        $exePath = Join-Path $BinDir $exe

        if (-not (Test-Path $exePath)) {
            Write-Log "Warning: $exe not found at $exePath" "Yellow"
            continue
        }

        Write-Log "`nRegistering $name..." "Yellow"

        # Add to registry (runs at login)
        Set-ItemProperty -Path $RegistryPath -Name $name -Value "`"$exePath`""
        Write-Log "  Added to Windows Startup" "Green"

        # Start the service now (skip in silent mode during installer)
        if (-not $Silent) {
            $processName = $exe -replace '\.exe$',''
            $existing = Get-Process -Name $processName -ErrorAction SilentlyContinue
            if (-not $existing) {
                Write-Log "  Starting service..." "Gray"
                Start-Process -FilePath $exePath -WindowStyle Hidden
                Start-Sleep -Milliseconds 500

                $process = Get-Process -Name $processName -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Log "  Service started (PID: $($process.Id))" "Green"
                }
            } else {
                Write-Log "  Service already running (PID: $($existing.Id))" "Cyan"
            }
        }
    }

    Write-Log "`n=== Installation Complete ===" "Green"
    Write-Log "Services will start automatically on Windows login." "Cyan"
}

function Uninstall-Services {
    Write-Log "`n=== Uninstalling Tandem Services ===" "Cyan"

    foreach ($name in $Services.Keys) {
        $exe = $Services[$name]
        $processName = $exe -replace '\.exe$',''

        # Stop the process if running
        $process = Get-Process -Name $processName -ErrorAction SilentlyContinue
        if ($process) {
            Write-Log "Stopping $name (PID: $($process.Id))..." "Yellow"
            Stop-Process -Id $process.Id -Force
        }

        # Remove from registry
        $regValue = Get-ItemProperty -Path $RegistryPath -Name $name -ErrorAction SilentlyContinue
        if ($regValue) {
            Remove-ItemProperty -Path $RegistryPath -Name $name
            Write-Log "Removed $name from Windows Startup" "Green"
        }
    }

    # Clean up port files
    $AppData = [Environment]::GetFolderPath("ApplicationData")
    $ServicesDir = Join-Path $AppData "Tandem\services"
    if (Test-Path $ServicesDir) {
        Remove-Item -Path "$ServicesDir\*.port" -Force -ErrorAction SilentlyContinue
        Write-Log "Cleaned up port files" "Gray"
    }

    Write-Log "`n=== Uninstallation Complete ===" "Green"
}

# Main
if ($Status) {
    Get-ServiceStatus
} elseif ($Uninstall) {
    Uninstall-Services
} else {
    Install-Services
    Get-ServiceStatus
}
