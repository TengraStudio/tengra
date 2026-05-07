param(
    [Parameter(Mandatory = $true)]
    [int]$ProcessId,

    [Parameter(Mandatory = $true)]
    [string]$SourcePath,

    [Parameter(Mandatory = $true)]
    [string]$TargetPath,

    [Parameter(Mandatory = $false)]
    [string]$LaunchAfter
)

$ErrorActionPreference = 'Stop'

function Wait-ForProcessExit {
    param([int]$Id)

    try {
        $proc = Get-Process -Id $Id -ErrorAction SilentlyContinue
        while ($null -ne $proc) {
            Start-Sleep -Milliseconds 500
            $proc = Get-Process -Id $Id -ErrorAction SilentlyContinue
        }
    } catch {
        # Process already exited.
    }
}

function Copy-WithRetry {
    param(
        [string]$From,
        [string]$To,
        [int]$Retries = 20
    )

    for ($i = 0; $i -lt $Retries; $i++) {
        try {
            Copy-Item -LiteralPath $From -Destination $To -Force
            return
        } catch {
            Start-Sleep -Milliseconds (500 * [math]::Min($i + 1, 6))
        }
    }

    throw "Failed to copy update from $From to $To"
}

Wait-ForProcessExit -Id $ProcessId

$targetDir = Split-Path -Parent $TargetPath
if (-not (Test-Path -LiteralPath $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

Copy-WithRetry -From $SourcePath -To $TargetPath

if ($LaunchAfter -and (Test-Path -LiteralPath $LaunchAfter)) {
    Start-Process -FilePath $LaunchAfter | Out-Null
}
