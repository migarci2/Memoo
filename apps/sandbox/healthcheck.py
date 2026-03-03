"""Tiny health endpoint for the sandbox container."""
import http.server
import json
import subprocess
import sys


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            # Check if Chromium is running
            try:
                result = subprocess.run(
                    ['pgrep', '-f', 'chromium'], capture_output=True, timeout=2,
                )
                ok = result.returncode == 0
            except Exception:
                ok = False

            status = 200 if ok else 503
            body = json.dumps({'status': 'ok' if ok else 'unhealthy', 'service': 'sandbox'})
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(body.encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *_):
        pass  # silence logs


if __name__ == '__main__':
    server = http.server.HTTPServer(('0.0.0.0', 8585), Handler)
    print('[health] Listening on :8585')
    sys.stdout.flush()
    server.serve_forever()
