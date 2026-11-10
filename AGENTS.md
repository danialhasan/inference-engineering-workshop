# Workshop agent entry point

The user is an attendee using their coding agent beside a dashboard. Help them operate and understand the workshop; do not complete all experiments or change their hypotheses without asking what they want to try.

## Setup first

1. Read README.md and docs/DASHBOARD.md. The active workshop is dashboard.py + lab/ + web/, using **qwen2.5:1.5b**. Ignore the older 0.6B CLI unless explicitly requested.
2. Inspect OS and available commands. Try Python 3.10+ with `python3`, `py -3` (Windows), or `python`. Check `ollama --version`. Do not assume a Mac or a GPU. Use native Windows PowerShell syntax on Windows, not POSIX assignments or shell scripts.
3. If dependencies are missing, use official Python/Ollama installers or the user's established package manager with their applicable permissions. Do not download unrelated runtimes. Recheck PATH in a fresh shell if necessary.
4. Start `python3 dashboard.py` on macOS/Linux or `py -3 dashboard.py` on Windows as a persistent background task or terminal session. Open http://127.0.0.1:8876/.
5. Click Prepare model, or POST `{}` with JSON content type to http://127.0.0.1:8876/api/setup. Poll /api/state and /api/health until the model is ready or an actionable error appears. A model download can take minutes. Never report ready solely because the dashboard HTTP page loads.
6. Verify /api/health includes qwen2.5:1.5b, then run four document jobs as a small live check. Inspect actual outputs and the saved manifest. Report the URL, model availability, server slots and observed device placement to the user.

## Preserve the user's machine

- The workshop starts its own Ollama server on loopback port 18731, with a child-scoped environment. It does not change launchctl, systemd, registry or global Ollama settings.
- Do not kill existing Ollama or coding-agent processes, delete model caches, change firewall settings, or expose the dashboard to a network.
- If ports are occupied, choose `--port 8877 --ollama-port 18732`; do not terminate the other application.
- OLLAMA_MODELS, if already set, is inherited. Otherwise the installed Ollama default model directory is used. Do not redownload a model that is already visible there.
- With a 4-slot server, memory requirements can rise. Prefer one slot and CPU mode if acceleration is unsupported or memory is tight. Explain slower hardware rather than adjusting targets to manufacture a pass.
- Stop the server using its own terminal when done; it cleans up only the model process it started.

## Help with experiments

Follow: business problem → useful outcome → workload → quality/time/cost targets → baseline → one change → rerun → inspect output → explain tradeoff.

- Keep the 1.5B model fixed for controlled comparisons.
- Ask the user for a prediction before running their next experiment.
- Configuration changes are saved through /api/config and applied by /api/run. Do not edit metrics or recordings to make results look better.
- Client concurrency is not server batching. Server slots really restart the private model server with OLLAMA_NUM_PARALLEL=1 or 4.
- Run manifests record actual loaded-model metadata. “Automatic GPU/CPU” is a preference, not evidence that a GPU was used.
- A fast incorrect response fails quality. A run with few samples does not prove a monthly percentile promise.
- A lower assumed machine price only changes the estimate, not the actual performance. Keep it fixed when comparing efficiency.
- The generic prompt function in lab/prompts.py reloads on each run. Capture a baseline before editing. Changes to server code need a restart. Prompt hashes are saved; changes to evaluation require explicit explanation and are not performance gains.

## Verification

Run `python3 -m unittest discover -s tests -v` (or Windows `py -3 ...`). Test setup, saved configuration after reload, live run, baseline selection, comparison and failed-quality outputs in the actual browser. Do not claim Windows/Linux were tested if you only ran on macOS.
