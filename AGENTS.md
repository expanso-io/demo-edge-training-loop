# demo-edge-training-loop — agent rules

The rules in `../AGENTS.md` govern this directory; this file only adds to
them. Build order: claim → beat script → components on the showcase →
port the winners here → `just check`.

- The claim: **Train where the data lives: the sites collect, a local teacher grades, people approve the hard calls, and only a model that beats the last one ships back** — every element on screen serves it or gets cut.
- Palette: stamped **light** (declared as `color-scheme` in
  `dashboard/styles.css`). Neither dark nor light is the default — palette
  follows the subject and the host it lives in (`../AGENTS.md` → Theme). If
  this demo should be the other one, re-stamp with `--palette` rather than
  hand-flipping colours; the linter checks the ground agrees with the
  declaration.
- Design language: `../_demo-kit/DESIGN_SYSTEM.md`. Re-hue the tokens for this
  subject; keep the token names.
- Every quantitative claim cites `docs/RESEARCH.md` or is introduced as
  representative.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
