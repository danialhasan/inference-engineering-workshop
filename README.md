# Inference Engineering × Applied AI

A local workshop by Danial Hasan × Pillars Network. Use your coding agent to set up the project, then use the dashboard to operate a small model, change real settings, and compare results against a business promise.

**Model:** Qwen2.5 1.5B, approximately 986 MB to download. **Runtime:** Ollama. **Dashboard:** Python 3.10 or newer, standard library only. No API key, cloud inference, Python packages, or npm install is needed.

## Ask your coding agent

Open this repository in Codex, Claude Code, Cursor, or another coding agent and send:

> Read AGENTS.md and docs/DASHBOARD.md. Set up and start this workshop on my machine. Detect my operating system and available Python/Ollama first. Prepare Qwen2.5 1.5B, preserve my existing services, verify the dashboard and model health, and give me the local dashboard URL. Do not change the exercise targets or fake results. Help me understand the measurements as I make one change at a time.

The agent uses [AGENTS.md](AGENTS.md) as the setup entry point. If it cannot install software under your machine's permissions, follow the manual steps below.

## Start manually

1. Install [Python 3.10+](https://www.python.org/downloads/) and [Ollama](https://ollama.com/download) for your operating system. Reopen your terminal after installation so both are on PATH.
2. Clone the repository and enter it:

   ```sh
   git clone https://github.com/danialhasan/inference-engineering-workshop.git
   cd inference-engineering-workshop
   ```

3. Check and start the dashboard:

   **macOS / Linux**
   ```sh
   python3 dashboard.py --check
   python3 dashboard.py
   ```

   **Windows PowerShell**
   ```powershell
   py -3 dashboard.py --check
   py -3 dashboard.py
   ```

   If `py` is unavailable but `python --version` reports 3.10+, use `python` instead.

4. Open **http://127.0.0.1:8876/** and click **Prepare model**. It downloads Qwen2.5 1.5B only if it is missing. Prepare before leaving reliable internet; live exercises then run offline.
5. Run the default configuration, inspect the outputs, and click **Use as baseline**. Change one lever and run again.

Keep the terminal open. Ctrl+C stops the dashboard and its own model-server child. It does not stop your normal Ollama service.

## Three business scenarios

| Exercise | Business problem | Levers to investigate |
|---|---|---|
| Make the report correct | Extract the correct reference, agency, date and source | Context, JSON schema, output token budget |
| Keep up with the morning rush | Complete correct reports during a burst | Client concurrency versus real Ollama server slots |
| Protect the waiting user | Run a background batch while answering live questions | Background concurrency, shared capacity, per-user versus total throughput |

Every exercise shows its fictional contract, quality requirement and cost objective. The targets are teaching examples, not vendor guarantees. They stay fixed while you change configuration.

## What actually changes

The dashboard writes `.workshop/config.json`. Each run snapshots it into `.workshop/runs/`, then makes real local model requests. Server slots change `OLLAMA_NUM_PARALLEL` on a **private child process**. The CPU setting sends `num_gpu=0`; automatic mode uses Ollama's hardware selection. Inspect Runtime details and each run's manifest to see actual placement, not just the selected preference.

There is no simulated speed multiplier. Correctness, complete-response time, first-token time and total throughput are calculated from actual outputs and timestamps. Machine cost is an explicitly hypothetical estimate, not an electricity measurement or bill. Short runs are not proof that an agreement will be met all month.

## Laptop compatibility

- macOS: Apple silicon can use Metal; Intel Macs may run on CPU. Both can use the dashboard.
- Windows: native Python and Ollama work without WSL. GPU support depends on your installed hardware/drivers; CPU mode is available.
- Linux: use native Python and Ollama. GPU support depends on your installed hardware/drivers; CPU mode is available.
- A ThinkPad is a laptop family, not a runtime type: check whether it runs Windows or Linux and inspect its actual hardware.
- On low-memory machines start with **one client, one server slot, 128 output tokens, four documents**. More slots require more memory. Avoid four-slot mode if the machine is under memory pressure.
- If the machine cannot run the model, open the **Recorded reference lab** link. Its captured outputs are labeled recorded; it cannot measure a new configuration on your laptop.

Only macOS has been physically rehearsed by the presenter. Windows/Linux commands are included, but native execution on those systems is not claimed as tested.

## Files for you and your agent

- [AGENTS.md](AGENTS.md): setup, verification and safe operating instructions.
- [docs/DASHBOARD.md](docs/DASHBOARD.md): control mapping, metrics, API and code map.
- [lab/prompts.py](lab/prompts.py): the prompt-building function your coding agent can edit; reloaded before each run.
- [lab/scenarios.py](lab/scenarios.py): fictional workloads and business requirements.
- [slides/index.html](slides/index.html): the current lecture, also linked in the dashboard.
- [docs/REHEARSAL.md](docs/REHEARSAL.md): what was actually checked and known limitations.
- [docs/LEGACY-CLI.md](docs/LEGACY-CLI.md): older, separate 0.6B CLI exercises; not required for this dashboard.

Run the checks with `python3 -m unittest discover -s tests -v` (Windows: `py -3 -m unittest discover -s tests -v`). These tests use fixtures; the rehearsal separately exercises the real local model.

## Sources

The lecture cites Philip Kiely's *Inference Engineering* (Baseten Books, 2026) by section and printed page. Obtain the book from [Baseten](https://www.baseten.co/inference-engineering/); the PDF is not redistributed here. Ollama behavior follows its [API](https://docs.ollama.com/api/generate), [concurrency configuration](https://docs.ollama.com/faq), and [running-model metadata](https://docs.ollama.com/api/ps).
