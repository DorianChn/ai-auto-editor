"""FlowCut Desktop — pywebview wrapper for the FlowCut web app."""
import os
import sys
import threading
import http.server
import socketserver

PORT = 18923

def get_dist_dir():
    if getattr(sys, 'frozen', False):
        return os.path.join(sys._MEIPASS, 'dist')
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist')

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=get_dist_dir(), **kwargs)
    def log_message(self, format, *args):
        pass

def start_server():
    with socketserver.TCPServer(("127.0.0.1", PORT), QuietHandler) as httpd:
        httpd.serve_forever()

def main():
    import webview
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    window = webview.create_window(
        title="FlowCut",
        url=f"http://127.0.0.1:{PORT}/index.html",
        width=1200,
        height=800,
        min_size=(800, 600),
        resizable=True,
    )
    webview.start(debug=False)

if __name__ == "__main__":
    main()
