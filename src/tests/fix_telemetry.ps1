Get-ChildItem -Path src/tests -Filter *.ts* -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName
    $content = $content -replace 'telemetry', 'performance stats'
    $content = $content -replace 'Telemetry', 'Stats'
    Set-Content -Path $_.FullName -Value $content
}
