@echo off
echo ========================================
echo GitHub Pages Local Test Environment
echo ========================================
echo.
echo This will start a local server that mimics GitHub Pages deployment.
echo The application will run in pure client-side mode (no backend).
echo.
echo Starting server...
echo.

:: Run the Python server
python local_github_pages_server.py

:: If Python command fails, try python3
if errorlevel 1 (
    echo Trying python3...
    python3 local_github_pages_server.py
)

pause
