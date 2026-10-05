# Recording script

## The claim

Train where the data lives: sites collect conversations, a local teacher grades
them, people approve the hard calls, and only an improved model ships back.

## Before the take

Read `RECORDING_PREFLIGHT.md`. Run its manual Cloud console checks. Use Opera
at http://localhost:8024, light view, 1440 pixels wide. Set the Expanso
Cloud console to light to match the board. The mobile board also
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

Confirm zero transcripts, both sites on base, no gate decision, and five jobs
Running. Keep the terminal outside the capture area.

## Beat 1: the boundary

Say: “These agent sites run inside the customer's infrastructure. Their text
conversations go to a training node in the same environment. Expanso Cloud
manages the work; the conversations stay here.”

Point at the dashed customer boundary with the two sites and the Expanso Edge
training node inside it, and Expanso Cloud outside it with only the control
lane crossing. The site lanes are already streaming terracotta: customers keep talking. The teacher
is `mistral-small:24b`; the student is a pinned 135M-parameter instruct model.
The exercise is text-only; no telephony or audio is captured.

## Beat 2: select the useful mistake

The background simulator sends actual model answers through Expanso.
Read the first refund request, original answer, teacher rationale, and proposed
correction. Keep the correction after checking it asks for the order number.
Discard the weather request: it is outside this refund and booking exercise.
The selection counts show repeats and already-correct answers staying out.

Say: “We learn from useful corrections, not every conversation. This mistake
needs a better answer. That weather request does not belong in this batch.”

## Beat 3: inspect and sign off once

Open **Inspect remaining corrections**. The panel lists each customer request,
original answer, teacher rationale, and editable target. Inspect the refund
and booking corrections, then approve the inspected batch once. This is an
explicit batch review, not an automatic approval of incoming conversations.
The simulator continues, but repeated requests do not add review work.

The scheduled trigger needs at least 8 approved corrections (a representative demo batch size). The real held-out
gate still controls release. Never claim that a candidate passed before its
results and both site receipts appear.

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
