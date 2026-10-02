# Expanso issues observed on 2026-10-02

These observations are saved for the Expanso team. Nothing was filed remotely.
Firstmate accepted manual signed-in Cloud console verification before recording
(inbox 003 and 006). They do not block this local demo's data-plane proof.

## Training-node resource metrics rejected

Exact error from the training Edge sidecar:

```text
failed to deserialize message payload:
failed to deserialize message payload:
unsupported message type: transport.ResourceMetricsSample
```

The surrounding log says `async publish to orchestrator was NACKed`, with
`message_type=transport.ResourceMetricsSample`. The original error is one line;
it is wrapped above for readability without changing its words.

Observed on both images:

- `v2.1.22-nightly.143.gd7ee6fc3`, digest
  `sha256:2d9af7ff97dc2f7f1515f621ba6fd60da37b8cee11d8165e0fea1af9410a38b7`
- Stable `v2.1.22`, digest
  `sha256:bf767228d1a104a450550580118a6d4225352187fd75cc86a7d43760804c5ad1`

The current runtime pins the stable digest. The native Mac site agents are
v2.1.21. The training node has `telemetry.do_not_track: false`, runs beside the
training service with a shared Docker network namespace, and uses its existing
project-local identity and bootstrap configuration.

Reproduce from the permanent demo folder with the owner-only project `.env`:

```sh
just up
just deploy
docker logs --since 2m train-loop-edge-training
```

Wait for a resource-metric interval. The message recurs roughly every 30 seconds.
Do not print the project credentials. End the check with `just down`.

Observed separately: the OTLP telemetry collector and pipeline feed report
connected; six demo jobs were Running; the teacher, adapter delivery, rollback
and re-release produced real local receipts. Resource-metric rejection does not
establish whether the Cloud pipeline traffic charts work. Those need the manual
console check below. No further image troubleshooting was attempted.

## CLI job log stream fails

The installed CLI command:

```sh
uv run -s scripts/cloud.py job logs train-loop-rollout-north
```

returned `websocket: bad handshake`. A request to the locally documented POST
`/api/v1/jobs/train-loop-rollout-north/logs` returned HTTP 404. These are the two
attempts already recorded in `BUILD_STATUS.md`; no further endpoint probing is
part of this task.

## Manual console verification

Use the existing signed-in Expanso work console and select the workspace whose
API endpoint is `ektlu2wqvp82ym.us2.cloud.expanso.io`. That hostname is the API
endpoint, not a guessed console page URL.

In **Jobs**, open each exact job below. Confirm **Running**, then inspect its
**Logs** and **Monitoring** pages while `just produce 1` runs:

- `train-loop-collect-north`
- `train-loop-collect-south`
- `train-loop-teacher`
- `train-loop-training-trigger`
- `train-loop-rollout-north`
- `train-loop-rollout-south`

For both sites' collection charts, use the full `just produce` batch. Confirm
log lines stream and actual input/output traffic moves; no job may be Degraded.
Record the console observation before a take. Node resource charts may be absent
because of the separate NACK above. This worker did not verify those console
pages and does not claim their charts or logs passed.
