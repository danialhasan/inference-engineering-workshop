# Setup instructions for a coding agent

You are preparing a laptop for the guided lab before the lecture. Do these steps in order and report the result of step 5. Do not download anything during the lecture itself: the venue network is unreliable.

## Rules

- Never stop, restart or reconfigure an Ollama server that is already running. The lab can start its own extra server on a separate port when it needs one.
- Do not edit files under `lab/data/`.
- If a step fails and cannot be fixed without a download, stop and tell the user to use recorded mode (step 6).

## Steps

1. **Check for Ollama.** Run `ollama --version`. If it is missing and the network is good, install it from <https://ollama.com/download> (macOS 14+, Windows 10 22H2+, or Linux). If the network is bad, go to step 6.
2. **Make sure a server is running.** Request `http://127.0.0.1:11434/api/version`. If nothing answers, start one: open the Ollama app, or run `ollama serve` in a terminal you leave open.
3. **Check for the model.** Run `ollama list` and look for `qwen2.5:1.5b`. If it is missing and the network is good, run `ollama pull qwen2.5:1.5b` (986 MB). If the network is bad, go to step 6.
4. **Check for Python 3.** Run `python3 --version` (Windows: `py -3 --version`). Any Python 3.8 or newer works; only the standard library is used.
5. **Run the readiness check** from the kit folder and report its last line.
   - macOS, Linux: `sh tools/check.sh`
   - Windows: `powershell -ExecutionPolicy Bypass -File tools\check.ps1`
   Then run `node tools/selftest.mjs` if Node is installed (optional; it needs no model).
6. **Start the lab.**
   - Live: `python3 tools/serve.py --open` (Windows: `py -3 tools\serve.py --open`), then press **Run setup check** on the Setup tab.
   - Recorded only: open `lab/index.html` in a browser and press **Use recorded data**.

## What to expect

- No GPU is needed. Without one, Ollama runs the model on the CPU and the lab's observation step will say "CPU". Runs take longer; the user can choose 40 samples instead of 100.
- The lab talks only to `127.0.0.1`. Nothing is sent anywhere else.
- "Start another model server owned by this lab" needs the `ollama` command on PATH and the page served by `tools/serve.py`. It starts a second Ollama process on port 11500 or above and stops it when `serve.py` stops.

## Platform status

macOS on Apple silicon was tested end to end. Windows and Linux commands above follow Ollama's documentation and standard Python, and were not executed by the kit's author.
