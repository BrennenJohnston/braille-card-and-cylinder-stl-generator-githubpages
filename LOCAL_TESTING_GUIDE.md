# Local GitHub Pages Testing Guide

This guide explains how to test the Braille Card and Cylinder STL Generator locally in a way that mimics the GitHub Pages deployment environment.

## Overview

All STL generation happens in the browser using Three.js (no backend).
This testing setup mimics the GitHub Pages deployment where everything runs client-side.

## Quick Start

### Windows Users:
1. Simply double-click `test_github_pages_locally.bat`
2. Your browser will automatically open to the application

### Mac/Linux Users:
```bash
python3 local_github_pages_server.py
```

## How It Works

The `local_github_pages_server.py` script creates a local web server that:
- Mimics the GitHub Pages URL structure (`/braille-card-and-cylinder-stl-generator-githubpages/`)
- Serves static files with proper CORS headers
- Handles the redirect from root to the actual application
- Opens your browser automatically

## Testing Checklist

### Basic Functionality:
- [ ] Text input and braille translation works
- [ ] Language selection dropdown loads all languages
- [ ] 3D preview updates when text changes
- [ ] STL download works for embossing plate
- [ ] STL download works for counter plate
- [ ] Cylinder mode works correctly
- [ ] Expert mode parameters can be adjusted

### GitHub Pages Specific:
- [ ] All static assets load correctly (check browser console for errors)
- [ ] Liblouis library loads and initializes
- [ ] STL generation happens in browser (no backend calls)
- [ ] Downloads work without server interaction

### Different Browsers:
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari

### Accessibility:
- [ ] Screen reader announces changes
- [ ] Keyboard navigation works
- [ ] High contrast mode displays correctly

## Troubleshooting

### Server won't start:
- Make sure Python 3 is installed: `python --version` or `python3 --version`
- Check that port 8000 is not in use
- Run from the project root directory

### Assets not loading:
- Check browser console (F12) for 404 errors
- Verify all files in `/static/` directory are present
- Clear browser cache (Ctrl+Shift+R)

### STL generation fails:
- Check browser console for JavaScript errors
- Verify Three.js modules loaded correctly
- Test with simple text first (single character)

### Liblouis not working:
- Check that `/static/liblouis/` files are present
- Verify tables loaded in browser console
- Try with default English UEB language first

## Key Differences from Production

1. **URL Structure**: Local server mimics GitHub's repository-based URLs
2. **No Backend**: All processing happens client-side
3. **CORS**: Local server adds permissive CORS headers for testing

## Advanced Testing

### Testing specific scenarios:

1. **Large text input**: Test with maximum characters (12 per line, 4 lines)
2. **Special characters**: Test various Unicode ranges
3. **Different languages**: Test each language option
4. **Export sizes**: Verify STL files are reasonable sizes
5. **Performance**: Check 3D preview performance with complex models

### Browser Developer Tools:

1. **Network tab**: Verify no backend API calls are made
2. **Console**: Check for any JavaScript errors
3. **Performance**: Monitor memory usage during STL generation

## Debugging Tips

1. **Enable verbose logging**: 
   ```javascript
   // In browser console
   localStorage.setItem('debug', 'true');
   ```

2. **Check Liblouis initialization**:
   ```javascript
   // In browser console after page loads
   console.log(liblouis);
   ```

3. **Test STL generation directly**:
   ```javascript
   // In browser console
   const testButton = document.querySelector('[aria-label="Download STL"]');
   testButton.click();
   ```

## File Structure for GitHub Pages

```
/braille-card-and-cylinder-stl-generator-githubpages/
├── index.html                  # Redirect to templates/index.html
├── templates/
│   └── index.html             # Main application
└── static/
    ├── *.js                   # JavaScript modules
    ├── liblouis/              # Braille translation library
    └── tables-manifest.json   # Language configuration
```

## Deployment Verification

After testing locally, before pushing to GitHub Pages:

1. Ensure `backendAvailable = false` in `templates/index.html`
2. Verify all paths use relative references or respect the base tag
3. Check that no server-side features are enabled
4. Test the actual GitHub Pages deployment after pushing

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify all files are committed to git
3. Compare local behavior with the live GitHub Pages site
4. Check GitHub Pages build logs for deployment errors
