# Verified delivery · 2026-10-02

Built in the permanent demo folder on main. First checkpoint: `5b92c14`.
The disposable worktree is unused. There is no remote and nothing was pushed.

## Proven loop

- Six Cloud-managed jobs use project selectors across North, South and the
  container training node. Only demo executions were seen on those nodes.
- Real small-model answers travelled through Expanso to the local
  `mistral-small:24b` teacher. Low-confidence corrections paused for approval.
- The first undersized batch was honestly rejected. The first full run trained
  the pinned 135M student on 17 approved records in 159.2 seconds. Its fixed
  eight-request lexical rubric improved from 0/8 to 8/8 without regression.
- Expanso transported the actual adapter. North acknowledged local inference
  before South. Both rolled back to base, then accepted the adapter again.
- Hardened outputs reject processing errors and use five-second retries. A
  fresh transcript and another rollback/re-release passed through those jobs.
- The final reset/start/deploy workflow was exercised: zero records/rounds,
  both sites base, then a real 90%-confidence teacher item, on-screen approval,
  and a fresh minimum-data rejection. Previous run state remains archived.

## Verification

`just record-check` and `just recording-preflight` passed. The former includes
central anti-slop lint, TypeScript checking, five gate tests, Python compilation,
Expanso YAML validation, pipeline lint, video-strict UI lint and name checks.
The unchanged machine commit hook passed the first checkpoint; no plugin copy
is vendored. Reset, startup, deployment, rollback, re-release and shutdown were
exercised via the operator commands.

The final board has no horizontal overflow at 320/400/768/1440. Font loading,
remembered dark view and reduced motion were verified with isolated Opera via
agent-browser. Desktop and mobile renders were inspected against the design
checklist. Motion follows measured events; loading has a skeleton; this local
presenter needs no invented public legal pages. The diagram's event particles
are the explicitly requested motion, not decorative animated arrows.

Screenshots: `final-1440.png` and `final-400.png` show the passing retained run;
`zero-1440.png`, `review-1440.png`, `review-400.png` and `rejected-1440.png` show
the fresh opening sequence. All are under `docs/screenshots/`. The JSON evidence
under `docs/evidence/` preserves both sequences and actual answers.

## Accepted limitations

The eight checks are a narrow policy exercise, not production safety or general
quality measurement. Teacher confidence is self-reported. Rollback restores the
base model for this first-release demonstration.

Cloud console Logs/Monitoring remain a manual pre-take check. CLI Logs reports
`websocket: bad handshake`; both tested training Edge versions NACK resource
metrics. Firstmate accepted these warnings in inbox 003 and 006. The exact
errors, versions, repro steps and console navigation are in
`EXPANSO_ISSUES.md`; the recording declaration is `../RECORDING_PREFLIGHT.md`.
No Cloud chart or signed-in console log stream is claimed as verified.

## Cleanup and next take

All six Cloud jobs, four containers, two native Edge agents and the board are
stopped at handoff. The owned Opera session is closed, the teacher unloaded,
and Docker Desktop stopped. The pre-existing Ollama server remains untouched.
Local credentials, node identities, cached weights and archived runs remain
owner-only and gitignored.

Use `../README.md` for commands and `../RECORDING_SCRIPT.md` for the take. Start
with reset after down to preserve the review exercise and open on a true zero.
