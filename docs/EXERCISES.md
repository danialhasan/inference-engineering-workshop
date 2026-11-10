# Predict, edit, run, explain

Use `python3` on macOS/Linux and `py -3` on Windows. Commands below default to
recorded data. Add `--source live` to measure your local model, and append `--port`
if your service uses a port other than 11434. Each run writes a unique JSON file.

## Exercise 0 — Make your first request (8 minutes)

Run `python3 workshop.py doctor`, then `python3 workshop.py run 0 --repeat 1`.
If live setup passed, also run `python3 workshop.py run 0 --source live --repeat 1`.
Open the saved JSON. Find `source`, `prompt`, `config`, `requests[0].text`,
`first_text_ms`, `wall_ms`, `output_tokens`, `done_reason`, and `chunks`.

Read `generate()` in `workshop/runtime.py`. Follow the payload to `/api/generate`,
the streamed JSON lines, and the final completion event. In live mode the terminal
prints text as it arrives; recorded mode displays an already captured response.
The final event supplies token counts and server timings; a text chunk is not
necessarily one token. The helper rejects missing completion events and never
saves a failed group as a successful measurement.

**Checkpoint:** explain which machine produced the result, where the request is
sent, and why first visible text arrives before request completion. Write one
prediction in WORKSHEET.md. If you cannot install Ollama, continue with saved data.

## Exercise 1 — Instrument first visible text (10 minutes)

Run `python3 workshop.py run 1 --repeat 1`. It displays an unfinished first-text
measurement. Open `exercises/ex01_stream.py` and implement `measure(request)`:

1. Find the first chunk with nonempty `text` and return its `ms` value.
2. Return `None` if there is no visible text; preserve a valid value of zero.
3. Keep the wall time and token count as supplied.

Run `python3 workshop.py check 1`, then repeat `python3 workshop.py run 1`.
Inspect `participant_metrics` alongside the raw request to confirm your result.

**Checkpoint:** explain why an empty event, a thinking-only event, or the final
completion event is not the first visible response. This client measurement is
an approximation of time to first token, not a direct measurement of GPU prefill.

**Hint:** filter chunks by their text, not by whether the timestamp is truthy.
To compare without overwriting your edit, use
`python3 workshop.py run 1 --solution` or open `solutions/ex01_stream.py`.

## Exercise 2 — Change the output budget (10 minutes)

Predict whether a larger output cap changes first-text time, completion time, and
usefulness. Run `python3 workshop.py run 2` to see the unchanged control comparison.
Edit `exercises/ex02_budget.py`: preserve the 32-token baseline and change only
the second cap to 96. Run `python3 workshop.py check 2`, then
`python3 workshop.py run 2` (or add `--source live`).

Both settings have two repetitions. Compare actual `output_tokens`, `done_reason`,
the response text, and the timings. Do not count a larger cap as an exact output
length. For this task, use a simple quality floor: at least three complete,
actionable, nonduplicate workshop tips; explain whether each output meets it.
This manual check is an exercise rubric, not a general model-quality evaluation.

**Checkpoint:** recommend a cap for this task using both usefulness and measured
latency. Explain why truncating a useful answer is not automatically an improvement.
If stuck, inspect `solutions/ex02_budget.py` or run with `--solution`.

## Exercise 3 — Submit four independent requests (12 minutes)

Predict whether four simultaneous requests will finish the group sooner and
whether each individual request will finish sooner. Edit
`exercises/ex03_concurrency.py` so `schedule(jobs, workers)` uses a thread pool,
honors the worker bound, returns results in input order, and propagates errors.
Submit all jobs before waiting; submitting one job and immediately waiting is
still serial execution. The starter deliberately ignores `workers`.

Run `python3 workshop.py check 3`. This uses mock jobs and checks overlap, the
worker limit, output order and failure propagation without needing Ollama.
Then run `python3 workshop.py run 3`, or use `--source live`.

Recorded mode compares historical sequential/concurrent groups. It does **not**
run or measure your scheduler, so the code checkpoint is essential. Live mode
runs your scheduler at requested concurrency 1 and 4, twice each. While the starter
is unchanged, both live runs are serial even though one requests four workers.
The `config.concurrency` field describes the requested limit, not observed overlap.

Compare group completion (`group_ms`), workload throughput, each request's first
text and finish time, and actual output counts. Group throughput divides all
output tokens by group wall time; it is not average per-request decoding speed.

**Checkpoint:** explain whether your evidence supports changing client concurrency
for an interactive response versus a batch job. Server scheduling, cache state and
hardware can change the outcome. The saved runs used server parallelism 1; four
client workers therefore do not imply four simultaneous model executions.
The reference implementation is `solutions/ex03_concurrency.py`.

## Measurement contract and final decision

The baseline uses qwen3:0.6b, thinking off, temperature 0, seed 42, context 2048,
and the exact saved prompt. Each live group receives an excluded 8-token warm-up.
Prefix caching stays active. Run order is baseline before the changed setting,
so order and cache effects are confounders, not isolated causal proof.
Saved runs preserve two real repetitions and their original machine/settings in
`data/provenance.json`; repeating a saved run does not create a new observation.

Use the worksheet to state a goal, quality floor, prediction, evidence and decision.
If group time improves but first-text time worsens, say which objective matters.
Do not infer production capacity, statistical significance or a universal best
setting from these short examples. Additional work would randomize order, add
repetitions, control cache state and test realistic workloads.

For a five-minute reading discussion, compare [FlashAttention](https://arxiv.org/abs/2205.14135)
with [PagedAttention/vLLM](https://arxiv.org/abs/2309.06180): what resource or data
movement does each change, and what would you need to measure before selecting it?
These exercises do not benchmark either paper's implementation.
