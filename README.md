# Inference Engineering × Applied AI

A local workshop by Danial Hasan × Pillars Network. Use your coding agent to prepare the project, then follow three guided experiments that connect useful customer outcomes to real model performance. Predict what will happen, record a baseline, change one setting and compare the measured result.

The active workshop is in **`guided-lab/`**. It runs **Qwen2.5 1.5B** on your own laptop through **Ollama**, with real requests and sandboxed local calendar tools. No cloud inference or API key is needed. Prepare the model before leaving reliable internet so the workshop can run offline. Cloud coding agents may still need a connection, so finish agent-assisted setup beforehand; the lab controls and recorded path work independently afterwards.

## Prepare before the lecture

Give your coding agent this repository URL and the following prompt:

> Read AGENTS.md and the guided-lab setup instructions. Detect my operating system and available runtime tools, set up Qwen2.5 1.5B, and start the guided workshop on this laptop. Preserve my existing services and model cache. Verify a small real local request, the output and timing display, and saved settings after reload. Leave the workshop open and the exercises ready for me. Do not run every experiment or replace the baseline prompts.

The agent should report the exact local URL, actual device placement and effective serving slots. Keep that prepared tab open. If the agent started a private model server, use its complete URL including the `?base=` address rather than opening a fresh generic tab. Loading the page alone is not readiness. A completed response that fails a quality check can be an intended exercise finding.

For manual installation and launch, follow [the guided lab instructions](guided-lab/README.md) and [platform setup](guided-lab/docs/SETUP.md). Install dependencies for your actual operating system; Windows does not require WSL. CPU mode is supported when GPU acceleration is unavailable. More serving slots can use more memory, so start with one on a limited laptop.

For unreliable venue Wi-Fi, follow [offline preparation and fallback](docs/OFFLINE.md). Open the [self-contained lecture](offline/inference-workshop-offline.html) or [PDF backup](offline/inference-workshop.pdf) without the model runtime. The portable source package does not include model weights.

## Start the guided lab manually

After installing Python 3 and Ollama and preparing `qwen2.5:1.5b`, run this from the repository root:

```sh
python3 guided-lab/tools/serve.py 8878
```

On Windows PowerShell, use:

```powershell
py -3 guided-lab/tools/serve.py 8878
```

Open [the guided lab](http://127.0.0.1:8878/lab/index.html), choose **Setup**, and complete the live setup check. If port 8878 is occupied, the server chooses the next available port and prints the actual URL. Keep the terminal open while working; Ctrl+C stops this page server and the model servers it owns.

The Python page server enables the lab's controls for starting private Ollama servers with different serving-slot counts. It preserves existing servers. The Node page-server fallback can serve the lab but does not provide that private-process control.

## The three experiments

| Lab | Useful outcome and promise | What you investigate |
|---|---|---|
| What counts as done? | Chat starts, a complete code suggestion arrives, or a requested meeting actually exists | First-token time, complete-response time and verified task completion; prompt and validation changes |
| Does the promise hold under load? | Chat keeps its response promise while more users ask questions | Client demand versus real serving slots and device placement |
| Two workloads, one server? | Correct fields are extracted before a deadline while chat remains usable | Batch workers, structured output and shared capacity |

Each experiment preserves a baseline and changed run so you can compare the same work under different settings. The worksheet then helps you define a useful outcome, measurement, objective and any contractual consequence for your own application.

The fictional targets are teaching examples, not vendor guarantees. A short readiness check cannot validate a percentile, and a finite measured run cannot establish a monthly SLA. Cost uses an explicit hypothetical machine rate rather than a measured bill.

## Live and recorded results

Live results come from the laptop running the experiment. The recorded reference systems use the same Qwen2.5 1.5B model on one M2 Pro with 16 GB of memory:

- **A: GPU, one serving slot**.
- **B: GPU, four serving slots**.
- **C: CPU, one serving slot**.

Your laptop is a separate system. Inspect its observed configuration rather than assuming it matches a reference. Recorded results remain available when live inference is unavailable, and their provenance and evaluator limits must stay visible.

## Other material in this repository

- [AGENTS.md](AGENTS.md) is the active setup entry point for coding agents.
- [guided-lab/](guided-lab/) contains the sequential workshop and its setup and verification instructions.
- [slides/index.html](slides/index.html) contains the lecture.
- [docs/DASHBOARD-SETUP.md](docs/DASHBOARD-SETUP.md) preserves instructions for the separate Python document-processing dashboard. Its existing `python3 dashboard.py` command and port 8876 remain available.
- [docs/DASHBOARD.md](docs/DASHBOARD.md) describes that dashboard's controls and APIs.
- [reference/](reference/) preserves the earlier recorded lab.
- [docs/LEGACY-CLI.md](docs/LEGACY-CLI.md) documents the older 0.6B CLI exercises.

Only macOS has been physically rehearsed by the presenter. Windows and Linux setup instructions do not imply those platforms have completed native inference verification.

## Sources

The lecture cites Philip Kiely's *Inference Engineering* (Baseten Books, 2026) by section and printed page. Obtain the book from [Baseten](https://www.baseten.co/inference-engineering/); the PDF is not redistributed here. Ollama behavior follows its [API](https://docs.ollama.com/api/generate), [concurrency configuration](https://docs.ollama.com/faq), and [running-model metadata](https://docs.ollama.com/api/ps).
