# Build checkpoint · 2026-10-02

This checkpoint was prepared on `main` in the permanent demo folder. The disposable
worktree and its branch are unused. This is not recording-ready yet.

## Verified

- The installed local teacher graded actual small-model answers.
- Six Cloud jobs ran with project-specific selectors. No unrelated executions
  appeared on the three new node identities when checked before deployment.
- The North and South inference services and CPU LoRA trainer ran in Docker.
  The training Edge agent ran in a sidecar sharing the training container's
  network namespace. Site Edge agents ran on the Mac.
- The first approved record was rejected by the minimum-data gate.
- Seventeen approved records trained the pinned 135M instruct model with LoRA.
  The run took 159.2 seconds. The fixed eight-request lexical policy check
  improved from zero passes to eight. This narrow rubric is not a production
  safety assessment. One teacher target needed reviewer correction.
- Cloud pipelines transported the actual adapter bytes. North acknowledged
  activation before South. Both acknowledged rollback to base, then accepted
  the passing adapter again.
- `docs/evidence/first-pass.json` and `rollout-and-rollback.json` retain the
  evidence. Screenshots in `docs/screenshots/` show the early review and the
  revised loop. The last 1440 and 400 captures are `checkpoint-*.png`.
- Before the final diagram refinement, overflow checks passed at 320, 400,
  768 and 1440. Repeat those checks against the final layout.
- At this checkpoint: anti-slop lint, JS typecheck, five gate tests, Python
  compilation, pipeline validation, pipeline lint, video-strict UI lint, and
  the existing `just check` all passed.

## Observability limitation resolved by firstmate

Cloud log verification failed twice. Installed `expanso-cli job logs`
returned `websocket: bad handshake`. A request to the documented POST
`/api/v1/jobs/train-loop-rollout-north/logs` returned HTTP 404. The latter
route is from the local Expanso documentation snapshot. The worker contract
requires stopping after two attempts at an obstacle.

Firstmate accepted a signed-in console verification as a manual recording
preflight on 2026-10-02 (inbox 003). This no longer blocks implementation. Running jobs and local receipts do not prove Cloud charts or logs.
No authenticated Cloud browser session was used.

## Remaining implementation and verification

- Complete the runtime command surface. `runtime.py edges` and `stop` exist;
  the scaffold `just up` still starts only the board. Do not present it as the
  complete demo start command. Docker service launch commands were run by the
  worker and still need a reusable start recipe with readiness checks.
- Wire the added lint/typecheck/gate tests into `just check`; they currently
  ran as separate commands. Complete README, RECORDING_SCRIPT and preflight.
- Node config now enables telemetry. The verified first pass used
  `do_not_track: true`; the change to false needs a live restart and Cloud
  monitoring verification. Do not claim traffic charts were verified.
- Add fail-closed `reject_errored` outputs and conditional success/error logs
  around HTTP processors. The components were read in the official local
  documentation but this hardening has not yet been implemented.
- Make the board's Cloud status fresh. Its current mode string was set after
  reading Running jobs and is persisted, not a live status poll.
- Verify the final loop layout, all state transitions, theme persistence,
  reduced motion, unavailable-service behavior and model-call rate caps.
  Approval calls no model; its button is single-flight. Backend model routes
  now have nonblocking admission limits, but need explicit concurrency tests.
- Rollback currently restores the base model, appropriate to the first
  release shown here. General previous-version rollback is not implemented.
- Add restart recovery for interrupted training and a durable release-attempt
  audit. Harden retry/idempotency checks before calling the demo ready.
- Model dependencies and the model revision are pinned. The Edge sidecar is
  still the existing `nightly` image; pin its inspected digest before delivery.
- Review the final diff, rerun complete gates, and commit on permanent main.
  There is no remote and no push is authorized for this task.

## Cleanup

All six demo Cloud jobs were stopped. The four task containers were stopped
and removed. The two native Edge processes and localhost board were stopped.
The task's Opera session was closed, the teacher model unloaded, and Docker
Desktop stopped. Persisted adapters, data, node identities and owner-only
project credentials remain gitignored in the permanent project.
