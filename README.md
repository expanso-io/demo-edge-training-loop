# Training loop in your environment

**Train where the data lives: the sites collect, a local teacher grades, people approve the hard calls, and only a model that beats the last one ships back**

Scaffolded by `_demo-kit/new-demo.py` on 2026-10-02. Before building anything,
pick the use-case archetype in `../_demo-kit/PATTERNS.md` and read
`../_demo-kit/DESIGN_SYSTEM.md` — new components are built on the showcase
first, never here.

```bash
just up        # dashboard on :8024
just check     # tests + video-strict lint
just record-check   # everything that must be true before a take
```

Cloud workspace: `just workspace-init` installs the shared `expanso-demos`
profile and enrolls this demo's project-local edge identity. Use
`just workspace-check` for a read-only verification.
