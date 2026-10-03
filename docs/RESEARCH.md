# Evidence and measurement scope

All results below were measured locally on 2026-10-02. They describe this fixed
text-policy exercise, not production or voice-pipeline performance.

| Claim | Evidence |
|---|---|
| 17 approved training records; 159.2 seconds | `evidence/first-pass.json`, passing round |
| Base 0/8; candidate 8/8 | Same file, full baseline/candidate answers |
| Honest rejected first batch | Same file, `data-gate` round |
| Actual adapter checksum and held-out manifest | Same file, `sha256` and `held_out_sha256` |
| North then South activation; rollback and re-release | `evidence/rollout-and-rollback.json` |
| Fresh reset, on-screen approval and minimum-data rejection | `evidence/reset-and-review.json` |
| Model identity and pinned revision | `../scripts/learning.py` |
| Exactly which prompts and checks | `../scripts/corpus.py` |
| Training admission and no-regression gate | `../scripts/gate.py`, `../tests/test_gate.py` |

The teacher's confidence is its own estimate. Review admission uses 0.98 and
also checks the proposed target against the lexical policy rubric. These values
are demo configuration, not externally established thresholds.

The 135M student is HuggingFaceTB/SmolLM2-135M-Instruct, revision
`12fd25f77366fa6b3b4b768ec3050bf629380bac`. Its model repository is
https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct .
The teacher is the installed Ollama `mistral-small:24b`.

Pipeline components were checked against the local official Expanso docs
snapshot at `~/.expanso-docs/llm.txt`: `http_server`, `http_client`, `http`,
`generate` (timer only), `log`, local rate limits and `reject_errored`.
Every YAML is also validated with the installed Expanso Edge binary.

## What the board animates

Every number rendered is measured from local receipts. The continuous
conversation particles leaving each agent site are representative of live
customer traffic at the sites and are not a count of anything; the measured
count is the transcripts figure beside them, and each real receipt adds its
own burst on its own site's lane. Stage, control, and return lanes move only
when the measured state says there is something to move (graded records, an
approved batch, a live training run, running Cloud jobs, a passed release).
