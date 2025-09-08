# GitHub Pages Local Test Environment - PowerShell Version
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GitHub Pages Local Test Environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will start a local server that mimics GitHub Pages deployment." -ForegroundColor Yellow
Write-Host "The application will run in pure client-side mode (no backend)." -ForegroundColor Yellow
Write-Host ""

# Check if Python is available
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
} else {
    Write-Host "ERROR: Python is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please install Python from https://www.python.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Starting server using $pythonCmd..." -ForegroundColor Green
Write-Host ""

# Run the server
& $pythonCmd local_github_pages_server.py

# Keep window open if there was an error
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Server exited with error code: $LASTEXITCODE" -ForegroundColor Red
    Read-Host "Press Enter to exit"
}
