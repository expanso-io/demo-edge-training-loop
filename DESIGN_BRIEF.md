# Local learning board

**Reference.** `demo-space-force-edge-routing` is the bar: the scenario is
drawn, not labelled; every tier has a colour with one meaning; outcomes are
instruments (bars, cells, a ring), not sentences. This board is built to that
bar and is reviewed against it.

**Palette: dark, deliberately.** The board is a standalone contact-centre ops
instrument, not an embedded light host, so it takes the deep ground. Token
names keep the kit contract (`DESIGN_SYSTEM.md`). Accents are rationed and each
one means one thing: accent blue is conversations and data lanes, ok teal is
approved or shipped, warn amber is a person needed, err red is held at the
gate, ctl periwinkle is Expanso Cloud. Mono is the only voice. Expanso Cloud
console is set to dark to match.

**Layout: three columns, the loop drawn as a path.** Left, the two agent sites
drawn as support floors: four agent seats each, the running model version as a
pill, measured conversation count, refund and booking share, last transcript.
Centre, Expanso Cloud outside the customer boundary, and inside it the Expanso
Edge training node as a four-stage machine: TEACHER, HUMAN CHECK, LoRA TRAIN,
GATE, each a row with a glyph, a name, one big number and one instrument (a
verdict split bar, approved chips, a progress bar, two rows of eight held-out
cells). Right, the release column: an improvement ring (candidate passed over
current, checks gained), the version ladder with SHIPPED and HELD tags, canary
state per site, and the same held-out request answered before and after. The
dashed customer boundary is computed from the cards it encloses.

**Flow, per the kit's flow grammar.** Customers write in at every seat
continuously, and each seat lights as a message lands. Transcripts leave the
seats, cross the card wall at the seat's own height and braid into the edge
node beside the teacher; while the node is unreachable they dissipate at its
wall and the node grays out and says why. Inside the node a spine carries
graded conversations to the person, approved ones to training while a batch is
waiting, and steps to the gate while a run is live. A pass bursts teal into the
release column and down the return lanes to each floor as it activates, north
first; a rejection dies at the gate in red. The control lane carries a
heartbeat both ways while Cloud reports jobs running. Reduced motion damps
everything to 0.35x and never stops it. `just motion-check` proves the board
moves at zero state.

**Honesty line.** Every number is measured. The ambient customer traffic at the
seats is representative, not a count; the measured count is beside it, and
each real receipt adds its own burst on its own site's lane. `docs/RESEARCH.md`
records this.

**Text budget.** Labels, numbers and one-line stage names. The narration
carries the rest. Below the stage: conversations received (hover reads a row
whole), the human call, and local receipts. The pipeline YAML is read on
camera in the Expanso Cloud editor rather than on the board; that deviation
from the grammar's YAML-panel furniture is recorded in `AGENTS.md`.
