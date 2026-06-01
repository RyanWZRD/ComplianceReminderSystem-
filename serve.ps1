# Start a local web server for the Compliance Reminder System.
$port = 8765
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Serving $root at http://localhost:$port"
Write-Host "Press Ctrl+C to stop."

Set-Location $root
python -m http.server $port
