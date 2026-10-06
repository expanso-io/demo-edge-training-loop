# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Serve the recorded presenter state for the public-bar browser lane."""
import argparse
import json
import os
import signal
import subprocess
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DASHBOARD = ROOT / 'dashboard'
PIDFILE = ROOT / '.runtime' / 'public-bar-server.pid'
STATE = json.loads((ROOT / 'fixtures' / 'public-bar' / 'browser-state.json').read_text())


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/state':
            body = json.dumps(STATE).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, *args):
        pass


def process(pid):
    return subprocess.run(['ps', '-p', str(pid), '-o', 'command='],
                          capture_output=True, text=True)


def stop():
    if not PIDFILE.exists():
        return
    pid = int(PIDFILE.read_text())
    found = process(pid)
    if found.returncode:
        PIDFILE.unlink()
        return
    if Path(__file__).name not in found.stdout or ' serve' not in found.stdout:
        raise RuntimeError('Public-bar server PID belongs to another process')
    os.kill(pid, signal.SIGTERM)
    deadline = time.monotonic() + 8
    while process(pid).returncode == 0 and time.monotonic() < deadline:
        time.sleep(0.1)
    if process(pid).returncode == 0:
        raise RuntimeError('Public-bar server did not stop')
    PIDFILE.unlink(missing_ok=True)


def serve(port):
    PIDFILE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if PIDFILE.exists():
        raise RuntimeError('Public-bar server is already recorded as running')
    PIDFILE.write_text(str(os.getpid()))
    handler = partial(Handler, directory=str(DASHBOARD))
    try:
        with ThreadingHTTPServer(('127.0.0.1', port), handler) as server:
            server.serve_forever()
    finally:
        PIDFILE.unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['serve', 'stop'])
    parser.add_argument('--port', type=int, default=8174)
    args = parser.parse_args()
    if args.action == 'serve':
        serve(args.port)
    else:
        stop()
