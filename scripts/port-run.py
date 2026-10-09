"""Resolve sticky localhost services before a lifecycle command imports defaults."""
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    mode, *command = sys.argv[1:]
    if mode not in ("start", "read") or not command:
        raise SystemExit("usage: port-run.py start|read COMMAND...")
    args = ["uv", "run", "--no-project", str(ROOT / "scripts/demo-ports.py"), "resolve", "--demo-dir", str(ROOT), "--format", "json"]
    if mode == "read":
        args.append("--allow-bound")
    assigned = json.loads(subprocess.check_output(args, text=True))
    env = dict(os.environ, **{name: str(value) for name, value in assigned.items()})
    if "SPACE_FORCE_SINK_PORT" in assigned:
        for tier in ("raw", "aggregate", "priority", "tripwire", "quarantine", "partner", "detection", "parquet"):
            env["SPACE_FORCE_SINK_" + tier.upper()] = f"http://127.0.0.1:{assigned['SPACE_FORCE_SINK_PORT']}/ingest/{tier}"
    os.execvpe(command[0], command, env)


if __name__ == "__main__":
    main()
