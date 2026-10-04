# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Explicit operator lifecycle; the presenter cannot invoke these commands."""
import argparse
import json
import os
import signal
import subprocess
import time
import urllib.request
from pathlib import Path

from cloud import ROOT, environment

RUNTIME = ROOT / '.runtime'
EDGE_IMAGE = 'ghcr.io/expanso-io/expanso-edge@sha256:bf767228d1a104a450550580118a6d4225352187fd75cc86a7d43760804c5ad1'
CONTAINERS = ('train-loop-edge-training', 'train-loop-training', 'train-loop-north', 'train-loop-south')
JOBS = tuple('train-loop-' + name for name in ('collect-north', 'collect-south', 'teacher', 'training-trigger', 'rollout-north', 'rollout-south'))


def run(args, **kwargs):
    return subprocess.run(args, check=True, cwd=ROOT, **kwargs)


def cloud(*args):
    return run(['expanso-cli', *args], env=environment(), capture_output=True, text=True).stdout


def alive(pidfile):
    if not pidfile.exists():
        return False
    pid = int(pidfile.read_text())
    result = subprocess.run(['ps', '-p', str(pid), '-o', 'command='], capture_output=True, text=True)
    if result.returncode:
        pidfile.unlink()
        return False
    if str(ROOT) not in result.stdout:
        raise RuntimeError(f'Process identity mismatch: {pidfile.name}')
    return True


def spawn(name, args, env=None):
    path = RUNTIME / f'{name}.pid'
    if alive(path):
        return
    with (RUNTIME / f'{name}.log').open('a') as log:
        process = subprocess.Popen(args, cwd=ROOT, env=env, stdout=log,
                                   stderr=subprocess.STDOUT, start_new_session=True)
    path.write_text(str(process.pid))


def wait_http(port):
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/' + ('api/state' if port == 8024 else 'state'), timeout=2) as response:
                return json.load(response)
        except OSError:
            time.sleep(1)
    raise RuntimeError(f'Local service {port} did not become ready')


def start_edges():
    for name, port in [('north', 19011), ('south', 19012)]:
        directory = ROOT / '.expanso-edge' / name
        if not (directory / 'identity').exists():
            directory.mkdir(parents=True, mode=0o700, exist_ok=True)
            run(['expanso-edge', 'bootstrap', '--data-dir', str(directory)], env=environment(), capture_output=True)
        spawn(f'edge-{name}', ['expanso-edge', 'run', '--config', str(ROOT / 'config' / f'{name}.yaml'),
                             '--data-dir', str(directory), '--name', f'train-loop-{name}',
                             '--api-listen', f'127.0.0.1:{port}', '--no-watch'], environment())
    directory = ROOT / '.expanso-edge' / 'training'
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    if not (directory / 'identity').exists():
        run(['docker', 'run', '--rm', '--name', 'train-loop-enroll', '-e', 'EXPANSO_EDGE_BOOTSTRAP_TOKEN',
             '-v', f'{directory}:/data', EDGE_IMAGE, 'bootstrap', '--data-dir', '/data'],
            env=environment(), capture_output=True)
    run(['docker', 'run', '-d', '--name', CONTAINERS[0], '--label', 'demo=demo-edge-training-loop',
         '--network', 'container:train-loop-training', '-v', f'{directory}:/data',
         '-v', f'{ROOT / "config"}:/config:ro', EDGE_IMAGE, 'run', '--name', 'train-loop-training',
         '--data-dir', '/data', '--config', '/config/training.yaml', '--no-watch'])


def up():
    RUNTIME.mkdir(mode=0o700, exist_ok=True)
    if any(alive(path) for path in RUNTIME.glob('*.pid')):
        raise RuntimeError('Already running; use down before up')
    if subprocess.run(['docker', 'info'], capture_output=True).returncode:
        run(['docker', 'desktop', 'start'])
        (RUNTIME / 'docker-owned').touch()
    # Containers left by a stopped Docker or a killed session are dead weight,
    # not state: clear them. Only a running demo container means "use down".
    running = run(['docker', 'ps', '--format', '{{.Names}}'], capture_output=True, text=True).stdout.splitlines()
    if set(running) & set(CONTAINERS):
        raise RuntimeError('Demo containers already running; use down first')
    existing = run(['docker', 'ps', '-a', '--format', '{{.Names}}'], capture_output=True, text=True).stdout.splitlines()
    for stale in sorted(set(existing) & set(CONTAINERS)):
        run(['docker', 'rm', '-f', stale], capture_output=True)
    run(['docker', 'build', '-t', 'train-loop-local', '.'])
    for role, port, state in [('training', 8025, 'state'), ('north', 8026, 'north'), ('south', 8027, 'south')]:
        directory = RUNTIME / state
        directory.mkdir(mode=0o700, exist_ok=True)
        args = ['docker', 'run', '-d', '--name', f'train-loop-{role}', '--label', 'demo=demo-edge-training-loop',
                '-p', f'127.0.0.1:{port}:8025', '-v', f'{directory}:/state',
                '-v', f'{ROOT / ".models"}:/state/models', '-e', 'TRAIN_STATE=/state', '-e', f'TRAIN_ROLE={role}']
        if role == 'training':
            args += ['-p', '127.0.0.1:18110:18110']
        run(args + ['train-loop-local'])
        wait_http(port)
    start_edges()
    spawn('dashboard', ['uv', 'run', '-s', str(ROOT / 'scripts/dashboard.py'), '--port', '8024'])
    wait_http(8024)
    print('Local services ready at http://localhost:8024; deploy jobs separately.')


def deploy():
    for path in sorted((ROOT / 'pipelines').glob('*.yaml')):
        result = subprocess.run(['expanso-cli', 'job', 'deploy', str(path)],
                                env=environment(), capture_output=True, text=True, cwd=ROOT)
        if result.returncode and 'NO_CHANGES_DETECTED' not in result.stderr:
            raise RuntimeError(result.stderr)
        print(result.stdout or f'{path.name}: unchanged')
    jobs = json.loads(cloud('job', 'list', '--format', 'json'))
    for job in jobs:
        if job['spec']['name'] in JOBS and job['status']['state']['state_type'].lower() == 'stopped':
            print(cloud('job', 'rerun', job['spec']['name']))
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        jobs = json.loads(cloud('job', 'list', '--format', 'json'))
        states = {j['spec']['name']: j['status']['state']['state_type'] for j in jobs if j['spec']['name'] in JOBS}
        if len(states) == 6 and all(state.lower() == 'running' for state in states.values()):
            print('All six demo jobs Running in Expanso Cloud.')
            return
        time.sleep(3)
    raise RuntimeError(f'Jobs not ready: {states}')


def stop():
    for name in JOBS:
        print(cloud('job', 'stop', name, '--force'))
    for pidfile in RUNTIME.glob('*.pid'):
        if alive(pidfile):
            os.killpg(int(pidfile.read_text()), signal.SIGTERM)
        pidfile.unlink(missing_ok=True)
    if subprocess.run(['docker', 'info'], capture_output=True).returncode == 0:
        for name in CONTAINERS:
            found = subprocess.run(['docker', 'inspect', name], capture_output=True, text=True)
            if found.returncode == 0:
                info = json.loads(found.stdout)[0]
                if info['Config'].get('Labels', {}).get('demo') != 'demo-edge-training-loop':
                    raise RuntimeError(f'Container ownership mismatch: {name}')
                run(['docker', 'stop', name])
                run(['docker', 'rm', name])
        if (RUNTIME / 'docker-owned').exists():
            others = run(['docker', 'ps', '-q'], capture_output=True, text=True).stdout.strip()
            if not others:
                run(['docker', 'desktop', 'stop'])
                (RUNTIME / 'docker-owned').unlink()
            else:
                print('Docker retained: other containers are running.')


def reset():
    if any(alive(path) for path in RUNTIME.glob('*.pid')):
        raise RuntimeError('Run down before reset')
    if subprocess.run(['docker', 'info'], capture_output=True).returncode == 0:
        names = run(['docker', 'ps', '-a', '--format', '{{.Names}}'], capture_output=True, text=True).stdout.splitlines()
        if set(names) & set(CONTAINERS):
            raise RuntimeError('Run down before reset')
    archive = RUNTIME / 'archive' / str(time.time_ns())
    archive.mkdir(parents=True, mode=0o700)
    for name in ('state', 'north', 'south'):
        path = RUNTIME / name
        if path.exists():
            path.rename(archive / name)
    print(f'Previous run preserved at {archive}; next up starts at zero.')


def action(name):
    request = urllib.request.Request('http://127.0.0.1:8025/' + name,
                                     data=b'{}', headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=10) as response:
        print(response.read().decode())


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['up', 'deploy', 'down', 'reset', 'rollback', 'release-again'])
    args = parser.parse_args()
    if args.action in ('rollback', 'release-again'):
        action(args.action)
    else:
        {'up': up, 'deploy': deploy, 'down': stop, 'reset': reset}[args.action]()
