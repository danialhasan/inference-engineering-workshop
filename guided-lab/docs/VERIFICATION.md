# Verification of the integrated guided lab

The integrated revision passed its implementation and independent acceptance checks on 10 November 2026. Execution was on one Apple M2 Pro Mac with 16 GB of memory, using local Ollama and Qwen2.5 1.5B. Captures shared the host with other work; their timings are measured observations, not controlled idle-machine benchmarks.

## Code and lifecycle checks

- The author/coordinator regression suite passed 43 of 43 checks. It covers all extraction fields, malformed and unknown tools, argument types and values, exact calendar outcome, matching lookup and first slot, reserved note names, bounded agent steps, sample thresholds and retention of full final state in measured runs.
- Independent adversarial verification passed all 10 cases, including a contradictory title containing the requested words. Exact normalized equality is required.
- The repository's existing Python dashboard tests passed 26 of 26; its source and launch path remain available.
- JavaScript syntax, Python compilation and local asset references passed. An isolated lifecycle check confirmed that terminating the page server also stops the model child it owns, without issuing an inference request.

## Real local execution

Independent full-size runs completed all three workloads. Failures and missed objectives were retained. A separate real-tool audit matched every emitted call, actual result, subsequent transcript and final sandbox for six explicit-prompt tasks, including one successful booking. The evidence files preserve the other five failures and four baseline failures; these are execution-path observations, not a model-quality estimate.

All 96 agent tasks across the A/B/C reference recordings were independently replayed through the current tools and strict outcome evaluator. Every outcome matched. The three profiles contain all 15 expected conditions and match `recorded.js` exactly:

| Reference | Observed processor | Serving slots | Primary sample count | Agent tasks |
|---|---|---:|---:|---:|
| A | GPU | 1 | 100 | 40 |
| B | GPU | 4 | 100 | 40 |
| C | CPU | 1 | 40 | 16 |

A and B were captured immediately before title validation was tightened to exact normalized equality. Independent replay under the final evaluator changed no outcome. Their raw durations and responses were preserved.

## Runtime and browser checks

- The interface started a private four-slot server, independently confirmed by its `-np 4` process configuration. Client demand and server slots remained distinct.
- CPU mode reported zero GPU bytes. Returning to the server default reloaded the model and reported GPU execution on the prepared runtime.
- Setup, missing-model guidance, saved baseline and changed runs, reload, export, selection during streaming, cancellation/retry and prediction locking passed.
- A final in-app-browser check confirmed that resetting one exercise preserves the other exercise and the worksheet. The global reset remains separately labelled.
- Recorded A/B results remained usable with an unavailable model address and a network-disabled browser tab, with no further requests after loading. The final C data passed the same schema, scorecard and strict replay checks. All required scripts, styles and records are local.
- The lab's Slides link opens the self-contained lecture copy. The repository's `offline/` folder contains the HTML and PDF backups without duplicating the PDF inside this lab.

## Remaining limits

Windows and Linux setup files were not executed on those operating systems. CPU fallback was tested on Apple silicon, not a separate CPU-only laptop. Direct-file browser launch was not exercised by the in-app-browser test; the tested route used the Python loopback server, while recorded data is also bundled as a classic script without fetch/CORS dependence.

The Node page-server fallback serves the lab but does not provide Python's owned-model-server controls. Python, Ollama and the model must be prepared before losing internet access. Cloud coding agents may still require a connection; the prepared browser controls and local-model/recorded exercises do not require further cloud assistance.

A finite experiment does not prove a monthly SLA. Cost uses a hypothetical machine-hour rate, and these captures should not be used as general performance claims about other hardware or deployments.
