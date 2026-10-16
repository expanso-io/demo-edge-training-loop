"""Sticky allocation and complete export without starting a Cloud runtime."""
import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("port_runner", ROOT / "scripts/port-run.py")
RUNNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNNER)


class Ports(unittest.TestCase):
    def test_down_up_preserves_every_service_and_presenter(self):
        scratch = ROOT / ".runtime"
        scratch.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as directory:
            env = dict(os.environ, DEMO_PORT_STATE=str(Path(directory) / "state.json"))
            command = ["uv", "run", "--no-project", str(ROOT / "scripts/demo-ports.py"), "resolve", "--demo-dir", str(ROOT), "--format", "json"]
            first = json.loads(subprocess.check_output(command, env=env, text=True))
            presenter = next(value for key, value in first.items() if key.endswith("DASHBOARD_PORT"))
            with socket.socket() as listener:
                listener.bind(("127.0.0.1", presenter))
                listener.listen()
                self.assertEqual(first, json.loads(subprocess.check_output(command + ["--allow-bound"], env=env, text=True)))
                with self.assertRaises(subprocess.CalledProcessError):
                    subprocess.check_output(command, env=env, text=True, stderr=subprocess.PIPE)
            self.assertEqual(first, json.loads(subprocess.check_output(command, env=env, text=True)))

    def test_every_arbitrary_service_is_exported_before_runtime_import(self):
        manifest = json.loads((ROOT / "ports.json").read_text())["ports"]
        arbitrary = {key: 33000 + index * 3 for index, key in enumerate(manifest)}
        with patch.object(sys, "argv", ["port-run.py", "read", "fixture"]), patch.object(RUNNER.subprocess, "check_output", return_value=json.dumps(arbitrary)), patch.object(RUNNER.os, "execvpe") as launch:
            RUNNER.main()
            argv, command, env = launch.call_args.args
            self.assertEqual(argv, "fixture")
            for key, value in arbitrary.items():
                self.assertEqual(env[key], str(value))
            if "SPACE_FORCE_SINK_PORT" in arbitrary:
                self.assertEqual(env["SPACE_FORCE_SINK_PRIORITY"], f"http://127.0.0.1:{arbitrary['SPACE_FORCE_SINK_PORT']}/ingest/priority")


    def test_host_bindings_and_site_jobs_change_without_container_addresses(self):
        from types import SimpleNamespace
        sys.path.insert(0, str(ROOT / "scripts"))
        import runtime
        from port_assignments import service_port
        manifest = json.loads((ROOT / "ports.json").read_text())["ports"]
        values = {name: str(33000 + index * 3) for index, name in enumerate(manifest)}
        with tempfile.TemporaryDirectory(dir=ROOT / ".runtime") as directory, patch.dict(os.environ, values), patch.object(runtime, "RUNTIME", Path(directory)), patch.object(runtime, "run", return_value=SimpleNamespace(stdout="")) as run, patch.object(runtime.subprocess, "run", return_value=SimpleNamespace(returncode=0)), patch.object(runtime, "start_edges"), patch.object(runtime, "spawn"), patch.object(runtime, "wait_http"):
            runtime.start_services(simulator=False)
            commands = [call.args[0] for call in run.call_args_list]
            publishes = [arg for command in commands for arg in command if isinstance(arg, str) and arg.startswith("127.0.0.1:")]
            self.assertIn(f"127.0.0.1:{service_port(8025)}:8025", publishes)
            self.assertIn(f"127.0.0.1:{service_port(8026)}:8025", publishes)
            self.assertIn(f"127.0.0.1:{service_port(8027)}:8025", publishes)
            self.assertIn(f"127.0.0.1:{service_port(18110)}:18110", publishes)
            for stem in ("collect-north", "collect-south", "rollout"):
                text = runtime.rendered_pipeline(ROOT / "pipelines" / (stem + ".yaml")).read_text()
                self.assertNotIn("127.0.0.1:8025", text)
                self.assertNotIn("127.0.0.1:18110", text)
            for stem in ("teacher", "training-trigger"):
                source = ROOT / "pipelines" / (stem + ".yaml")
                self.assertEqual(runtime.rendered_pipeline(source).read_text(), source.read_text())


if __name__ == "__main__":
    unittest.main()
