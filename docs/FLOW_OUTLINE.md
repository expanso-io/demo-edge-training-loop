# Train where the conversations happen

## The claim

Train where the data lives: the sites collect, a local teacher grades,
people approve the hard calls, and only a model that beats the last one
ships back.

The audience runs a voice AI platform on the customer's own infrastructure.
Their objection is practical: improving the model must not require exporting
customer conversations, bypassing reviewers, or replacing every site at once.
This demo trains on text transcripts, not audio.

## One visible loop

1. Two sites answer customer requests using the current small model. An
   external producer supplies the requests; each site emits the actual prompt
   and model answer as a transcript to its Expanso input.
2. Expanso transports those transcripts to a training node inside the drawn
   customer boundary. The board counts receipt separately from emission.
3. A larger local teacher grades each complete conversation against the
   policy, writes a corrected target and evaluation rationale, and returns a
   confidence score. Low confidence creates a pending review, never an
   automatic approval.
4. The presenter reads a transcript, fixes the target if necessary, and
   approves it. The record retains the teacher's proposal and human decision.
5. A batch-size or timer trigger asks the training service for a LoRA run.
   Only approved training records enter the run. Held-out prompts and targets
   are fixed before training and never enter its dataset.
6. The first undersized round is rejected by the minimum-data gate. A later
   candidate runs on exactly the same held-out prompts as the current model.
   Strict improvement and no critical-policy regression are required. A tie,
   malformed output, missing evidence, or failed run leaves all sites alone.
7. Expanso delivers the accepted version to one canary site. Its receipt and
   successful inference unlock the other site. The board shows the old and
   new answers beside each other. Previous adapters remain available for a
   verified rollback.

## Recording beats

| Beat | Visible proof | Narration purpose |
| --- | --- | --- |
| Collect | Site answer, transcript receipt, current version | These are the conversations we can learn from. |
| Grade | Teacher verdict, correction, confidence | The larger model prepares the learning material here. |
| Review | Pending item becomes approved after a click | People resolve the uncertain cases. |
| Reject | Too little approved data; sites unchanged | A training trigger is not permission to ship. |
| Train and compare | Actual progress, held-out results | The candidate must beat the version already running. |
| Deliver | Canary receipt, then second receipt | Release in stages and retain a rollback. |

The early look proves local teacher inference and the review interaction.
It must say which execution mode is active. Cloud acceptance, fine-tuning,
measured improvement, and rollout remain separate evidence requirements.
A live training run may take longer than a short recording. Use a narrated
cut between named states rather than inventing elapsed time or progress.

## Implementation boundaries

- Presenter: localhost port 8024. Read-only operational state plus human
  approval and target correction. No Cloud job lifecycle controls.
- Orchestration: Expanso Cloud, project-specific selectors, project-local
  credentials and node identities. No global CLI profile modifications.
- Data plane: local site inputs, teacher, trainer, adapter store and inference
  services. Do not put transcript text or model targets in Cloud logs.
- Training: a container on this Mac. Benchmark a small instruct model with
  CPU LoRA first; Apple Metal acceleration is not assumed inside Linux.
  The exact model and feasible run length depend on measured performance.
- Teacher: installed mistral-small:24b through the local Ollama endpoint.
- Sources: authored conversation prompts emitted by an external producer;
  model answers and teacher judgments come from actual inference.
- Control-plane fallback: only if unrelated shared-workspace jobs land on
  these nodes. Report the collision and label local control-plane mode.
- No claim that a held-out set establishes production safety. Display its
  observed counts and preserve the underlying answers for inspection.

## Completion evidence

The finished run must retain a rejected round, approved training records,
adapter hash, fixed held-out manifest, baseline and candidate outputs, gate
result, staged receipts, and rollback receipt. Cloud must show meaningful
logs, real input/output rates, and Running jobs after startup settles.

Check the rendered board at 320, 400, 768 and 1440 pixels, including loading,
error, review, rejected and accepted states. Save early and final screenshots
at 1440 and 400. Run the pipeline linter, video-strict UI linter and
`just check` at checkpoints. Finish the recording script only with verified
commands and preserve any remaining recording blocker explicitly.
