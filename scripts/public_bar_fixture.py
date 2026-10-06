# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Run the five Cloud-managed jobs against recorded, non-metered fixture answers."""
import argparse
import hashlib
import json
import socket
import sqlite3
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import runtime

ROOT = Path(__file__).resolve().parent.parent


def wait_until(label, predicate, timeout=300):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = predicate()
        if value:
            return value
        time.sleep(1)
    raise RuntimeError(f'Timed out waiting for {label}')


def state():
    try:
        with urllib.request.urlopen('http://127.0.0.1:8025/state', timeout=3) as response:
            return json.load(response)
    except OSError:
        return None


def port_ready(port):
    try:
        with socket.create_connection(('127.0.0.1', port), timeout=1):
            return True
    except OSError:
        return False


def job_states():
    jobs = json.loads(runtime.cloud('job', 'list', '--format', 'json'))
    return {job['spec']['name']: job['status']['state']['state_type']
            for job in jobs if job['spec']['name'] in runtime.JOBS}


def all_jobs_running():
    states = job_states()
    return states if len(states) == len(runtime.JOBS) and all(
        value.lower() == 'running' for value in states.values()) else None


def completed_state():
    current = state()
    if not current or current['training']['status'] != 'passed':
        return None
    versions = set(current['sites'].values())
    if len(versions) != 1 or 'base' in versions:
        return None
    return current


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run_proof(output):
    runtime.stop()
    runtime.reset()
    runtime.deploy()
    runtime.start_services(fixture=True, simulator=False)
    started = datetime.now(timezone.utc)
    run_id = f'public-bar-{started:%Y%m%dT%H%M%SZ}'
    try:
        for name in runtime.JOBS:
            runtime.cloud('job', 'rerun', name)
        running = wait_until('five Cloud jobs to run', all_jobs_running)
        wait_until('North collection input', lambda: port_ready(18101), timeout=120)
        wait_until('South collection input', lambda: port_ready(18102), timeout=120)
        subprocess.run([
            'uv', 'run', '-s', str(ROOT / 'scripts' / 'producer.py'),
            '--count', '8', '--run', run_id,
        ], cwd=ROOT, check=True)
        final = wait_until('training gate and both rollout receipts', completed_state)
        with sqlite3.connect(runtime.RUNTIME / 'state' / 'loop.sqlite') as database:
            events = [{'stage': row[0], 'message': row[1]}
                      for row in database.execute('SELECT stage,message FROM events ORDER BY seq')]
        seen = {event['stage'] for event in events}
        required = {'collect', 'teacher', 'review', 'training', 'gate', 'rollout'}
        missing = required - seen
        if missing:
            raise RuntimeError(f'Missing receipt stages: {sorted(missing)}')
        payload = {
            'proof_date': started.date().isoformat(),
            'started_at': started.isoformat(),
            'source_commit': subprocess.run(
                ['git', 'rev-parse', 'HEAD'], cwd=ROOT, check=True,
                capture_output=True, text=True).stdout.strip(),
            'expanso_edge_version': subprocess.run(
                ['expanso-edge', 'version'], check=True,
                capture_output=True, text=True).stdout.strip(),
            'run_id': run_id,
            'jobs_while_running': running,
            'pipeline_sha256': {
                path.name: digest(path) for path in sorted((ROOT / 'pipelines').glob('*.yaml'))
            },
            'assertions': {
                'records_received': len(final['records']),
                'training_status': final['training']['status'],
                'gate_status': final['rounds'][-1]['status'],
                'baseline_score': final['rounds'][-1]['baseline']['passed'],
                'candidate_score': final['rounds'][-1]['candidate']['passed'],
                'held_out_total': final['rounds'][-1]['candidate']['total'],
                'north_receipt': final['site_checks']['north']['status'],
                'south_receipt': final['site_checks']['south']['status'],
                'sites': final['sites'],
                'receipt_stages': sorted(seen),
            },
            'state': final,
        }
        output.write_text(json.dumps(payload, indent=2) + '\n')
        print(f'proof written: {output.relative_to(ROOT)}')
    finally:
        runtime.stop()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path,
                        default=ROOT / 'docs' / 'evidence' / 'public-bar-2026-10-05.json')
    args = parser.parse_args()
    output = args.output.resolve()
    if output.parent != (ROOT / 'docs' / 'evidence').resolve():
        parser.error('Output must stay in docs/evidence')
    try:
        run_proof(output)
    except Exception as error:
        print(f'proof failed: {error}', file=sys.stderr)
        raise
