# Local learning board

**Palette: light, deliberately.** Transcript review reads as paper, and the
Expanso Cloud console is set to light to match the board (never the reverse).
Tokens keep the kit names (`DESIGN_SYSTEM.md`); accents are rationed and each
one means one thing: accent blue is conversations and Expanso control, ok teal
is accepted or shipped, warn amber is a person needed, err red is rejected at
the gate. Mono is the house voice; the vendored Barlow Condensed carries labels
and the quoted conversation text.

**Layout: topology board, archetype A, drawn as a loop with a boundary.** The
claim is "train where the conversations happen", so the board draws the
customer environment as a dashed boundary with both agent sites and the
Expanso Edge training node inside it, and Expanso Cloud outside it with only a
two-way control lane crossing the line. The four stages (teacher, review,
train, gate) sit inside the edge node; a return lane runs from the gate back
under the loop to the sites, north first.

**Flow, per the kit's flow grammar.** Every particle is born at its own site
chip, light inside the sites card and full strength once it exits. The sites
emit continuously: customers keep talking whether or not anything is training,
so the lanes are alive before the first transcript and while the node is
unreachable, where particles dissipate at the edge wall and the edge node grays
out and says why. Stage lanes carry what the counts say is there: graded
records to review, approved records to training while a batch is waiting,
training steps to the gate while a run is live. A pass sends a teal burst
along the return lane; a rejection dies at the gate in red. The control lane
carries a heartbeat both ways while Cloud reports jobs running. Reduced motion
damps everything to 0.35x and never stops it. `just motion-check` proves the
board moves at zero state.

**Honesty line.** Every number on the board is measured. The ambient
conversation emission from the sites is representative of live traffic, not a
count; the measured count is the transcripts figure beside it, and every real
receipt adds its own burst on its own site's lane. `docs/RESEARCH.md` records
this.

**Text budget.** Labels and numbers only. The claim is the masthead line; the
narration carries the rest. Below the loop: the live shelf (hover pauses it and
shows the whole row), the human call (the uncertain decision), and the same
held-out request before and after (the release decision). The pipeline YAML
is shown in the Expanso Cloud editor on camera rather than on the board; that
deviation from the grammar's YAML-panel furniture is recorded in `AGENTS.md`.
