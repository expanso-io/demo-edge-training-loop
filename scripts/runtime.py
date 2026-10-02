# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Start only project-owned services; stop only recorded project processes."""
import argparse
import json
import os
import signal
import subprocess
from pathlib import Path

from cloud import ROOT, environment

RUNTIME = ROOT / '.runtime'


def start_edges():
    for name, port in [('north', 19011), ('south', 19012)]:
        pidfile = RUNTIME / f'edge-{name}.pid'
        if pidfile.exists():
            raise RuntimeError(f'{name} already has a recorded process')
        log = open(RUNTIME / f'edge-{name}.log', 'a')
        proc = subprocess.Popen([
            'expanso-edge', 'run', '--config', str(ROOT / 'config' / f'{name}.yaml'),
            '--data-dir', str(ROOT / '.expanso-edge' / name),
            '--api-listen', f'127.0.0.1:{port}', '--no-watch'],
            cwd=ROOT, env=environment(), stdout=log, stderr=subprocess.STDOUT,
            start_new_session=True)
        pidfile.write_text(str(proc.pid))
        log.close()
    directory = ROOT / '.expanso-edge' / 'training'
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    result = subprocess.run([
        'docker', 'run', '--rm', '--name', 'train-loop-enroll',
        '-e', 'EXPANSO_EDGE_BOOTSTRAP_TOKEN',
        '-v', f'{directory}:/data', 'ghcr.io/expanso-io/expanso-edge:nightly',
        'bootstrap', '--data-dir', '/data'], env=environment(), capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError('Training node enrollment failed')
    subprocess.run([
        'docker', 'run', '-d', '--name', 'train-loop-edge-training',
        '--network', 'container:train-loop-training',
        '-v', f'{directory}:/data', '-v', f'{ROOT / "config"}:/config:ro',
        'ghcr.io/expanso-io/expanso-edge:nightly', 'run',
        '--data-dir', '/data', '--config', '/config/training.yaml', '--no-watch'], check=True)


def stop():
    for pidfile in RUNTIME.glob('*.pid'):
        pid = int(pidfile.read_text())
        process = subprocess.run(['ps', '-p', str(pid), '-o', 'command='], capture_output=True, text=True)
        if process.returncode == 0:
            if str(ROOT) not in process.stdout:
                raise RuntimeError(f'Process identity mismatch for {pidfile.name}')
            os.killpg(pid, signal.SIGTERM)
        pidfile.unlink()
    for name in ('train-loop-edge-training', 'train-loop-training', 'train-loop-north', 'train-loop-south'):
        found = subprocess.run(['docker', 'container', 'inspect', name], capture_output=True)
        if found.returncode == 0:
            subprocess.run(['docker', 'stop', name], check=True)
            subprocess.run(['docker', 'rm', name], check=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['edges', 'stop'])
    args = parser.parse_args()
    if args.action == 'edges':
        start_edges()
    else:
        stop()
