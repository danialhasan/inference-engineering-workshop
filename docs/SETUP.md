# Prepare your laptop

Bring a charged laptop, a text editor, and this repository downloaded before the
event. Internet is needed to acquire software and the model, but not for the
prepared exercises or deck. No sign-in or API key is required for the local model.

## macOS

1. Install Python 3.10 or later from <https://www.python.org/downloads/macos/> if
   `python3 --version` is absent or older. Install Git from
   <https://git-scm.com/downloads/mac> only if you want to clone rather than unzip.
2. Acquire and open your copy using the README. Run `python3 workshop.py doctor`.
3. For live work, install Ollama from <https://ollama.com/download/mac> and open the
   app. In Terminal, run `ollama pull qwen3:0.6b` and wait for success.
4. Run `python3 workshop.py doctor --source live`, then
   `python3 workshop.py run 0 --source live --repeat 1`.

## Windows

1. Install Python 3.10 or later from <https://www.python.org/downloads/windows/>,
   including its Python launcher. Open a new PowerShell window and verify
   `py -3 --version`. Git is optional: <https://git-scm.com/downloads/win>.
2. Extract or clone the repo, enter its folder, and run
   `py -3 workshop.py doctor`.
3. Install and open Ollama from <https://ollama.com/download/windows>, then run
   `ollama pull qwen3:0.6b` in a new PowerShell window.
4. Run `py -3 workshop.py doctor --source live`, then
   `py -3 workshop.py run 0 --source live --repeat 1`.

There are no PowerShell scripts to unblock and no execution-policy changes.
Replace `python3` with `py -3` throughout the exercise instructions.

## Linux

1. Install Python 3.10+ (and optionally Git) using your distribution's package
   manager. Verify `python3 --version`; supported versions vary by distribution.
2. Acquire the repo and run `python3 workshop.py doctor`.
3. Follow the official Ollama Linux instructions at
   <https://docs.ollama.com/linux>. Start its service according to those instructions;
   if running manually, keep `ollama serve` open in another terminal.
4. Run `ollama pull qwen3:0.6b`, `python3 workshop.py doctor --source live`, then
   `python3 workshop.py run 0 --source live --repeat 1`.

## Know when you are ready

Recorded readiness is a passing doctor plus an Exercise 0 JSON file you can open.
Live readiness additionally requires visible text and a saved JSON whose `source`
is `live`. The live doctor makes a short request; merely finding an installed model
does not prove that generation works. After installation, these commands use only
127.0.0.1 and never a cloud endpoint. No model downloads happen automatically.

The workshop fixes the model, prompt, temperature, seed and context size. It warms
the model before each measured group. Loading may still contribute to real runs;
the file preserves load time and other server counters. Do not change your server
parallelism midway through the comparison. Client concurrency and server capacity
are different controls, and this workshop changes only the former.

## Recover without losing the session

| Symptom | Action |
|---|---|
| Python not found | Reopen the terminal after installing; verify the OS-specific command above. |
| `workshop.py` not found | Enter the extracted/cloned repo folder; check that README.md is beside workshop.py. |
| Connection refused | Open Ollama, or start `ollama serve` in another terminal if no service is running. Retry the live doctor. |
| Port already in use | An Ollama service may already be running; test the doctor instead of starting a second one. Do not kill unrelated services. |
| Model missing | Run `ollama pull qwen3:0.6b` before the event, or use recorded mode now. |
| Ollama uses another local port | Append `--port NUMBER` to every live doctor/run command. Remote host URLs are intentionally unsupported. |
| Request fails or laptop struggles | Re-run explicitly with `--source recorded`; failures never become measurements or silent fallback results. |
| Check fails before editing | This is expected for the starters. Follow the hint and corresponding exercise. |
| Accidental edit or stuck | Use `--solution` to continue; compare files without overwriting your work. |
| Output filename exists | Omit `--output` for a unique name or choose a new path. Existing results are never overwritten. |
| Need to stop a live group | Press Ctrl+C. Running requests may finish on Ollama; no partial group is saved as completed. |

If you use an editor's Run button, confirm it uses the same Python as your terminal.
These instructions include Windows and Linux paths, but native execution on those
platforms has not been verified in this release; see VERIFICATION.md.

Official references checked 2026-11-10: [Ollama quickstart](https://docs.ollama.com/quickstart),
[generation API](https://docs.ollama.com/api/generate), and
[model package](https://ollama.com/library/qwen3:0.6b).
