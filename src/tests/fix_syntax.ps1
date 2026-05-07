Get-ChildItem -Path src/tests -Filter *.ts* -Recurse | ForEach-Object {
    if ($_.Attributes -match "Directory") { return }
    $content = Get-Content $_.FullName
    $content = $content -replace 'performance stats', 'Stats'
    Set-Content -Path $_.FullName -Value $content
}
