# Inference engineering starts with the work — guided lab

A hands-on lab for a one-hour workshop. You take a piece of customer work with a promised latency, quality, cost and demand, run it on your own laptop against a small local model, change a real lever, run it again, and compare.

Model: Qwen2.5 1.5B (`qwen2.5:1.5b`, 4-bit, 986 MB) served by Ollama. No GPU is required. Nothing here needs the internet once the model is on disk.

## Start

```
python3 tools/serve.py --open
```

Then **Setup → Run setup check**. (`sh start.sh`, `start.command` and `start.bat` do the same; `node tools/serve.mjs` also serves the pages but cannot start extra model servers.)

No model server, or no model? Open `lab/index.html` as a file and choose **Recorded data**. You make the same predictions and inspect real recorded runs. They are labelled RECORDED and are never shown as your laptop's.

A coding agent preparing a laptop before the lecture should follow [docs/AGENT-SETUP.md](docs/AGENT-SETUP.md).

## What you do in each lab

1. **Read the work and the promise.** All promises are hypothetical. They were held fixed while the reference runs were recorded.
2. **Know the systems.** A, B and C are the same Qwen2.5 1.5B on one MacBook Pro (M2 Pro, 16 GB), recorded in three serving setups: A is GPU with 1 serving slot, B is GPU with 4 serving slots, C is CPU with 1 serving slot. Your laptop's own setup is observed, not assumed.
3. **Predict.**
4. **Choose settings and run.** The first run is your baseline. Then change one lever and run again. Runs are kept side by side.
5. **Compare** with the recorded systems in "Which system keeps which promise".
6. **Decide.**

| Lab | Work | Levers you can change |
|---|---|---|
| 1 · What counts as done? | support chat, code completion, an agent that books a meeting | agent prompt; checking the calendar before accepting "done" |
| 2 · Does the promise hold under load? | support chat with several users at once | number of users |
| 3 · Two workloads, one server? | a batch of tender notices, with a chat user sharing | client workers; chat user on or off; JSON-only output |
| every lab | | model server (and its serving slots), processor (server default or CPU only), sample size |

Levers are tagged **application**, **serving** or **demand**. Client workers are your setting; serving slots belong to the server. The lab reports both, and reports the serving setup it observed.

## What is real

- **Every request is a real model call** on your hardware.
- **A standard run measures 100 requests per condition** (40 agent tasks in Lab 1). A p95 is read from 100 samples; with fewer than 20 there is no verdict at all. A finite run is a bounded experiment and does not prove a monthly promise.
- **The agent's tools are real.** They are functions on a sandbox calendar owned by the lab. A tool runs only when the model sends a valid call, the model sees the real result, and success is read from the calendar: one new event with the requested title, person and length, in the first free slot from a matching lookup. The loop stops after six model calls.
- **The serving setup is observed.** Before each run the lab sends four probe requests together, counts how many were answered at once, and asks Ollama which processor holds the model.

## Files

| Path | What it is |
|---|---|
| `lab/index.html` | The lab |
| `lab/workloads.js` | Workloads, the sandbox calendar and its tools, the checks and the promises |
| `lab/data/` | Recorded reference runs, an agent evidence log, and their provenance |
| `tools/serve.py` | Page server (Python standard library). Can start extra Ollama processes that the lab owns |
| `tools/check.sh`, `tools/check.ps1` | Readiness checks |
| `tools/selftest.mjs` | Regression checks for the validators and tools; needs no model |
| `tools/capture.mjs`, `tools/agent-evidence.mjs` | Record a system; write a full agent transcript |
| `slides/index.html` | A companion deck (←/→ main track, ↑/↓ detail) |
| `docs/` | Exercises, presenter guide, agent setup, sources, verification, changes |

## Limits

- Tested on one MacBook Pro with Chrome. Windows and Linux paths were written with care and not run by the author.
- The recorded systems were captured while the laptop was busy with other work. They are honest observations, not controlled benchmarks.
- Quality checks are exact but simple. They show that quality needs its own measurement; they are not a model evaluation.
- Every promise, target and price is hypothetical.
