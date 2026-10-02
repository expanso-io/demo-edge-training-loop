# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Local presenter proxy. This surface cannot change Cloud job lifecycle."""
import argparse
import json
import urllib.error
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DASHBOARD = ROOT / 'dashboard'
BACKEND = 'http://127.0.0.1:8025'


class Handler(SimpleHTTPRequestHandler):
    def json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def proxy(self, path, payload=None):
        try:
            request = urllib.request.Request(BACKEND + path, data=payload,
                                             headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(request, timeout=10) as response:
                self.json(200, json.load(response))
        except urllib.error.HTTPError as error:
            self.json(error.code, json.load(error))
        except (OSError, ValueError):
            self.json(503, {'error': 'Local training node unavailable'})

    def do_GET(self):
        if self.path == '/api/state':
            self.proxy('/state')
        elif self.path.startswith('/api/'):
            self.json(404, {'error': 'Unknown endpoint'})
        else:
            super().do_GET()

    def do_POST(self):
        if self.path != '/api/approve':
            self.json(404, {'error': 'Unknown endpoint'})
            return
        origin = self.headers.get('Origin')
        expected = {f'http://localhost:{self.server.server_port}',
                    f'http://127.0.0.1:{self.server.server_port}'}
        if origin not in expected or self.headers.get_content_type() != 'application/json':
            self.json(403, {'error': 'Approval must come from the local board'})
            return
        size = int(self.headers.get('Content-Length', '0'))
        if not 0 < size < 10000:
            self.json(400, {'error': 'Invalid approval size'})
            return
        self.proxy('/approve', self.rfile.read(size))

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8024)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        for name in ('index.html', 'styles.css', 'app.js'):
            assert (DASHBOARD / name).is_file()
        print('ok: presenter files exist; live state requires the training service')
    else:
        handler = partial(Handler, directory=str(DASHBOARD))
        with ThreadingHTTPServer(('127.0.0.1', args.port), handler) as server:
            server.serve_forever()
