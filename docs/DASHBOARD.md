# Dashboard operations and implementation

## Workflow

Read the scenario and fictional agreement. Establish correct output, capture a baseline, change one lever, rerun the same workload, and compare. The student can operate controls directly; their coding agent can inspect source, explain results and modify prompts or application behavior.

## Controls

| Control | Real behavior | Scope |
|---|---|---|
| Field instructions | Brief extraction request or explicit field definitions | Applied AI task specification |
| Context | Sends authoritative passage alone or adds archived distractors | Applied AI input design |
| JSON schema | Passes a four-field schema in Ollama's `format` field; otherwise requests JSON without schema enforcement | Applied AI output contract |
| Maximum output tokens | Sends `options.num_predict` | Output work; too low truncates correct answers |
| Client concurrency | Thread-pool limit for document requests | Application arrival/scheduling; not GPU batch size |
| Server slots | Restarts only the private Ollama child with `OLLAMA_NUM_PARALLEL` 1 or 4 | Runtime's concurrent sequences; actual batching remains runtime-controlled |
| Execution preference | `num_gpu=0` or automatic placement | CPU versus available acceleration; inspect `/api/ps` metadata |
| Document jobs | Generates 4–24 deterministic documents | Workload size; keep fixed across a controlled comparison |
| Assumed hourly price | Multiplies occupied-run time by a stated price | Hypothetical economics; not a measured laptop bill |

This is not a prefill/decode disaggregation demonstration. The shared exercise sends both workloads to one actual model server. It can motivate designing separate pools, but no control pretends to split those phases.

## Measurement contract

The model is warmed with one generated token before timing. Model loading for that warmup is excluded. Subsequent load time, including reloads, remains visible in request metadata. Repeated prompts may reuse a prefix; caching is natural, not forced cold. Temperature is zero, seed 42, and context capacity 2,048 tokens. Model quantization and digest come from Ollama metadata.

Document requests arrive together. A constrained client queues them before submission. For the shared scenario, four chat requests arrive at 0.5, 1, 1.5 and 2 seconds on an independent client thread while document work runs. The server slots constrain both workloads.

Each row records scheduled arrival, application queue, first nonempty text, completion, text, input/output tokens, Ollama input/generation/load durations, and errors. Unattributed time includes transport/server waiting and other overhead; it is **not** a GPU queue measurement. A final provider completion record is required.

- Report quality: valid JSON and exact match of reference, agency, date and source against independently generated fixture facts. Wrong fields or truncation fail.
- Chat quality: answer includes the expected 30-day refund policy. This is a narrow teaching check, not a general safety/quality evaluation.
- Latency: share of all completed report attempts within 30 seconds, with errors counted as misses; nearest-rank p95 also shown.
- Throughput: correct reports divided by whole-run elapsed time. Output tokens per second aggregate is also retained in the JSON.
- Cost: elapsed run seconds / 3600 × assumed price; divide by correct reports for cost per useful result. Zero correct reports gives no finite cost per correct report.
- Interactive metric: scheduled-arrival-to-first-token time, including waits. Errors and missing first tokens miss the 1-second objective.

A completed local run is not proof of a monthly service commitment. Sample-size warnings remain visible. A cancelled run is not eligible as a baseline. Saved configuration and workload count must be compared before interpreting a speed change.

## APIs for an agent

Only loopback HTTP is accepted. Mutations require JSON and same origin when invoked by a browser. No credentials are needed.

- GET `/api/health`: model availability, private process PID and port, configured slots, Ollama version and actual loaded-model metadata.
- GET `/api/state`: scenarios, saved configuration, current job, history and baseline IDs.
- POST `/api/setup` `{}`: prepare private server and download the fixed model if missing; poll state.
- POST `/api/config`: validated configuration object; rejected during active work.
- POST `/api/run` `{"scenario":"quality"}` (also `burst`, `shared`): asynchronous live run.
- POST `/api/cancel` `{}`: skip queued work; let active requests finish. Does not kill other services.
- POST `/api/baseline` `{"id":"..."}`: pin a completed run for its scenario.
- GET `/api/export`: full saved run records.

On Windows use `Invoke-RestMethod -Uri http://127.0.0.1:8876/api/setup -Method Post -ContentType application/json -Body '{}'`. On any platform Python's urllib can call the same API. Agents can use the browser instead.

## Code map

- `dashboard.py`: restricted static routes and JSON APIs, localhost server lifecycle.
- `lab/control.py`: configuration validation, persistence, asynchronous run scheduling, measurements and quality checks.
- `lab/provider.py`: owned Ollama child, streaming API client, hardware metadata.
- `lab/scenarios.py`: fictional scenarios and deterministic reference data.
- `lab/prompts.py`: editable application prompts and schema, reloaded at each run.
- `lab/metrics.py`: aggregation and objective checks.
- `web/`: native HTML controls and results; no build tool or remote dependency.
- `.workshop/`: local config, baselines, raw runs and Ollama log; ignored by Git and not served as static files.
- `reference/`: separately labeled, previously captured lab data; not used to generate live results.

## Recovery

If preparation fails, inspect `.workshop/ollama.log`, check PATH, disk space and available memory. Do not assume every error is a missing GPU. If changing slots fails because the port is occupied, restart the dashboard with another private port. A saved run with an error is useful evidence, not a result to delete silently.

The dashboard binds only 127.0.0.1. Reloading the browser retains config and run history. Restarting the backend retains them too. Reset a particular control through the UI rather than removing all state.
