# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Local presenter proxy. This surface cannot change Cloud job lifecycle."""
import argparse
import json
import threading
import time
import subprocess

from cloud import environment
import urllib.error
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DASHBOARD = ROOT / 'dashboard'
BACKEND = 'http://127.0.0.1:8025'
CLOUD = {'checked': 0, 'mode': 'Cloud status awaiting verification', 'running': 0, 'total': 0}
JOBS = 5


def poll_cloud():
    while True:
        try:
            result = subprocess.run(['expanso-cli', 'job', 'list', '--format', 'json'],
                                    env=environment(), capture_output=True, text=True, timeout=12, check=True)
            jobs = [job for job in json.loads(result.stdout)
                    if job['spec']['name'].startswith('train-loop-')]
            running = sum(job['status']['state']['state_type'].lower() == 'running' for job in jobs)
            CLOUD.update(checked=time.time(), mode=f'Expanso Cloud: {running}/{JOBS} jobs Running',
                         running=running, total=JOBS)
        except (OSError, ValueError, subprocess.SubprocessError):
            CLOUD.update(checked=time.time(), mode='Cloud status unavailable; local receipts only',
                         running=0, total=0)
        time.sleep(15)



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
                data = json.load(response)
                if path == '/state':
                    fresh = time.time() - CLOUD['checked'] < 30
                    data['mode'] = CLOUD['mode'] if fresh else 'Cloud status stale; local receipts only'
                    # total 0 means unknown: the board shows the edge live on local receipts alone
                    data['cloud'] = {'running': CLOUD['running'], 'total': CLOUD['total']} if fresh else {'running': 0, 'total': 0}
                self.json(200, data)
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
        threading.Thread(target=poll_cloud, daemon=True).start()
        handler = partial(Handler, directory=str(DASHBOARD))
        with ThreadingHTTPServer(('127.0.0.1', args.port), handler) as server:
            server.serve_forever()
