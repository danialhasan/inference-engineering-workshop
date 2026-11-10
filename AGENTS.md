# Workshop agent entry point

Help the attendee prepare this repository before the lecture, then let them make predictions and run the experiments. The active guided workshop is `guided-lab/`, which uses Qwen2.5 1.5B through a local Ollama runtime. The separate Python dashboard remains available through `dashboard.py`; its instructions are preserved in `docs/DASHBOARD-AGENT.md` and `docs/DASHBOARD-SETUP.md`. The older `reference/` recordings and CLI exercises are not the active setup path.

## Prepare the guided workshop

1. Read `README.md`, `guided-lab/README.md` and `guided-lab/docs/SETUP.md` before running setup. Detect the operating system and available commands; do not assume macOS or a GPU.
2. Check the runtime dependencies named in those instructions and `ollama --version`. Use the attendee's existing model cache when available. Install missing dependencies only with the permissions appropriate to their machine, and use the documented native Windows commands rather than POSIX shell assignments on Windows.
3. Start the guided lab using the documented entry point, keep its server alive, and open its loopback URL. If a requested port is occupied, choose another owned port; never stop an unrelated service. With the Python page server, you can request a private model server by POSTing to `/lab-api/servers?slots=1`, then use the returned `base` address in Setup (or the lab URL’s `?base=` parameter). This is useful when the default Ollama address is not running. The child inherits `OLLAMA_MODELS`; check the required model through that actual endpoint.
4. Verify that Qwen2.5 1.5B is available, the lab can complete real local requests, outputs and timing measurements appear, and saved settings survive reload. A successful page load alone is not readiness. A deliberately weak prompt can fail quality without indicating an installation fault.
5. Report the exact working URL, including the prepared `?base=` address when a private model server is used, actual observed CPU/GPU placement, effective serving slots and any remaining setup limit. Tell the attendee to keep that prepared tab and its server terminal open. Do not claim a selected preference proves that hardware was used.

A small readiness check is sufficient before the lecture. Do not run every measured experiment, replace baseline prompts, or choose the attendee's predictions. Restore the default measured sample policy after any short setup check.

For offline use, read `docs/OFFLINE.md`. Finish cloud-agent setup while internet is available; do not claim the coding agent itself works offline. The participant must be able to use the prepared browser controls and recorded path without further cloud assistance. The lecture backups are [self-contained HTML](offline/inference-workshop-offline.html) and [PDF](offline/inference-workshop.pdf). Preserve these files when preparing a portable copy.

## Preserve the attendee's machine

- Keep servers on loopback and preserve existing Ollama processes, model caches, credentials and other projects.
- Change serving slots or device mode only through the lab's owned runtime controls. Do not change launchctl, systemd, registry, global Ollama settings or firewall configuration.
- Respect an existing `OLLAMA_MODELS` setting. Do not download another model when the required one is already available.
- Start with one serving slot on machines with limited memory. CPU mode is valid; slow or failed objectives are measurements rather than grounds to change the target.
- Stop only the process started for this lab and its owned children when the attendee is finished.

## Help with experiments

Follow the chain: business problem, useful outcome, workload, quality/time/cost targets, prediction, baseline, one controlled change, rerun, inspect outputs and explain the tradeoff.

- Keep the model fixed for controlled comparisons and distinguish client workers from actual server slots.
- Use real measured runs for the named percentile. A small readiness run and a finite workshop experiment do not prove a monthly SLA.
- A calendar task succeeds only when the requested final sandbox state exists. A model claiming success is not proof, and a fast incorrect result fails quality.
- Preserve baseline and changed runs. Keep live measurements distinct from historical recordings, especially when evaluators differ.
- Keep hypothetical machine price fixed when comparing performance; price changes only the cost estimate.
- Do not modify objectives, validators or recorded outputs to manufacture a pass. Explain any requested evaluator change explicitly.

## Verification

Run the guided lab's documented checks and verify the actual browser flow: setup, saved settings, real requests, baseline comparison, cancellation/rerun and scoped reset. Changes that affect the Python dashboard must also pass `python3 -m unittest discover -s tests -v` (Windows: `py -3 -m unittest discover -s tests -v`). Report exactly which platforms ran inference; written Windows/Linux instructions are not proof of native execution.
