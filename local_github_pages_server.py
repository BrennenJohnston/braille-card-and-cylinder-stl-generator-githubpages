#!/usr/bin/env python3
"""
Local GitHub Pages Test Server
This server mimics the GitHub Pages deployment environment for testing.
"""
import http.server
import socketserver
import os
import sys
from urllib.parse import urlparse
import webbrowser
import time
import argparse

# Configuration
PORT = 8000
REPO_NAME = "braille-card-and-cylinder-stl-generator-githubpages"

class GitHubPagesHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler to mimic GitHub Pages URL structure"""
    
    def translate_path(self, path):
        """Override to handle GitHub Pages-style paths"""
        parsed_path = urlparse(path).path
        
        # Strip the repository prefix if present so URLs like
        # /<REPO_NAME>/templates/index.html map to ./templates/index.html
        if parsed_path.startswith(f"/{REPO_NAME}/"):
            local_path = parsed_path[len(f"/{REPO_NAME}/"):]
        else:
            local_path = parsed_path.lstrip('/')
        
        if local_path in ('', '/'):  # default document
            local_path = 'index.html'
        
        self.path = '/' + local_path
        return super().translate_path(self.path)

    def do_GET(self):
        """Redirect /<REPO_NAME>/ to the app, otherwise serve normally"""
        parsed_path = urlparse(self.path).path
        if parsed_path in (f"/{REPO_NAME}", f"/{REPO_NAME}/"):
            self.send_response(301)
            self.send_header('Location', f'/{REPO_NAME}/templates/index.html')
            self.end_headers()
            return
        return super().do_GET()
    
    def end_headers(self):
        """Add CORS headers for local testing"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Disable caching for easier local debugging
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

def run_server(port: int = PORT, open_browser: bool = True, strict_port: bool = False):
    """Run the local GitHub Pages test server.

    Args:
        port: Preferred port to bind to.
        open_browser: If True, open the system browser to the app URL.
        strict_port: If True, do not fallback to another port when busy.
    """
    print("Starting local GitHub Pages test server...")
    print(f"Repository name: {REPO_NAME}")
    
    # Change to the script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    # Allow quick reuse and pick a free port if the default is busy
    socketserver.TCPServer.allow_reuse_address = True

    chosen_port = None
    last_err = None
    candidates = [port] if strict_port else [port] + list(range(port + 1, port + 11))
    for candidate in candidates:
        try:
            httpd = socketserver.TCPServer(("", candidate), GitHubPagesHandler)
            chosen_port = candidate
            break
        except OSError as e:
            last_err = e
            continue

    if chosen_port is None:
        if strict_port:
            print(f"Failed to start server: port {port} is busy and strict_port enabled")
        else:
            print("Failed to start server: no free port found near", port)
        if last_err:
            print("Last error:", last_err)
        sys.exit(1)

    print(f"Port: {chosen_port}")
    print("-" * 50)

    try:
        with httpd:
            url = f"http://localhost:{chosen_port}/{REPO_NAME}/"
            print(f"Server running at: {url}")
            print(f"Direct app URL: http://localhost:{chosen_port}/{REPO_NAME}/templates/index.html")
            print("\nPress Ctrl+C to stop the server")
            print("-" * 50)

            if open_browser:
                # Open browser after a short delay
                time.sleep(1)
                print(f"Opening browser to {url}")
                webbrowser.open(url)

            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        try:
            httpd.shutdown()
        except Exception:
            pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Local GitHub Pages test server")
    parser.add_argument("--port", type=int, default=PORT, help="Port to bind to (default: 8000)")
    parser.add_argument("--no-open", action="store_true", help="Do not open a browser window")
    parser.add_argument("--strict-port", action="store_true", help="Fail if the specified port is busy; do not fallback")
    args = parser.parse_args()

    run_server(port=args.port, open_browser=not args.no_open, strict_port=args.strict_port)
