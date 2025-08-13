#!/usr/bin/env python3
"""
Setup script for creating standalone executable using cx_Freeze.
This is an alternative to PyInstaller that may work better on some systems.
"""

import sys
import os
from cx_Freeze import setup, Executable

# Dependencies are automatically detected, but it might need fine tuning.
build_exe_options = {
    "packages": [
        "flask", 
        "trimesh", 
        "numpy", 
        "flask_cors", 
        "werkzeug", 
        "jinja2", 
        "markupsafe", 
        "itsdangerous", 
        "click", 
        "blinker",
        "tkinter",
        "threading",
        "webbrowser",
        "subprocess",
        "platform",
        "pathlib",
        "tempfile",
        "json",
        "socket"
    ],
    "excludes": [],
    "include_files": [
        ("templates", "templates"),
        ("static", "static"),
        ("third_party/liblouis", "third_party/liblouis"),
        ("README.md", "README.md"),
    ],
    "include_msvcr": True,
}

# GUI applications require a different base on Windows
base = None
if sys.platform == "win32":
    base = "Win32GUI"

# Create executables
executables = [
    Executable(
        "desktop_app.py", 
        base=base,
        target_name="BrailleCardGenerator.exe",
        icon="static/icon.ico" if os.path.exists("static/icon.ico") else None,
    ),
    Executable(
        "backend.py", 
        base=base,
        target_name="BrailleCardGenerator_Web.exe",
        icon="static/icon.ico" if os.path.exists("static/icon.ico") else None,
    ),
]

setup(
    name="BrailleCardGenerator",
    version="1.0.0",
    description="3D printable braille business card generator",
    options={"build_exe": build_exe_options},
    executables=executables,
)

