Get-ChildItem -Path src -Filter *.ts* -Recurse | ForEach-Object {
    if ($_.Attributes -match "Directory") { return }
    $content = Get-Content $_.FullName
    $content = $content -replace 'telemetry', 'usageStats'
    $content = $content -replace 'Telemetry', 'Stats'
    $content = $content -replace 'trackInlineSuggestionTelemetry', 'trackInlineSuggestionStats'
    Set-Content -Path $_.FullName -Value $content
}
