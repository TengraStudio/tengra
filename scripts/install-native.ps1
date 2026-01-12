param([string]$Package = "better-sqlite3@^11.10.0")
Write-Host "Setting up build environment..." -ForegroundColor Cyan
$setupOutput = node scripts/setup-build-env.js 2>&1 | Out-String
Write-Host $setupOutput
$vsVersion = "2022"
if ($setupOutput -match "Visual Studio (\d{4})") { $vsVersion = $matches[1] }
Write-Host "Clearing conflicting VS environment variables..." -ForegroundColor Yellow
$vsVarsToClear = @("VSINSTALLDIR", "VCINSTALLDIR", "VCToolsInstallDir", "VSCMD_ARG_app_plat", "VSCMD_ARG_HOST_ARCH", "VSCMD_ARG_TGT_ARCH", "VSCMD_VER", "WindowsSdkDir", "WindowsSDKVersion", "INCLUDE", "LIB", "LIBPATH")
foreach ($var in $vsVarsToClear) {
    $value = [Environment]::GetEnvironmentVariable($var, "Process")
    if ($null -ne $value) {
        [Environment]::SetEnvironmentVariable($var, $null, "Process")
        Write-Host "  Cleared $var" -ForegroundColor Gray
    }
}
$env:npm_config_msvs_version = $vsVersion
$env:GYP_MSVS_VERSION = $vsVersion
$env:msvs_version = $vsVersion
# Set toolset to v145 to match MSVC 14.50
$env:npm_config_target_arch = "x64"
$env:npm_config_target_platform = "win32"
Write-Host "Set npm_config_msvs_version=$vsVersion" -ForegroundColor Green
Write-Host "Installing $Package..." -ForegroundColor Cyan
# Pass toolset version to node-gyp via MSBuild properties
$env:npm_config_msbuild_args = "/p:PlatformToolset=v145"
# Install without building (skip scripts)
Write-Host "Installing package files (skipping build)..." -ForegroundColor Cyan
npm install $Package --legacy-peer-deps --ignore-scripts

# Patch binding.gyp to use v145 toolset
Write-Host "Patching build configuration..." -ForegroundColor Cyan
node scripts/patch-better-sqlite3-build.js

# Rebuild with patched configuration and correct toolset
if (Test-Path "node_modules\better-sqlite3") {
    Write-Host "Rebuilding with v145 toolset..." -ForegroundColor Cyan
    Push-Location node_modules\better-sqlite3
    $env:npm_config_msvs_version = $vsVersion
    $env:GYP_MSVS_VERSION = $vsVersion
    npx node-gyp rebuild --release --msvs_version=$vsVersion
    $rebuildExit = $LASTEXITCODE
    Pop-Location
    
    if ($rebuildExit -ne 0) {
        Write-Host "Rebuild failed, trying with MSBuild properties..." -ForegroundColor Yellow
        Push-Location node_modules\better-sqlite3
        $msbuildPath = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe"
        if (Test-Path $msbuildPath) {
            & $msbuildPath build\binding.sln /p:Configuration=Release /p:Platform=x64 /p:PlatformToolset=v145 /p:VCToolsVersion=14.50 /clp:Verbosity=minimal /nologo
        }
        Pop-Location
    }
}
if ($LASTEXITCODE -eq 0) { Write-Host "Successfully installed!" -ForegroundColor Green } else { Write-Host "Failed to install" -ForegroundColor Red; exit 1 }
