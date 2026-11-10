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

**Learning goal:** choose an output budget that meets a useful-result requirement,
then explain its completion-time cost. A larger cap permits more output; it does
not guarantee a complete answer or an exact output length.

### Predict and inspect the starter

Predict what will happen to first-text time, completion time and usefulness when
you allow three times as many output tokens. Run:

```sh
python3 workshop.py run 2
```

Open `exercises/ex02_budget.py`. Its starter returns `[32, 32]`, so both settings
have the same cap. In recorded mode this repeats the same saved observations;
it does not create additional evidence.

### Change one setting

Preserve the 32-token baseline and change only the second cap:

```python
def output_caps():
    return [32, 96]
```

The model, prompt and other settings remain fixed. Save the file, then run:

```sh
python3 workshop.py check 2
python3 workshop.py run 2
```

The check should print `PASS Exercise 2`. The run shows two repetitions per
setting. To generate new measurements on your laptop, run
`python3 workshop.py run 2 --source live` instead.

### Read the results and the text

These values are from the included historical recordings in `data/runs.json`,
not performance targets for your laptop. Each pair contains the two saved runs.

| Output cap | Actual output tokens | First text (ms) | Request completion (ms) |
|---|---|---|---|
| 32 | 32 in each run | 27.30 / 9.92 | 210.51 / 187.93 |
| 96 | 96 in each run | 8.26 / 8.03 | 474.81 / 468.59 |

Open the new JSON file printed by the command. Within each entry in `runs`,
compare `requests[0].text`, `output_tokens`, `done_reason`, `first_text_ms` and
`wall_ms`. The 32-token recording contains three complete tips. The 96-token
recording contains nine complete tips and begins a tenth item, ending at `10.`.
Both have `done_reason: "length"`, indicating that the configured cap was reached.

Use a quality floor of at least three complete, actionable, nonduplicate workshop
tips. Under that requirement, the smaller output already qualifies and finishes
sooner. If the requirement is a broader list, the larger budget adds content but
still leaves an incomplete final item. This rubric evaluates this exercise's task,
not general model quality.

Do not conclude that raising the cap improved first-text time. The recordings use
fixed run order and active prefix caching; startup differences can have causes
other than the output cap. More output tokens per second also does not mean the
whole answer finishes sooner, because the longer answer contains more work.

### Connect the result to the book

In Philip Kiely's *Inference Engineering*, Chapter 2, §2.2, **LLM Inference
Mechanics**, pp. 46–48, distinguishes input processing during prefill from output
generation during decode. Ordinary autoregressive decoding generates successive
tokens, so allowing a longer response can add generation steps and completion time.

Chapter 5, §5.3.1, **Prefix Caching and KV Cache Re-Use**, pp. 136–137, explains how
reusing a prompt prefix can reduce prefill work. That is a reason to investigate
cache state before attributing a first-text difference to your cap change.

**Checkpoint:** write a recommendation in `docs/WORKSHEET.md` that names the
required output, checks the actual text and cites both repetitions. For example:
“For three useful tips, I would keep the smaller budget because it meets the
quality requirement and finishes sooner. I cannot attribute the first-text
difference to the output cap.” If stuck, compare `solutions/ex02_budget.py` or
run with `--solution` without replacing your own work.

## Exercise 3 — Submit four independent requests (12 minutes)

**Learning goal:** distinguish client submission concurrency, server execution
capacity, whole-group throughput and the latency experienced by one request.

### Predict and inspect the starter

Predict whether four simultaneous requests will finish the group sooner and
whether each submitted request will receive text sooner. Open
`exercises/ex03_concurrency.py`. The starter is:

```python
def schedule(jobs, workers):
    return [job() for job in jobs]
```

Each `job()` starts and finishes before the next begins. The starter ignores
`workers`, so requesting four workers still runs serially.

### Submit before waiting

Replace the function with a bounded thread pool, keeping the import at the top:

```python
from concurrent.futures import ThreadPoolExecutor


def schedule(jobs, workers):
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(job) for job in jobs]
        return [future.result() for future in futures]
```

The first list submits every job; the pool runs up to `workers` jobs concurrently.
The second list collects results in input order. Waiting for the first result does
not stop other submitted jobs from running. A failed job raises an exception so
that the group cannot be reported as a successful measurement. Submitting one job
and immediately waiting for it inside the same loop would serialize the work again.

Save and check your code:

```sh
python3 workshop.py check 3
python3 workshop.py run 3
```

The check should print `PASS Exercise 3`. It uses mock jobs to verify overlapping
execution, the worker bound, result order and failure propagation without Ollama.
Recorded mode loads historical sequential/concurrent groups; it does **not**
execute or time your scheduler. To measure your edited implementation, run
`python3 workshop.py run 3 --source live`.

Live mode runs four requests with requested concurrency 1 and 4, twice each.
`config.concurrency` records the requested limit, not observed server parallelism.

### Compare the group and individual requests

These are the two saved repetitions, with 128 total output tokens per group:

| Client workers | Whole-group completion (ms) | Whole-group throughput (tokens/s) |
|---|---|---|
| 1 | 609.63 / 612.01 | 209.96 / 209.15 |
| 4 | 634.26 / 610.97 | 201.81 / 209.50 |

There is no clear group-throughput improvement in these observations. The saved
server had parallelism 1, so submitting four requests together mostly moved waiting
into the server queue. Individual first-text times were roughly 7–8 ms after
submission with one worker; with four workers, some requests waited hundreds of
milliseconds. Do not generalize this result to servers with different capacity.

Open the saved JSON and compare `group_ms`, `throughput_tokens_s`, and each
request's `first_text_ms`, `wall_ms` and `end_ms`. Group throughput divides all
output tokens by the group's elapsed time; it is not each user's decoding speed.

The individual request timer starts when that request begins. In sequential mode,
it excludes time waiting behind previous jobs in the client. Use `group_ms` for
whole-workload completion, or each request's `end_ms` for its completion relative
to the group's start. A comparison of request durations alone misses that waiting.

### Connect the result to the book

Chapter 7, §7.2.1, **Concurrency and Batch Sizing**, pp. 186–188, distinguishes
static, dynamic and continuous batching. Figure 7.8 on p. 188 illustrates admitting
new requests as others finish. Serving engines can share execution capacity across
requests, with latency and throughput tradeoffs that need measurement.

Your thread pool changes client submission concurrency. It does not implement
continuous batching or increase model-server capacity. The next investigation is
whether the server can exploit overlapping requests, and how that affects both
throughput and response times.

Chapter 1, §1.4, **Measuring Latency and Throughput**, pp. 35–37, distinguishes
per-user token speed from total service throughput and includes queue/network time
in end-to-end measurements. This is why group tokens/s and a user's wait answer
different questions.

**Checkpoint:** state which objective matters and whether your evidence supports
more client concurrency. For example: “Four workers did not materially improve
group completion on this recorded server. Some submitted requests waited longer,
so I would investigate server capacity before increasing client concurrency.”
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


## Reading references

Philip Kiely, *Inference Engineering*, Baseten Books, 2026. References use printed
page numbers; the examined PDF's page counter is two pages ahead. These notes
paraphrase the book; a copy of the book is not required to complete the exercises.

| Read alongside | Chapter and section | Printed pages | What it helps explain |
|---|---|---|---|
| Exercises 1 and 3 | Chapter 1, §1.4, Measuring Latency and Throughput | 35–37 | First response, per-user speed, total throughput and end-to-end time |
| Exercise 2 | Chapter 2, §2.2, LLM Inference Mechanics | 46–48 | Prefill, autoregressive decode and output sequence limits |
| Both experiments | Chapter 4, §4.5.2, Performance Benchmarking Tips | 114 | Preserve a baseline and change one variable at a time |
| Exercise 2 interpretation | Chapter 5, §5.3.1, Prefix Caching and KV Cache Re-Use | 136–137 | Reused input can affect first-text timing |
| Exercise 3 | Chapter 7, §7.2.1, Concurrency and Batch Sizing; Figure 7.8 | 186–188 | Server batching, capacity and latency/throughput tradeoffs |

The two repetitions are teaching examples. Chapter 4's benchmarking guidance
calls for consistent workloads and enough traffic to characterize performance;
a deployment decision needs more observations and representative traffic.
