# Public example proof · 2026-10-05

Source commit tested: `b14ea9e1d42394a49156452dd9cc8e766949de19`.
The retained machine output is
[`docs/evidence/public-bar-2026-10-05.json`](evidence/public-bar-2026-10-05.json).

## Complete pipeline run

`just public-bar-proof` passed with Expanso Edge `v2.1.21`. The command deployed
the five current job files, left them stopped until the fixture services and
three Edge agents were ready, then reran them through Expanso Cloud. It sent
eight recorded inputs, four through each site collector. No model endpoint or
metered API was called.

The run proved these outcomes:

- `train-loop-collect-north` and `train-loop-collect-south` accepted all eight
  records through their real HTTP inputs.
- `train-loop-teacher` delivered eight recorded teacher results to the local
  review service; all eight policy-compliant corrections entered the batch.
- `train-loop-training-trigger` started the bounded recorded training fixture.
- The gate compared all eight held-out requests: current `0/8`, candidate
  `8/8`, status `passed`.
- `train-loop-rollout` installed the same checked `v1` adapter at North and
  South. Both local install receipts were `installed`.
- The event journal contains collect, teacher, review, training, gate and
  rollout receipts.

The JSON evidence records the exact SHA-256 digest of each pipeline file, the
running state of all five Cloud jobs during the run, the fixture run ID
`public-bar-20261006T025925Z`, scores, site versions and receipts.

## Platform boundary

Expanso Cloud owned job deployment, selection, restart and stop. The native
North and South Edge agents ran the site-selected jobs. The containerized
training Edge agent ran the training-selected jobs. Conversation bodies,
recorded teacher output, gate data, adapter bytes and site receipts remained in
the project-local services and volumes. Cloud received lifecycle metadata,
logs and metrics only.

## Explorer and usability

The presenter exposes collect, teacher, review, train, gate and rollout as six
pages of pretty-printed real input and output. Left and Right page the explorer
without moving its scroll anchor. Both copy controls report success next to the
clicked control and report a forced clipboard failure with a manual fallback.

An isolated browser session checked light and dark at 320, 400, 768 and 1440
CSS pixels. Every viewport had `scrollWidth == clientWidth`. A computed rendered
text audit found no contrast ratio below 4.5:1; the minimum was 4.56:1 in light
and 6.50:1 in dark. `just check` also passed the zero-state motion probe.

## Cleanup

The proof stopped all five Cloud jobs, both native Edge agents, the training
Edge container, three local service containers, the presenter and Docker
Desktop. Ports 8024-8027, 18101-18102, 18110 and 19011-19012 were clear after
the run. The isolated browser session and its temporary presenter on 8124 were
also stopped.

## Re-run on public-bar 1.1.3 · 2026-10-06

Source commit tested: `612f9270f153f2fb525167850aa7e3e3254930e1`, the checker vendored at `1.1.3`.
Machine output:
[`docs/evidence/public-bar-1.1.3-2026-10-06.json`](evidence/public-bar-1.1.3-2026-10-06.json).

- `.demo-kit/public-bar.py --selftest` passed: 2 good fixtures accepted, 5
  criterion-isolated failures each failed alone and were named.
- `--lane all` passed criteria 1 to 5 with Expanso Edge `v2.1.21`, Playwright
  `1.55.0` and axe-core `4.10.3`. No model call or metered key was used.
- Declared services were stopped afterwards (`--teardown-only` reported none
  running).

The earlier sections above were produced on `1.1.0`, before the checker had a
selftest.
