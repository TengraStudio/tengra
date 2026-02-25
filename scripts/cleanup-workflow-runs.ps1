#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Cleanup GitHub Actions Workflow Runs

.DESCRIPTION
    Deletes old or failed workflow runs to clean up the Actions tab

.PARAMETER Status
    Filter by status (completed, failure, success, cancelled, all)
    Default: failure

.PARAMETER KeepLast
    Keep last N successful runs
    Default: 5

.PARAMETER DryRun
    Show what would be deleted without actually deleting

.PARAMETER Workflow
    Only delete runs from specific workflow

.PARAMETER OlderThan
    Only delete runs older than N days
    Default: 30

.EXAMPLE
    .\cleanup-workflow-runs.ps1 -Status failure
    Delete all failed runs older than 30 days

.EXAMPLE
    .\cleanup-workflow-runs.ps1 -KeepLast 3 -DryRun
    Show what would be deleted keeping last 3 successful runs

.EXAMPLE
    .\cleanup-workflow-runs.ps1 -Workflow "Release Build" -Status all
    Delete all runs from "Release Build" workflow
#>

param(
    [string]$Status = "failure",
    [int]$KeepLast = 5,
    [switch]$DryRun,
    [string]$Workflow = $null,
    [int]$OlderThan = 30
)

# Configuration
$RepoOwner = "TengraStudio"
$RepoName = "tengra"
$GitHubToken = $env:GH_TOKEN
if (-not $GitHubToken) {
    $GitHubToken = $env:GITHUB_TOKEN
}

# Check for token
if (-not $GitHubToken) {
    Write-Host "❌ Error: GitHub token not found!" -ForegroundColor Red
    Write-Host "Set GH_TOKEN or GITHUB_TOKEN environment variable" -ForegroundColor Yellow
    Write-Host 'Example: $env:GH_TOKEN = "your_github_token"' -ForegroundColor Cyan
    exit 1
}

# Headers for GitHub API
$Headers = @{
    "Authorization" = "token $GitHubToken"
    "Accept"        = "application/vnd.github.v3+json"
    "User-Agent"    = "GitHub-Workflow-Cleanup-Script"
}

# Display banner
Write-Host ""
Write-Host "🧹 GitHub Actions Workflow Cleanup" -ForegroundColor Cyan
Write-Host ("━" * 50) -ForegroundColor Cyan
Write-Host "Repository: $RepoOwner/$RepoName" -ForegroundColor Blue
Write-Host "Status filter: $Status" -ForegroundColor Blue
Write-Host "Keep last: $KeepLast successful runs" -ForegroundColor Blue
Write-Host "Older than: $OlderThan days" -ForegroundColor Blue
if ($Workflow) {
    Write-Host "Workflow: $Workflow" -ForegroundColor Blue
}
if ($DryRun) {
    Write-Host "Mode: DRY RUN (no actual deletion)" -ForegroundColor Yellow
}
Write-Host ("━" * 50) -ForegroundColor Cyan

try {
    # Fetch workflow runs
    Write-Host ""
    Write-Host "📥 Fetching workflow runs..." -ForegroundColor Cyan
    $Uri = "https://api.github.com/repos/$RepoOwner/$RepoName/actions/runs?per_page=100"
    $Response = Invoke-RestMethod -Uri $Uri -Headers $Headers -Method Get
    $AllRuns = $Response.workflow_runs
    Write-Host "Found $($AllRuns.Count) total runs" -ForegroundColor Green

    # Filter runs
    $RunsToDelete = $AllRuns

    # Filter by status
    if ($Status -ne "all") {
        $RunsToDelete = $RunsToDelete | Where-Object {
            $_.conclusion -eq $Status -or $_.status -eq $Status
        }
    }

    # Filter by workflow name
    if ($Workflow) {
        $RunsToDelete = $RunsToDelete | Where-Object { $_.name -eq $Workflow }
    }

    # Filter by age
    if ($OlderThan -gt 0) {
        $CutoffDate = (Get-Date).AddDays(-$OlderThan)
        $RunsToDelete = $RunsToDelete | Where-Object {
            # Use ParseExact for ISO 8601 format from GitHub API
            $CreatedAt = [DateTime]::Parse($_.created_at, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::RoundtripKind)
            $CreatedAt -lt $CutoffDate
        }
    }

    Write-Host "Filtered to $($RunsToDelete.Count) runs for deletion" -ForegroundColor Yellow

    if ($RunsToDelete.Count -eq 0) {
        Write-Host ""
        Write-Host "✅ No runs to delete!" -ForegroundColor Green
        exit 0
    }

    # Group by workflow
    $RunsByWorkflow = $RunsToDelete | Group-Object -Property name

    # Display summary
    Write-Host ""
    Write-Host "📊 Summary by workflow:" -ForegroundColor Cyan
    foreach ($Group in $RunsByWorkflow) {
        Write-Host "  $($Group.Name): $($Group.Count) runs" -ForegroundColor Blue
    }

    # Sort by date (oldest first)
    $RunsToDelete = $RunsToDelete | Sort-Object created_at

    # Delete runs
    Write-Host ""
    Write-Host "🗑️  Deleting workflow runs..." -ForegroundColor Cyan
    $Deleted = 0
    $Failed = 0

    foreach ($Run in $RunsToDelete) {
        $Date = ([DateTime]::Parse($Run.created_at, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::RoundtripKind)).ToString("yyyy-MM-dd")
        $RunStatus = if ($Run.conclusion) { $Run.conclusion } else { $Run.status }
        $Message = "  [$Date] $($Run.name) #$($Run.run_number) ($RunStatus)"

        if ($DryRun) {
            Write-Host "$Message - would delete" -ForegroundColor Yellow
        }
        else {
            try {
                $DeleteUri = "https://api.github.com/repos/$RepoOwner/$RepoName/actions/runs/$($Run.id)"
                Invoke-RestMethod -Uri $DeleteUri -Headers $Headers -Method Delete | Out-Null
                Write-Host "$Message - deleted ✓" -ForegroundColor Green
                $Deleted++

                # Rate limiting: wait 100ms
                Start-Sleep -Milliseconds 100
            }
            catch {
                Write-Host "$Message - failed: $($_.Exception.Message)" -ForegroundColor Red
                $Failed++
            }
        }
    }

    # Final summary
    Write-Host ""
    Write-Host ("━" * 50) -ForegroundColor Cyan
    if ($DryRun) {
        Write-Host "✅ Dry run complete: $($RunsToDelete.Count) runs would be deleted" -ForegroundColor Yellow
    }
    else {
        Write-Host "✅ Cleanup complete!" -ForegroundColor Green
        Write-Host "   Deleted: $Deleted" -ForegroundColor Green
        if ($Failed -gt 0) {
            Write-Host "   Failed: $Failed" -ForegroundColor Red
        }
    }
    Write-Host ("━" * 50) -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

