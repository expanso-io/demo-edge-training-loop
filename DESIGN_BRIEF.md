# Local learning board

**Reference.** `demo-space-force-edge-routing` is the bar for *how a board
behaves*: the scenario is drawn, not labelled; every tier has a colour with one
meaning; outcomes are instruments (bars, cells, a ring); a click opens the
whole record. This board takes those behaviours and none of that board's
material. Its first dark version was Space Force with the labels swapped and
was sent back for exactly that.

**Palette: warm light, from the subject.** The subject is people talking to
assistants and a person reading the hard calls, so the material is a
transcript on a desk: linen ground, paper cards, ink. Machine facts (labels,
counts, versions, receipts) are mono; the words customers and assistants
actually said are set in a vendored serif (Source Serif 4), so a reader can
tell at a glance which text a person would read aloud and which a system
emitted. Token names keep the kit contract (`DESIGN_SYSTEM.md`). Accents are
rationed and each one means one thing: terracotta is a conversation and its
lanes, teal is approved or shipped, amber is a person needed, red is held at
the gate, Expanso violet is Expanso Cloud. Expanso Cloud console is set to
light to match. Iconography is the scenario's: a conversation line is a
customer bubble and an assistant bubble, the teacher is a rubric, the human
check is a headset, training is adapter layers, the gate is a gate.

**Layout: three columns, the loop drawn as a path.** Left, the two assistant
sites, each four conversation lines whose customer bubble lights as a message
lands and whose assistant bubble lights as it is answered, the running model
version as a pill, measured conversation count, refund and booking share, last
transcript.
Centre, Expanso Cloud outside the customer boundary, and inside it the Expanso
Edge training node as a four-stage machine: TEACHER, HUMAN CHECK, LoRA TRAIN,
GATE, each a row with a glyph, a name, one big number and one instrument (a
verdict split bar, approved chips, a progress bar, two rows of eight held-out
cells). Right, the release column: an improvement ring (candidate passed over
current, checks gained), the version ladder with SHIPPED and HELD tags, canary
state per site, and the same held-out request answered before and after. The
dashed customer boundary is computed from the cards it encloses.

**Flow, per the kit's flow grammar.** Customers write in at every line
continuously, and each line lights as a message lands. Transcripts leave the
lines, cross the card wall at the line's own height and braid into the edge
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
lines is representative, not a count; the measured count is beside it, and
each real receipt adds its own burst on its own site's lane. `docs/RESEARCH.md`
records this.

**Inspector.** Clicking a conversation row, a line, a site's last transcript
or a version opens the whole record in the middle of the viewport, read as a
transcript: customer, assistant, teacher verdict and rationale, the approved
correction, the record identity; a round opens its verdict, training set and
every held-out request with the current and candidate marks. Click or Esc
closes it and the feed resumes.

**Text budget.** Labels, numbers and one-line stage names. The narration
carries the rest. Below the stage: conversations received (hover reads a row
whole), the human call, and local receipts. The pipeline YAML is read on
camera in the Expanso Cloud editor rather than on the board; that deviation
from the grammar's YAML-panel furniture is recorded in `AGENTS.md`.
