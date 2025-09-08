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

# Configuration
PORT = 8000
REPO_NAME = "braille-card-and-cylinder-stl-generator-githubpages"

class GitHubPagesHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler to mimic GitHub Pages URL structure"""
    
    def translate_path(self, path):
        """Override to handle GitHub Pages-style paths"""
        # Parse the URL path
        parsed_path = urlparse(path).path
        
        # Handle root redirect
        if parsed_path == f"/{REPO_NAME}/" or parsed_path == f"/{REPO_NAME}":
            # Redirect to the actual app
            self.send_response(301)
            self.send_header('Location', f'/{REPO_NAME}/templates/index.html')
            self.end_headers()
            return None
            
        # Remove the repository prefix to map to local files
        if parsed_path.startswith(f"/{REPO_NAME}/"):
            local_path = parsed_path[len(f"/{REPO_NAME}/"):]
        else:
            local_path = parsed_path.lstrip('/')
            
        # Map to the actual file system
        if local_path == '':
            local_path = 'index.html'
            
        # Use the parent class method to get the full path
        self.path = '/' + local_path
        return super().translate_path(self.path)
    
    def end_headers(self):
        """Add CORS headers for local testing"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def run_server():
    """Run the local GitHub Pages test server"""
    print(f"Starting local GitHub Pages test server...")
    print(f"Repository name: {REPO_NAME}")
    print(f"Port: {PORT}")
    print("-" * 50)
    
    # Change to the script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), GitHubPagesHandler) as httpd:
        url = f"http://localhost:{PORT}/{REPO_NAME}/"
        print(f"Server running at: {url}")
        print(f"Direct app URL: http://localhost:{PORT}/{REPO_NAME}/templates/index.html")
        print("\nPress Ctrl+C to stop the server")
        print("-" * 50)
        
        # Open browser after a short delay
        time.sleep(1)
        print(f"Opening browser to {url}")
        webbrowser.open(url)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.shutdown()

if __name__ == "__main__":
    run_server()
