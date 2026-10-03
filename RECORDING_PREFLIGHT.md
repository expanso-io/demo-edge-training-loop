---
status: PASS_WITH_NAMED_WARNINGS
record_check: PASS
record_check_evidence: "2026-10-02: just record-check passed with live local services; repeated after final visual verification."
accepted_warnings: [manual-cloud-console-observability, training-node-resource-metrics]
---

# Recording preflight: learn inside the customer environment

## Claim

Sites collect text conversations, a local teacher grades them, people approve
uncertain corrections, and Expanso returns only a model that improves the
held-out score without regression.

## Audience and objection

Teams running a voice AI platform on their customers' own infrastructure. They
need to see that learning can happen inside that environment with a human
review step and a release gate. This take shows the text-model portion.

## Capture surface

http://localhost:8024 in Opera, dark view, 1440 pixels wide. The flow diagram is
the hero; keep the customer boundary, site versions and gate visible. Mobile
400-pixel screenshots are available, but the main take is landscape. The board
is never publicly hosted. Show the signed-in Cloud console separately if needed.

## Opening state

Run `just down`, `just reset`, `just up`, then `just deploy`. Reset preserves the
previous run under `.runtime/archive/`. Confirm zero transcripts, base at both
sites, an empty review queue and no gate verdict. The passing screenshots show
a completed measured run, not the opening state. Never open a take on them.

## Operator action

Run `just produce 1`, review the teacher correction on screen, and approve or
fix it. The scheduled trigger rejects the undersized batch. Then run
`just produce`, review the remaining corrections, and let the scheduled trigger
train the approved set. The board never controls Cloud job lifecycle.

## Visible outcome

The diagram counts follow received events. The first gate rejects too little
data; a later candidate shows current/candidate held-out scores. A passing
candidate changes North's model version before South's. Side-by-side evaluation
answers become prominent after shipment. Operator rollback changes both sites
back to base after local inference receipts; re-release follows the same canary
sequence. A failed candidate leaves the existing models in place.

## Truth boundary

Inference, teacher calls, training, transcripts and model bytes stay on this
Mac. Expanso Cloud owns job deployment and execution assignments and receives
operational metadata/logs/metrics. The external producer uses authored requests
and captures actual model answers. Eight fixed held-out lexical policy checks
are a narrow exercise, not a production safety or voice-quality benchmark.
Teacher confidence is self-reported. Rollback covers the first release to base.

## Proof evidence

`docs/evidence/first-pass.json` records the 159.2-second LoRA run, 17 approved
records, and 0/8 to 8/8 result. `docs/evidence/rollout-and-rollback.json` and
`docs/evidence/final-runtime.json` preserve actual rollout and inference
receipts. The hardened pipelines also processed a fresh transcript. The six
Cloud jobs were read back as Running, with only demo executions on its nodes.
Desktop/mobile screenshots are in `docs/screenshots/`. `just check` includes
central anti-slop lint, TypeScript checking, gate tests, Python compilation,
Expanso validation, pipeline lint, video-strict UI lint and the name check.

Before recording, use the signed-in Expanso work console for workspace API
endpoint `ektlu2wqvp82ym.us2.cloud.expanso.io`. In Jobs, visit the **Logs** and
**Monitoring** pages of these exact jobs while the producer runs:

- `train-loop-collect-north`
- `train-loop-collect-south`
- `train-loop-teacher`
- `train-loop-training-trigger`
- `train-loop-rollout-north`
- `train-loop-rollout-south`

Verify streaming log lines, moving real input/output traffic, and Running
without Degraded jobs. Use a full batch to exercise both collection jobs. These
are exact console navigation targets; no unverified deep-link URL is supplied.

## Decision

Ready with two named warnings accepted by Firstmate in inbox 003 and 006.
`manual-cloud-console-observability`: CLI Logs fails with `websocket: bad
handshake`; console Logs and Monitoring must be checked manually before a take.
`training-node-resource-metrics`: both nightly and stable v2.1.22 NACK
`transport.ResourceMetricsSample`. Pipeline telemetry reports connected, but
training-node resource charts may be unavailable. Do not narrate a resource
chart or Cloud traffic chart that has not been observed working. Exact errors,
image digests and repro steps are in `docs/EXPANSO_ISSUES.md`.

These warnings do not change the verified model-training, delivery, rollback
or re-release receipts. This declaration does not claim the manual console
check was performed and does not start any runtime or recorder.
