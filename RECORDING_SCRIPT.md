# Recording script

## The claim

Train where the data lives: sites collect conversations, a local teacher grades
them, people approve the hard calls, and only an improved model ships back.

## Before the take

Read `RECORDING_PREFLIGHT.md`. Run its manual Cloud console checks. Use Opera
at http://localhost:8024, light view, 1440 pixels wide. The mobile board also
works at 400 pixels, but record the full loop in landscape.

A full learning pass takes several minutes. Capture it honestly, then cut the
waiting time. Never replace measured progress with a sped-up counter.

For a clean opening, run these commands from the permanent demo folder:

```sh
just down
just reset
just up
just deploy
just record-check
```

Confirm zero transcripts, both sites on base, no gate decision, and six jobs
Running. Keep the terminal outside the capture area.

## Beat 1: the boundary

Say: “These agent sites run inside the customer's infrastructure. Their text
conversations go to a training node in the same environment. Expanso Cloud
manages the work; the conversations stay here.”

Point at the dashed customer boundary with the two sites and the Expanso Edge
training node inside it, and Expanso Cloud outside it with only the control
lane crossing. The site lanes are already streaming: customers keep talking. The teacher
is `mistral-small:24b`; the student is a pinned 135M-parameter instruct model.
The exercise is text-only; no telephony or audio is captured.

## Beat 2: collect, grade, review

```sh
just produce 1
```

The external producer asks the actual North model a refund question and sends
its answer through Expanso. Watch the burst on the north lane, then the transcript and teacher counts
change and the flow reach the REVIEW stage.
Read the teacher's confidence, rationale and correction. Fix the sentence if
needed, then click **Approve for training**.

Say: “The larger local model checks the answer and proposes a correction.
Uncertain cases pause for a person. A confidence score is a review signal,
not proof that the teacher is right.”

Within the next scheduled trigger, point at the rejected minimum-data round:
“One approved conversation is not enough. Nothing ships.”

## Beat 3: the approved batch

```sh
just produce
```

The already-graded first record is idempotent; the remaining requests run at
the two sites. The board queues corrections below 0.98 confidence, and targets
that fail the narrow policy check also require review. Review them carefully.
For refunds, request the order number before checking eligibility. For booking
changes, request the booking reference before checking availability. Never
approve a sentence claiming the action already happened.

The scheduled trigger starts once at least 12 approved records are available.
For a full 16-record training set, wait until all records arrive, then approve
the remaining queue promptly. The actual set and result are recorded; a pass is
never forced. If a candidate fails, show that rejection and retain the current
site model. Reset and review the corrections before attempting another take.

## Beat 4: training and the gate

Say: “This container fine-tunes the small model here. These are completed
training steps. Then we compare the candidate with the current model on eight
requests that were held out of training.”

Keep the TRAIN and GATE stages visible; the train lane pulses while steps run. Explain the actual score shown. The first
verified pass took 159.2 seconds and improved from 0/8 to 8/8; a fresh take may
differ. These eight lexical policy checks are deliberately narrow. Do not call
them a general safety or quality benchmark.

## Beat 5: release and the answer

On a passing gate, watch the teal burst leave the gate along the return lane
and North accept the adapter before South; the return lane stays teal once
both sites run it. Expanso carries
the adapter bytes. Each site verifies the checksum and runs a local inference
check before acknowledging activation. The before/after panel moves forward
when both site versions change.

Say: “The same held-out request now gets a better answer. North went first;
South followed after North's local check. A failed gate would leave both on
the current version.”

Read the actual answers rather than promising a particular sentence. The
side-by-side panel shows held-out evaluation outputs; the retained site receipt
also contains the actual post-install inference answer.

## Beat 6: rollback

```sh
just rollback
```

Watch both versions return to base, then:

```sh
just release-again
```

Watch the same accepted adapter return canary-first. Say: “The accepted version
is retained, and this first release can roll back to the original model.”

## End the session

```sh
just down
ollama stop mistral-small:24b
```

Close only this task's Opera session. Confirm the owned localhost listeners
and containers are gone. Do not stop the pre-existing Ollama server.
