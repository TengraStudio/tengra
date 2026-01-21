@echo off
echo Updating Go dependencies in main module...
go mod tidy
if errorlevel 1 (
    echo Failed to update main dependencies
    exit /b 1
)

echo Updating Go dependencies in cliproxy-embed...
cd cmd\cliproxy-embed
go mod tidy
if errorlevel 1 (
    echo Failed to update embed dependencies
    exit /b 1
)

echo Building cliproxy-embed...
go build -o cliproxy-embed.exe
if errorlevel 1 (
    echo Failed to build
    exit /b 1
)

echo Build successful!
echo Binary: %CD%\cliproxy-embed.exe
