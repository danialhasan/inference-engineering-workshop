# Provenance of the recorded systems

The files in `recorded/` are genuine runs of this kit's workloads. Each file is the unedited output of `tools/capture.mjs`, which uses the same `lab/core.js` and `lab/workloads.js` as the browser lab. `recorded.js` is the same three files bundled into one script so the lab can read them when opened as a file.

Nothing was simulated, smoothed or filled in by hand, with one stated exception: the two tool waits inside each agent task are fixed delays of 400 ms and 1,200 ms, standing in for real tool calls. Every model request is real and is kept in full: its tags, token counts, the server's own duration counters (Ollama's raw final record is under `raw_final`), client-side timings, the generated text and the result of its quality check.

These recordings were made for this kit on the afternoon of 10 November 2026. They are new measurements. None of the first kit's recordings (made that morning for different experiments) is reused or relabelled here.

## Capture session

- Date: 10 November 2026, 2:34–2:43 pm Toronto time (19:34–19:43 UTC).
- Machine: MacBook Pro `Mac14,9`, Apple M2 Pro, 12 CPU cores, 16 GB RAM, on AC power.
- Operating system: macOS 26.4.1.
- Runtime: Ollama 0.40.11, two private servers on loopback ports with their own model folder.
- Model: `qwen2.5:1.5b` from the Ollama registry, 1.5B parameters, Q4_K_M, digest `65ec06548149…`.
- Request options in every call: `temperature 0`, `seed 7`, `num_ctx 4096`, `keep_alive 30m`.
- Client: Node 26.12.1 on the same machine, over loopback HTTP.
- Sample scale: 3. Lab 1 and Lab 2 play three times the requests of a live run. Lab 3's batch runs are single jobs, as in a live run.

## The three systems

All three are the same laptop and the same model. Only the configuration differs.

| File | System | Server setting | Extra request option | Requests | Load average at start | SHA-256 (first 12) |
|---|---|---|---|---|---|---|
| `sys-a.json` | A · GPU, one request at a time | `OLLAMA_NUM_PARALLEL=1` | none (GPU via Metal) | 241 | 3.2 | `b25d021fc8db` |
| `sys-b.json` | B · GPU, four requests at once | `OLLAMA_NUM_PARALLEL=4` | none (GPU via Metal) | 241 | 6.9 | `2cae1952a7a2` |
| `sys-c.json` | C · no GPU, one request at a time | `OLLAMA_NUM_PARALLEL=1` | `num_gpu: 0` | 241 | 5.0 | `56d5a5840108` |

The exact command line for each system is stored in the file's `command` field. The script that ran all three is reproduced in `docs/VERIFICATION.md`.

## How verdicts are produced

The files hold measurements only. Verdicts ("met", "missed") are computed when the page loads, by comparing the measurements with the hypothetical targets in `lab/workloads.js` (`OBJ`). The author set those targets after looking at these runs, so that the systems land on different sides of them. Change a target and the verdicts change; the measurements do not.

A percentile promise judged on fewer samples than the percentile needs (20 for a p95, 10 for a p90) is marked "smoke test" and judged on its worst sample.

## What these numbers are not

- Not a benchmark. The laptop was running other programs (see the load averages), and each condition was run once.
- Not a different computer. System C is the same Apple-silicon laptop with GPU offload turned off. It stands in for "weaker hardware" and represents no particular machine.
- Not production traffic. The load test uses one, two and four simulated users with pauses of 0 to 400 ms. The shared run in Lab 3 contains only three chat questions per system.
- Not a model evaluation. The quality checks are substring and JSON checks on fictional work items.
- Never a measurement of an attendee's laptop. The lab labels them RECORDED wherever they appear.

One oddity is left as recorded: on System C the batch finished faster with four workers than with one (8.3 s against 11.8 s) even though the server handles one request at a time. With single runs on a busy machine this cannot be told apart from noise.

## Reproducing or extending

```
node tools/capture.mjs --id sys-mine --short "Mine" --label "My laptop" --scale 3
```

writes a new system next to these and rebuilds `recorded.js`.
