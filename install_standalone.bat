@echo off
echo ========================================
echo Braille Card Generator - Standalone Installer
echo ========================================
echo.
echo This installer will set up the Braille Card Generator on your computer.
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Running as administrator - good!
) else (
    echo Warning: Not running as administrator.
    echo Some features may not work correctly.
    echo.
    pause
)

REM Set installation directory
set "INSTALL_DIR=%USERPROFILE%\Desktop\BrailleCardGenerator"

echo Installation directory: %INSTALL_DIR%
echo.

REM Create installation directory
if not exist "%INSTALL_DIR%" (
    echo Creating installation directory...
    mkdir "%INSTALL_DIR%"
) else (
    echo Installation directory already exists.
)

REM Copy files
echo.
echo Copying files...
if exist "BrailleCardGenerator.exe" (
    copy "BrailleCardGenerator.exe" "%INSTALL_DIR%\" >nul
    echo ✓ Desktop application copied
) else (
    echo ✗ Desktop application not found
)

if exist "BrailleCardGenerator_Web.exe" (
    copy "BrailleCardGenerator_Web.exe" "%INSTALL_DIR%\" >nul
    echo ✓ Web application copied
) else (
    echo ✗ Web application not found
)

if exist "README.md" (
    copy "README.md" "%INSTALL_DIR%\" >nul
    echo ✓ Documentation copied
) else (
    echo ✗ Documentation not found
)

REM Create desktop shortcut
echo.
echo Creating desktop shortcut...
set "DESKTOP=%USERPROFILE%\Desktop"
set "SHORTCUT=%DESKTOP%\Braille Card Generator.lnk"

REM Create VBS script to create shortcut
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%TEMP%\CreateShortcut.vbs"
echo sLinkFile = "%SHORTCUT%" >> "%TEMP%\CreateShortcut.vbs"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%TEMP%\CreateShortcut.vbs"
echo oLink.TargetPath = "%INSTALL_DIR%\BrailleCardGenerator.exe" >> "%TEMP%\CreateShortcut.vbs"
echo oLink.WorkingDirectory = "%INSTALL_DIR%" >> "%TEMP%\CreateShortcut.vbs"
echo oLink.Description = "Braille Card Generator - 3D Printable Braille Business Cards" >> "%TEMP%\CreateShortcut.vbs"
echo oLink.Save >> "%TEMP%\CreateShortcut.vbs"

cscript //nologo "%TEMP%\CreateShortcut.vbs" >nul 2>&1
if exist "%SHORTCUT%" (
    echo ✓ Desktop shortcut created
) else (
    echo ✗ Failed to create desktop shortcut
)

REM Clean up
del "%TEMP%\CreateShortcut.vbs" >nul 2>&1

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo The Braille Card Generator has been installed to:
echo %INSTALL_DIR%
echo.
echo You can now:
echo 1. Double-click the desktop shortcut to start the application
echo 2. Or navigate to the installation folder and run BrailleCardGenerator.exe
echo.
echo For help and documentation, see the README.md file in the installation folder.
echo.
echo Press any key to open the installation folder...
pause >nul

REM Open installation folder
explorer "%INSTALL_DIR%"

echo.
echo Thank you for installing Braille Card Generator!
echo.
pause

