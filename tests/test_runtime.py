"""Shutdown confirmation before reset; no processes or Cloud calls started."""
import signal
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


if __name__ == '__main__':
    unittest.main()
