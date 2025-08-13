#!/usr/bin/env python3
"""
Build script for creating standalone executable of the Braille Card Generator.
This script creates a self-contained executable that includes all dependencies.
"""

import os
import sys
import shutil
import subprocess
import platform
from pathlib import Path

def check_dependencies():
    """Check if required build dependencies are installed."""
    try:
        import PyInstaller
        print("✓ PyInstaller found")
    except ImportError:
        print("✗ PyInstaller not found. Installing...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
    
    try:
        import trimesh
        print("✓ trimesh found")
    except ImportError:
        print("✗ trimesh not found. Installing...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "trimesh"])
    
    try:
        import flask
        print("✓ flask found")
    except ImportError:
        print("✗ flask not found. Installing...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "flask"])

def create_spec_file():
    """Create PyInstaller spec file for the application."""
    spec_content = '''# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

# Collect all required data files
datas = [
    ('templates', 'templates'),
    ('static', 'static'),
    ('third_party/liblouis', 'third_party/liblouis'),
]

# Collect all required binaries
binaries = []

# Add liblouis executables based on platform
import platform
if platform.system() == "Windows":
    binaries.append(('third_party/liblouis/bin/lou_translate.exe', 'third_party/liblouis/bin'))
    binaries.append(('third_party/liblouis/bin/liblouis.dll', 'third_party/liblouis/bin'))
else:
    binaries.append(('third_party/liblouis/bin/lou_translate', 'third_party/liblouis/bin'))

a = Analysis(
    ['backend.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=[
        'trimesh',
        'numpy',
        'flask',
        'flask_cors',
        'werkzeug',
        'jinja2',
        'markupsafe',
        'itsdangerous',
        'click',
        'blinker',
        'trimesh.creation',
        'trimesh.util',
        'trimesh.visual',
        'trimesh.transformations',
        'trimesh.geometry',
        'trimesh.ray',
        'trimesh.intersections',
        'trimesh.bounds',
        'trimesh.points',
        'trimesh.curvature',
        'trimesh.decomposition',
        'trimesh.remesh',
        'trimesh.simplify',
        'trimesh.repair',
        'trimesh.exchange',
        'trimesh.exchange.stl',
        'trimesh.exchange.obj',
        'trimesh.exchange.ply',
        'trimesh.exchange.off',
        'trimesh.exchange.dae',
        'trimesh.exchange.gltf',
        'trimesh.exchange.urdf',
        'trimesh.exchange.xml',
        'trimesh.exchange.pickle',
        'trimesh.exchange.binvox',
        'trimesh.exchange.points',
        'trimesh.exchange.xyz',
        'trimesh.exchange.ply_ascii',
        'trimesh.exchange.ply_binary',
        'trimesh.exchange.stl_ascii',
        'trimesh.exchange.stl_binary',
        'trimesh.exchange.obj',
        'trimesh.exchange.off',
        'trimesh.exchange.dae',
        'trimesh.exchange.gltf',
        'trimesh.exchange.urdf',
        'trimesh.exchange.xml',
        'trimesh.exchange.pickle',
        'trimesh.exchange.binvox',
        'trimesh.exchange.points',
        'trimesh.exchange.xyz',
        'trimesh.exchange.ply_ascii',
        'trimesh.exchange.ply_binary',
        'trimesh.exchange.stl_ascii',
        'trimesh.exchange.stl_binary',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='BrailleCardGenerator',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='static/icon.ico' if os.path.exists('static/icon.ico') else None,
)
'''
    
    with open('BrailleCardGenerator.spec', 'w') as f:
        f.write(spec_content)
    
    print("✓ Created PyInstaller spec file")

def build_executable():
    """Build the standalone executable."""
    print("Building standalone executable...")
    
    # Clean previous builds
    if os.path.exists('build'):
        shutil.rmtree('build')
    if os.path.exists('dist'):
        shutil.rmtree('dist')
    
    # Run PyInstaller
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--clean",
        "--onefile",
        "--windowed",
        "--name=BrailleCardGenerator",
        "backend.py"
    ]
    
    # Add data files
    cmd.extend([
        "--add-data", f"templates{os.pathsep}templates",
        "--add-data", f"static{os.pathsep}static",
        "--add-data", f"third_party/liblouis{os.pathsep}third_party/liblouis",
    ])
    
    # Add hidden imports
    hidden_imports = [
        "trimesh", "numpy", "flask", "flask_cors", "werkzeug", "jinja2",
        "markupsafe", "itsdangerous", "click", "blinker"
    ]
    for imp in hidden_imports:
        cmd.extend(["--hidden-import", imp])
    
    subprocess.check_call(cmd)
    print("✓ Executable built successfully")

def create_installer():
    """Create an installer package (Windows only)."""
    if platform.system() != "Windows":
        print("Skipping installer creation (Windows only)")
        return
    
    try:
        import innosetup
        print("Creating installer...")
        # This would require Inno Setup to be installed
        # For now, we'll just create a simple batch file
        create_batch_installer()
    except ImportError:
        print("Creating simple batch installer...")
        create_batch_installer()

def create_batch_installer():
    """Create a simple batch file installer for Windows."""
    batch_content = '''@echo off
echo Braille Card Generator Installer
echo ================================
echo.
echo This will install Braille Card Generator to your desktop.
echo.

set "DESKTOP=%USERPROFILE%\\Desktop"
set "INSTALL_DIR=%DESKTOP%\\BrailleCardGenerator"

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo Copying files...
copy "dist\\BrailleCardGenerator.exe" "%INSTALL_DIR%\\"
copy "README.md" "%INSTALL_DIR%\\" 2>nul

echo.
echo Installation complete!
echo.
echo To run the application:
echo 1. Navigate to: %INSTALL_DIR%
echo 2. Double-click: BrailleCardGenerator.exe
echo 3. Open your web browser to: http://localhost:5001
echo.
pause
'''
    
    with open('install.bat', 'w') as f:
        f.write(batch_content)
    
    print("✓ Created batch installer")

def main():
    """Main build process."""
    print("Braille Card Generator - Standalone Build")
    print("=========================================")
    
    # Check dependencies
    check_dependencies()
    
    # Create spec file
    create_spec_file()
    
    # Build executable
    build_executable()
    
    # Create installer
    create_installer()
    
    print("\n✓ Build completed successfully!")
    print("\nFiles created:")
    print("- dist/BrailleCardGenerator.exe (Windows)")
    print("- install.bat (Windows installer)")
    print("\nTo distribute:")
    print("1. Copy the entire 'dist' folder")
    print("2. Include the README.md file")
    print("3. Optionally include install.bat for Windows users")

if __name__ == "__main__":
    main()

