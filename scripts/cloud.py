# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Run the CLI with this project's owner-only credentials, never a profile."""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def environment():
    path = ROOT / '.env'
    if path.stat().st_mode & 0o777 != 0o600:
        raise ValueError('Project .env must be owner-only (600)')
    env = os.environ.copy()
    env.pop('EXPANSO_CLI_PROFILE', None)
    for line in path.read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            env[key.strip()] = value.strip().strip('\"').strip("'")
    for key in ('EXPANSO_CLI_API_KEY', 'EXPANSO_CLI_ENDPOINT', 'EXPANSO_EDGE_BOOTSTRAP_TOKEN'):
        if not env.get(key):
            raise ValueError(f'Missing {key}')
    return env


if __name__ == '__main__':
    raise SystemExit(subprocess.call(['expanso-cli', *sys.argv[1:]], env=environment()))
