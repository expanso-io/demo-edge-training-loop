"""Shutdown confirmation before reset; no processes or Cloud calls started."""
import signal
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
import runtime

SCRATCH = Path('/Users/daaronch/code/second-brain/.codex-work/2026-10-04/startup-tests')
SCRATCH.mkdir(parents=True, exist_ok=True)


class ShutdownTests(unittest.TestCase):
    def test_zombie_pid_is_finished_not_an_identity_mismatch(self):
        with tempfile.TemporaryDirectory(dir=SCRATCH) as directory:
            pidfile = Path(directory) / 'edge.pid'
            pidfile.write_text('1234')
            result = type('Result', (), {
                'returncode': 0,
                'stdout': 'Z    expanso-edge <defunct>\n',
            })()
            with patch.object(runtime.subprocess, 'run', return_value=result):
                self.assertFalse(runtime.alive(pidfile))
            self.assertFalse(pidfile.exists())

    def test_pid_is_retained_until_process_exits(self):
        with tempfile.TemporaryDirectory(dir=SCRATCH) as directory:
            root = Path(directory)
            pidfile = root / 'simulator.pid'
            pidfile.write_text('1234')
            with patch.object(runtime, 'RUNTIME', root), \
                 patch.object(runtime, 'alive', side_effect=[True, True, False]), \
                 patch.object(runtime.os, 'killpg') as terminate, \
                 patch.object(runtime.time, 'sleep') as wait:
                runtime.stop_processes()
            terminate.assert_called_once_with(1234, signal.SIGTERM)
            wait.assert_called_once_with(0.1)
            self.assertFalse(pidfile.exists())

    def test_shutdown_timeout_preserves_pid_and_fails_before_reset(self):
        with tempfile.TemporaryDirectory(dir=SCRATCH) as directory:
            root = Path(directory)
            pidfile = root / 'simulator.pid'
            pidfile.write_text('1234')
            with patch.object(runtime, 'RUNTIME', root), \
                 patch.object(runtime, 'alive', return_value=True), \
                 patch.object(runtime.os, 'killpg'), \
                 patch.object(runtime.time, 'monotonic', side_effect=[0, 20]):
                with self.assertRaisesRegex(RuntimeError, 'not been reset'):
                    runtime.stop_processes()
            self.assertEqual(pidfile.read_text(), '1234')

    def test_deployment_stops_every_job_and_never_reruns(self):
        with tempfile.TemporaryDirectory(dir=SCRATCH) as directory:
            root = Path(directory)
            (root / 'pipelines').mkdir()
            for name in runtime.JOBS:
                (root / 'pipelines' / (name.removeprefix('train-loop-') + '.yaml')).write_text('fixture')
            jobs = [{'spec': {'name': name}, 'status': {'state': {'state_type': 'Stopped'}}}
                    for name in runtime.JOBS]
            def cloud(*args):
                if args[:2] == ('node', 'list'):
                    return '[]'
                if args[:2] == ('job', 'list'):
                    return json.dumps(jobs)
                self.assertEqual(args[:2], ('job', 'stop'))
                return 'stopped'
            with patch.object(runtime, 'ROOT', root), \
                 patch.object(runtime, 'environment', return_value={}), \
                 patch.object(runtime, 'cloud', side_effect=cloud) as calls, \
                 patch.object(runtime.subprocess, 'run') as submit:
                submit.return_value.returncode = 0
                submit.return_value.stdout = 'deployed'
                runtime.deploy()
            self.assertEqual(submit.call_count, len(runtime.JOBS))
            stopped = {call.args[2] for call in calls.call_args_list if call.args[:2] == ('job', 'stop')}
            self.assertEqual(stopped, set(runtime.JOBS))

    def test_deployment_refuses_online_demo_nodes(self):
        nodes = [{'id': 'other-demo-node', 'status': {'connection_state': 'connected'}}]
        with patch.object(runtime, 'cloud', return_value=json.dumps(nodes)), \
             patch.object(runtime.time, 'monotonic', side_effect=[0, 100]), \
             patch.object(runtime.subprocess, 'run') as submit:
            with self.assertRaisesRegex(RuntimeError, 'requires demo nodes offline'):
                runtime.deploy()
        submit.assert_not_called()


if __name__ == '__main__':
    unittest.main()
