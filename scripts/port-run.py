"""Resolve sticky localhost services before a lifecycle command imports defaults.

Canonical copy lives in _demo-kit; demos vendor it as scripts/port-run.py and
sync-demo-ports.py keeps the copies identical. A port collision exits 1 with the
allocator's diagnostic plus the process holding each port, never a traceback.
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUSY = re.compile(r"([A-Z][A-Z0-9_]*)=(\d+)")


def listeners(port):
    """Return 'pid command' lines for processes listening on port, or []."""
    try:
        out = subprocess.run(
            ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-Fp"],
            capture_output=True, text=True, timeout=5,
        ).stdout
    except (OSError, subprocess.TimeoutExpired):
        return []
    found = []
    for pid in sorted({line[1:] for line in out.splitlines() if line.startswith("p")}):
        ps = subprocess.run(
            ["ps", "-o", "command=", "-p", pid], capture_output=True, text=True
        ).stdout.strip()
        if ps:
            # Basename the interpreter so the script and its arguments stay visible.
            exe, _, rest = ps.partition(" ")
            ps = (Path(exe).name + " " + rest).strip()[:90]
        found.append(f"pid {pid} {ps}" if ps else f"pid {pid}")
    return found


def explain(stderr):
    """Print the allocator's diagnostic and who holds each occupied port."""
    sys.stderr.write(stderr if stderr.endswith("\n") else stderr + "\n")
    busy = BUSY.findall(stderr) if "assigned port occupied" in stderr else []
    for name, port in busy:
        held = listeners(port) or ["no listener found; retry, it may have just exited"]
        for line in held:
            sys.stderr.write(f"  {name}={port}  {line}\n")
    if busy:
        sys.stderr.write(
            "Stop this demo with `just down` (its URLs stay the same), or stop the "
            "other process above. Never reassign ports while the demo is running.\n"
        )


def main():
    mode, *command = sys.argv[1:]
    if mode not in ("start", "read") or not command:
        raise SystemExit("usage: port-run.py start|read COMMAND...")
    allocator = ROOT / "scripts/demo-ports.py"
    if not allocator.exists():
        allocator = ROOT.parent / "_demo-kit/demo-ports.py"
    args = ["uv", "run", "--no-project", str(allocator), "resolve", "--demo-dir", str(ROOT), "--format", "json"]
    if mode == "read":
        args.append("--allow-bound")
    try:
        output = subprocess.check_output(args, text=True, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as error:
        explain(error.stderr or f"ERROR: allocator exited {error.returncode}\n")
        raise SystemExit(1) from None
    assigned = json.loads(output)
    env = dict(os.environ, **{name: str(value) for name, value in assigned.items()})
    if "SPACE_FORCE_SINK_PORT" in assigned:
        for tier in ("raw", "aggregate", "priority", "tripwire", "quarantine", "partner", "detection", "parquet"):
            env["SPACE_FORCE_SINK_" + tier.upper()] = f"http://127.0.0.1:{assigned['SPACE_FORCE_SINK_PORT']}/ingest/{tier}"
    os.execvpe(command[0], command, env)


if __name__ == "__main__":
    main()
