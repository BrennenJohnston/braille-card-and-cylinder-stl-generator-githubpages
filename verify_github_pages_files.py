#!/usr/bin/env python3
"""
Verify that all necessary files are present for GitHub Pages deployment
"""
import os
import sys

# Define required files and directories
REQUIRED_FILES = [
    "index.html",
    "templates/index.html",
    "static/app-config.js",
    "static/three.module.js",
    "static/OrbitControls.js",
    "static/STLLoader.js",
    "static/geometry.js",
    "static/export-stl.js",
    "static/liblouis/build-no-tables-utf16.js",
    "static/liblouis/easy-api.js",
    "static/tables-manifest.json",
    "static/favicon.svg"
]

REQUIRED_DIRS = [
    "static",
    "static/liblouis",
    "static/liblouis/tables",
    "templates"
]

def check_files():
    """Check if all required files exist"""
    print("Verifying GitHub Pages deployment files...\n")
    
    missing_files = []
    missing_dirs = []
    
    # Check directories
    print("Checking directories:")
    for dir_path in REQUIRED_DIRS:
        if os.path.isdir(dir_path):
            print(f"  ✓ {dir_path}")
        else:
            print(f"  ✗ {dir_path} - MISSING!")
            missing_dirs.append(dir_path)
    
    print("\nChecking required files:")
    # Check files
    for file_path in REQUIRED_FILES:
        if os.path.isfile(file_path):
            size = os.path.getsize(file_path)
            print(f"  ✓ {file_path} ({size:,} bytes)")
        else:
            print(f"  ✗ {file_path} - MISSING!")
            missing_files.append(file_path)
    
    # Check for Liblouis tables
    print("\nChecking Liblouis tables:")
    tables_dir = "static/liblouis/tables"
    if os.path.isdir(tables_dir):
        table_files = [f for f in os.listdir(tables_dir) if f.endswith(('.ctb', '.utb', '.tbl'))]
        print(f"  ✓ Found {len(table_files)} table files")
        if len(table_files) < 10:
            print(f"  ⚠ Warning: Expected more table files, only found {len(table_files)}")
    else:
        print(f"  ✗ Tables directory not found!")
    
    # Summary
    print("\n" + "="*50)
    if not missing_files and not missing_dirs:
        print("✅ All required files are present!")
        print("You can now run: python local_github_pages_server.py")
        return True
    else:
        print("❌ Some files are missing!")
        if missing_dirs:
            print(f"\nMissing directories: {len(missing_dirs)}")
            for d in missing_dirs:
                print(f"  - {d}")
        if missing_files:
            print(f"\nMissing files: {len(missing_files)}")
            for f in missing_files:
                print(f"  - {f}")
        print("\nPlease ensure all files are present before testing.")
        return False

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    success = check_files()
    sys.exit(0 if success else 1)
