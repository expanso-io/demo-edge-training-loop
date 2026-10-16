set shell := ["bash", "-euo", "pipefail", "-c"]

kit := env_var_or_default("DEMO_KIT", "../_demo-kit")

_default:
    @just --list

# Explicit operator commands; none are exposed by the board.
up:
    uv run --no-project scripts/port-run.py start uv run -s scripts/runtime.py up

deploy:
    uv run --no-project scripts/port-run.py read uv run -s scripts/runtime.py deploy

down:
    uv run --no-project scripts/port-run.py read uv run -s scripts/runtime.py down

reset:
    uv run --no-project scripts/port-run.py read uv run -s scripts/runtime.py reset

rollback:
    uv run --no-project scripts/port-run.py read uv run -s scripts/runtime.py rollback

release-again:
    uv run --no-project scripts/port-run.py read uv run -s scripts/runtime.py release-again

# Shared Expanso Cloud workspace. Separate workspaces require explicit flags
# on expanso-demo-init.py so the override cannot be mistaken for the default.
workspace-init:
    @uv run -s {{kit}}/expanso-demo-init.py .

workspace-check:
    @uv run -s {{kit}}/expanso-demo-init.py . --check

test:
    uv run --no-project tests/test_ports.py
    uv run -s {{kit}}/test-startup.py
    npm run lint
    npm run typecheck
    uv run --no-project -s tests/test_gate.py
    uv run --no-project -s tests/test_selection.py
    uv run --no-project -s tests/test_producer.py
    uv run --no-project -s tests/test_runtime.py
    uv run --no-project python -m py_compile scripts/*.py
    uv run -s scripts/dashboard.py --check

video-check:
    @uv run -s {{kit}}/lint-demo-ui.py . --video-strict

# the board must MOVE at zero state (rule 1 + flow grammar): two real screenshots, pixel diff
motion-check:
    @uv run -s {{kit}}/probe-motion.py .

# Expanso pipelines: syntax, then the all-demos rules (logs, a real output,
# short lines, no blank lines in config, generate only for timers).
validate:
    @command -v expanso-edge > /dev/null
    expanso-edge validate pipelines/*.yaml

pipeline-check:
    @uv run -s {{kit}}/lint-demo-pipelines.py .

# Drive the pipeline's input from outside: the demo's data source.
produce count="16":
    uv run --no-project scripts/port-run.py read uv run -s scripts/producer.py --count {{count}}

# Recorded answers only: exercises all five Cloud jobs without a model call.
public-bar-proof:
    uv run --no-project scripts/port-run.py read uv run -s scripts/public_bar_fixture.py

check: test validate pipeline-check video-check motion-check clean-check

# everything that must be true before a take: gates + live endpoint + checklist
record-check: check
    uv run --no-project scripts/port-run.py read bash -c 'curl -fsS "http://localhost:${TRAIN_LOOP_DASHBOARD_PORT}/api/state"' > /dev/null || { echo "FAIL: dashboard not reachable — just up first"; exit 1; }
    @echo ""
    @echo "RECORD CHECKLIST"
    @echo "  [ ] demo-guidance/RECORDING.md read; console set to light (matches this board); resolution dropped"
    @echo "  [ ] Opera, no browser chrome in frame"
    @echo "  [ ] true zero state confirmed (no finished session on screen)"
    @echo "  [ ] manual Cloud Logs and Monitoring checks completed"
    @echo "  [ ] RECORDING_PREFLIGHT.md warnings reviewed"

# human story/proof declaration; validates only and never starts anything
recording-preflight:
    @uv run -s {{kit}}/recording-preflight.py .

# prohibited names never reach a take (add customer/competitor names here)
clean-check:
    @if rg -il '[b]acalhau' --glob '!justfile' . ; then echo "FAIL: prohibited name in tree"; exit 1; fi
    @echo "clean"

ports:
    uv run --no-project scripts/demo-ports.py resolve --demo-dir . --format json --allow-bound
