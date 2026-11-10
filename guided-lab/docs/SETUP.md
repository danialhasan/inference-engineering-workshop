# Setup

## The stack

| Piece | Role | Licence |
|---|---|---|
| [Ollama](https://ollama.com/download) | Local model server with an HTTP API on `127.0.0.1:11434` | MIT |
| `qwen2.5:1.5b` | A 1.5-billion-parameter chat model, 4-bit quantised (Q4_K_M) | Apache 2.0 |
| This kit | Static web pages plus small scripts. No packages to install | — |

The lab page runs in your browser and sends requests to Ollama on your own machine. It contacts nothing else. A page server from the kit (`start.sh`, `start.command` or `start.bat`) is needed for live runs because Ollama rejects browser requests that come from a page opened as a file (it answers HTTP 403; this was tested). The page server needs Python 3 or Node 18+, whichever you have.

**No GPU is required.** On Apple-silicon Macs Ollama uses the built-in GPU automatically. On other machines it uses a supported GPU if it finds one and the CPU otherwise. The labs are sized so that a CPU-only laptop finishes each one in a minute or two.

## Sizes and requirements

"Tested" means measured or observed by the author on 10 November 2026. "Estimate" means a planning figure that was not verified.

| Item | Figure | Basis |
|---|---|---|
| Ollama download, macOS (`Ollama.dmg`) | 230 MB | Tested: size reported by the official download link (release 0.40.16) |
| Ollama download, Windows (`OllamaSetup.exe`) | 1.86 GB | Tested: size reported by the official download link |
| Ollama download, Linux x86-64 (`ollama-linux-amd64.tar.zst`) | 1.55 GB | Tested: size reported by the official download link |
| Ollama download, Linux arm64 | 1.60 GB | Tested: size reported by the official download link |
| Model download and disk use | 986 MB | Tested: pulled from the Ollama registry |
| Memory held while the model is loaded | 1.17 GB (GPU), 1.36 GB (CPU only), 1.59 GB (four request slots) | Tested: as reported by Ollama on the reference Mac with a 4,096-token context |
| This kit | under 1 MB zipped | Tested |
| Free disk to plan for | 3 GB on macOS, 6 GB on Windows or Linux | Estimate: installer plus installed files plus model |
| System memory | 8 GB or more | Estimate. Only a 16 GB Mac was tested. 4 GB machines may work with other apps closed; nobody checked |
| Time to prepare | about 10 minutes on a fast connection | Estimate |
| One standard run of one lab | a few minutes. On the reference Mac, while it was busy with other work, the three standard runs took about 3, 1.5 and 2 minutes | Tested (busy machine) |
| Battery cost of the hour | small next to screen and browser use | Estimate, not measured |

Operating systems, from Ollama's own documentation (read 10 November 2026, not verified by the author on real machines):

- macOS 14 Sonoma or newer. Apple silicon gets CPU and GPU; Intel Macs are CPU only.
- Windows 10 22H2 or newer.
- Linux: a recent x86-64 or arm64 distribution.

Browsers: the lab uses only standard features (fetch streaming, SVG). It was tested in Chrome 157 on macOS. Current Firefox, Safari and Edge should work and were not tested.

## Prepare (with a good connection)

1. Install Ollama from <https://ollama.com/download> and start it.
2. In a terminal: `ollama pull qwen2.5:1.5b`
3. Unzip the kit. From the kit folder run the check:
   - macOS or Linux: `sh tools/check.sh`
   - Windows: `powershell -ExecutionPolicy Bypass -File tools\check.ps1` (untested by the author)
4. Start the page server (`start.command`, `sh start.sh` or `start.bat`), open the address it prints, go to **Setup**, press **Run setup check**. Four green ticks means the live path works end to end.
5. Switch Wi-Fi off and repeat step 4. This is the real test, because the venue network will not help you.

What a good terminal check looks like:

```
4. A short generation
  [ok]   32 tokens at 99 tokens per second, measured on this laptop just now
...
READY for the live path.
```

Your tokens-per-second figure will differ. Anything above about 5 is enough for the labs.

## Troubleshooting

| What you see | What to do |
|---|---|
| Setup tab says the page was "opened as a file" | Start the page server and use the `http://127.0.0.1:…` address it prints. Recorded data works from the file as it is |
| "No answer" from the server | Start Ollama: open the app, or run `ollama serve`. If you run Ollama on another port, type its address into the Setup tab |
| Model "is not installed" | `ollama pull qwen2.5:1.5b`. It is a 986 MB download, so do it before the event |
| `start.sh` says neither python3 nor node was found | Install either one, or use recorded data |
| macOS will not open `start.command` | Open Terminal, `cd` to the kit folder, run `sh start.sh` |
| The port is busy | The page server tries the next 29 ports and prints the one it used |
| The first run is slow | The first request loads the model. Each lab sends a warm-up request before it measures |
| The laptop is very slow or runs out of memory | Close other apps. If a lab takes more than three minutes, press Stop and reveal the recording for that lab |

## For the presenter: helping people who arrive unprepared

The intended answer is the recorded path. It needs nothing.

If you want to offer more, a USB stick can carry the installers and the model. Copying Ollama's model folder to another model folder and serving from the copy was tested on the reference Mac (the copy listed and ran the model). The folder is `~/.ollama/models` on macOS and Linux and `%USERPROFILE%\.ollama\models` on Windows by default. Copying between different operating systems was not tested. Budget two minutes per person at most, then move them to recorded data.

## Record your own machine as a system

After the workshop, you can add your laptop as a recorded system:

```
node tools/capture.mjs --id sys-mine --name "My laptop"
```

This plays every lab's workload at the standard sample size and writes `lab/data/recorded/my-laptop.json`, then rebuilds `lab/data/recorded.js`. Your laptop then appears as another system beside A, B and C.
