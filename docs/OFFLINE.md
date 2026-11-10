# Run the workshop without venue Wi-Fi

The guided lab loads its scripts, styles and recorded results from this repository. Live experiments call a local Ollama server. After Python, Ollama and Qwen2.5 1.5B are installed, the lab does not need an internet connection. Do not depend on venue Wi-Fi to download the model. Your coding agent may still require internet access. Finish its setup assistance before losing the connection; the browser controls, local-model calendar exercise and recorded fallback can then be used without a cloud coding agent.

## Prepare while you have a reliable connection

1. Download or clone the complete repository, including `guided-lab/lab/data/`.
2. Install Python 3 and Ollama for your operating system. Node is needed only for the development checks and recording tools, not for Python-based workshop startup.
3. Run `ollama list`. If `qwen2.5:1.5b` is already present, reuse it. Otherwise download it once with `ollama pull qwen2.5:1.5b`; the model is about 986 MB. Do not repeat this download on phone data when a prepared cache is available.
4. Start the guided lab from the repository root:

   ```sh
   python3 guided-lab/tools/serve.py 8878
   ```

   On Windows PowerShell:

   ```powershell
   py -3 guided-lab/tools/serve.py 8878
   ```

5. Open the local URL printed by the server, normally `http://127.0.0.1:8878/lab/index.html`. Run the Setup check and inspect the real response and timing. Keep the prepared tab, terminal and Ollama running. If your coding agent gave you a URL with `?base=`, keep that complete URL; it selects your prepared private model server.

If your model cache is stored in a custom directory, set `OLLAMA_MODELS` for the workshop server process before starting it. Its owned Ollama children inherit that setting. Use the existing directory; do not move or delete another application's cache.

## If live inference is unavailable

Choose **Recorded data** on Setup. The included results were captured from real local model runs and are labelled recorded; they do not measure the current laptop. You can make predictions, inspect the three systems and complete the worksheet without a model server.

You can also open `guided-lab/lab/index.html` directly from disk for the recorded path. Keep the adjacent JavaScript, stylesheet and data files together. A standalone copy of that HTML file does not contain the whole lab.

## Portable ZIP

The workshop ZIP includes source, local assets, recorded data, startup scripts and documentation. It excludes model weights, personal state, runtime logs, credentials and Git history. Extract it before starting the lab. The ZIP alone does not replace the model preparation required for live inference.

Keep the original recorded results distinct from new live runs. Slow hardware, a failed quality check or a missed time target can be a valid workshop result; a transport error, missing model or missing recorded-data file is a readiness issue.

## Lecture backup

Open [the self-contained lecture](../offline/inference-workshop-offline.html) or [the PDF](../offline/inference-workshop.pdf) in a PDF viewer. The lab’s Slides link also opens a local copy of the self-contained HTML. These copies do not require the model runtime or an internet connection. The PDF provides a separate backup if browser controls are unavailable.
