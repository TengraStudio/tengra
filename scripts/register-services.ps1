# Tandem Services Startup Registration Script (User-Level, No Admin Required)
# Uses Windows Registry HKCU\Software\Microsoft\Windows\CurrentVersion\Run

param(
    [switch]$Uninstall,
    [switch]$Status
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
$BinDir = Join-Path (Split-Path -Parent $ScriptDir) "resources\bin"

# Fallback locations
if (-not (Test-Path $BinDir)) {
    $LocalAppData = [Environment]::GetFolderPath("LocalApplicationData")
    $BinDir = Join-Path $LocalAppData "Programs\Tandem\resources\bin"
}

function Get-ServiceStatus {
    Write-Host "`n=== Tandem Services Status ===" -ForegroundColor Cyan
    
    foreach ($name in $Services.Keys) {
        $exe = $Services[$name]
        $processName = $exe -replace '\.exe$',''
        $process = Get-Process -Name $processName -ErrorAction SilentlyContinue
        
        # Check registry
        $regValue = Get-ItemProperty -Path $RegistryPath -Name $name -ErrorAction SilentlyContinue
        
        Write-Host "`n$name :" -ForegroundColor Yellow
        
        if ($regValue) {
            Write-Host "  Startup Entry: " -NoNewline
            Write-Host "Registered" -ForegroundColor Green
        } else {
            Write-Host "  Startup Entry: " -NoNewline
            Write-Host "Not Registered" -ForegroundColor Red
        }
        
        if ($process) {
            Write-Host "  Process: " -NoNewline
            Write-Host "Running (PID: $($process.Id))" -ForegroundColor Green
        } else {
            Write-Host "  Process: " -NoNewline
            Write-Host "Not Running" -ForegroundColor Gray
        }
        
        # Check port file
        $AppData = [Environment]::GetFolderPath("ApplicationData")
        $serviceName = $exe -replace 'tandem-','' -replace '\.exe$',''
        $PortFile = Join-Path $AppData "Tandem\services\$serviceName.port"
        if (Test-Path $PortFile) {
            $port = Get-Content $PortFile
            Write-Host "  Listening on: " -NoNewline
            Write-Host "Port $port" -ForegroundColor Green
        }
    }
}

function Install-Services {
    Write-Host "`n=== Installing Tandem Services ===" -ForegroundColor Cyan
    
    if (-not (Test-Path $BinDir)) {
        Write-Host "Error: Binary directory not found at $BinDir" -ForegroundColor Red
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
            Write-Host "Warning: $exe not found at $exePath" -ForegroundColor Yellow
            continue
        }
        
        Write-Host "`nRegistering $name..." -ForegroundColor Yellow
        
        # Add to registry (runs at login)
        Set-ItemProperty -Path $RegistryPath -Name $name -Value "`"$exePath`""
        Write-Host "  Added to Windows Startup" -ForegroundColor Green
        
        # Start the service now
        $processName = $exe -replace '\.exe$',''
        $existing = Get-Process -Name $processName -ErrorAction SilentlyContinue
        if (-not $existing) {
            Write-Host "  Starting service..." -ForegroundColor Gray
            Start-Process -FilePath $exePath -WindowStyle Hidden
            Start-Sleep -Milliseconds 500
            
            $process = Get-Process -Name $processName -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "  Service started (PID: $($process.Id))" -ForegroundColor Green
            }
        } else {
            Write-Host "  Service already running (PID: $($existing.Id))" -ForegroundColor Cyan
        }
    }
    
    Write-Host "`n=== Installation Complete ===" -ForegroundColor Green
    Write-Host "Services will start automatically on Windows login." -ForegroundColor Cyan
}

function Uninstall-Services {
    Write-Host "`n=== Uninstalling Tandem Services ===" -ForegroundColor Cyan
    
    foreach ($name in $Services.Keys) {
        $exe = $Services[$name]
        $processName = $exe -replace '\.exe$',''
        
        # Stop the process if running
        $process = Get-Process -Name $processName -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Stopping $name (PID: $($process.Id))..." -ForegroundColor Yellow
            Stop-Process -Id $process.Id -Force
        }
        
        # Remove from registry
        $regValue = Get-ItemProperty -Path $RegistryPath -Name $name -ErrorAction SilentlyContinue
        if ($regValue) {
            Remove-ItemProperty -Path $RegistryPath -Name $name
            Write-Host "Removed $name from Windows Startup" -ForegroundColor Green
        }
    }
    
    # Clean up port files
    $AppData = [Environment]::GetFolderPath("ApplicationData")
    $ServicesDir = Join-Path $AppData "Tandem\services"
    if (Test-Path $ServicesDir) {
        Remove-Item -Path "$ServicesDir\*.port" -Force -ErrorAction SilentlyContinue
        Write-Host "Cleaned up port files" -ForegroundColor Gray
    }
    
    Write-Host "`n=== Uninstallation Complete ===" -ForegroundColor Green
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
