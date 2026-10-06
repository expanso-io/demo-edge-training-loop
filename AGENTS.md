# demo-edge-training-loop — agent rules

The rules in `../AGENTS.md` govern this directory; this file only adds to
them. Build order: claim → beat script → components on the showcase →
port the winners here → `just check`.

- The claim: **Train where the data lives: the sites collect, a local teacher grades, people approve the hard calls, and only a model that beats the last one ships back** — every element on screen serves it or gets cut.
- Palette: **light by default**, warm, with an explicit dark toggle (declared as
  `color-scheme` in `dashboard/styles.css`);
  chosen on 2026-10-03 from the subject: conversations read by a person are a
  transcript on a desk, so the ground is linen and the spoken words are a
  vendored serif. The previous dark board was Space Force with the labels
  swapped and was rejected for it. Take a reference board's *behaviour* (drawn
  scenario, one colour per meaning, instruments, click-to-inspect), never its
  palette or glyphs (`../AGENTS.md` → Theme). If this demo should be the other
  one, re-stamp with `--palette` rather than hand-flipping colours; the linter
  checks the ground agrees with the declaration.
- Design language: `../_demo-kit/DESIGN_SYSTEM.md`. Re-hue the tokens for this
  subject; keep the token names.
- Every quantitative claim cites `docs/RESEARCH.md` or is introduced as
  representative.

- Runtime commands, local-only boundaries and cleanup: `README.md` and
  `scripts/runtime.py`. Cloud lifecycle is never exposed by the presenter.
- Measurement scope and immutable first-run evidence: `docs/RESEARCH.md`.
- Accepted recording warnings and manual console checks:
  `RECORDING_PREFLIGHT.md` and `docs/EXPANSO_ISSUES.md`.

## Board contract

- `just motion-check` must pass before any screenshot review or take. The
  flow grammar in `../_demo-kit/DESIGN_SYSTEM.md` is the spec for the loop;
  the sites emit continuously and lanes connect box walls.
- Deviation from the grammar, with reason: no YAML panel under the edge node.
  The pipeline YAML is read on camera in the Expanso Cloud editor (beat 1),
  and the space goes to the human review card, which is the claim's hard call.
- Ambient site emission is representative; counts are measured. Say so if
  asked, and never scale the ambient rate to look like a number.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
