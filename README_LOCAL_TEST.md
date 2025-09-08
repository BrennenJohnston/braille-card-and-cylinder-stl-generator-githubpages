# 🧪 Local GitHub Pages Testing Environment

This setup allows you to test the Braille Card and Cylinder STL Generator locally exactly as it will run on GitHub Pages.

## 🚀 Quick Start

### Option 1: Windows Batch File (Easiest)
```
double-click test_github_pages_locally.bat
```

### Option 2: PowerShell
```powershell
.\test_github_pages_locally.ps1
```

### Option 3: Direct Python
```bash
python local_github_pages_server.py
```

## 📋 What's Included

- **`local_github_pages_server.py`** - Python server that mimics GitHub Pages URL structure
- **`test_github_pages_locally.bat`** - Windows batch file for easy launching
- **`test_github_pages_locally.ps1`** - PowerShell script alternative
- **`verify_github_pages_files.py`** - Verifies all required files are present
- **`LOCAL_TESTING_GUIDE.md`** - Comprehensive testing guide

## 🔍 How It Works

1. The server creates the same URL structure as GitHub Pages (`/braille-card-and-cylinder-stl-generator-githubpages/`)
2. All STL generation happens in your browser using Three.js
3. No backend server is used - pure client-side operation
4. Your browser automatically opens to the correct URL

## ✅ Pre-flight Check

Run this before testing:
```bash
python verify_github_pages_files.py
```

## 🌐 URLs

- **Server**: http://localhost:8000/braille-card-and-cylinder-stl-generator-githubpages/
- **Direct App**: http://localhost:8000/braille-card-and-cylinder-stl-generator-githubpages/templates/index.html

## 🐛 Debugging

If something doesn't work:

1. **Check Console**: Press F12 in browser and check for errors
2. **Verify Files**: Run `python verify_github_pages_files.py`
3. **Clear Cache**: Ctrl+Shift+R in browser
4. **Check Port**: Ensure port 8000 is free

## 📝 Key Features to Test

- ✏️ Text input and braille translation
- 🌐 Language selection (all languages should load)
- 👁️ 3D preview updates
- 💾 STL downloads (embossing & counter plates)
- 🎛️ Expert mode parameters
- ♿ Accessibility features

## 🔄 Differences from Production

| Feature | Local Test | GitHub Pages |
|---------|------------|--------------|
| URL | localhost:8000 | github.io |
| HTTPS | No | Yes |
| Caching | Disabled | Enabled |
| CORS | Permissive | Restricted |

## 💡 Tips

- Test in multiple browsers (Chrome, Firefox, Safari)
- Try different screen sizes and mobile view
- Test with screen readers for accessibility
- Monitor browser console for any errors

---

**Ready to test?** Just run one of the launch scripts above! 🚀
