# What happens after your agent calls the model?

A one-hour, code-editing inference workshop. Make one controlled change, inspect
the generated text and measurements, and decide whether it helps your use case.

Start with **Python 3.10+ and a text editor**. Git is needed only for cloning.
Live exercises additionally need Ollama and the local `qwen3:0.6b` model.
There are no Python packages, API keys, accounts, cloud calls or npm steps.

## 1. Get your own working copy

This release includes a Git bundle and an attendee ZIP. No public remote has been
configured. Put `inference-workshop.bundle` in your Downloads folder, open a
terminal there, and run:

```sh
git clone inference-workshop.bundle inference-workshop
cd inference-workshop
git switch -c my-workshop
```

If you do not have Git, extract `inference-workshop-attendee.zip`, then open a
terminal in the extracted `inference-workshop` folder. You can edit and run all
exercises without Git. Do not try to execute files from inside the ZIP viewer.

## 2. Prove readiness before installing a model

On **macOS or Linux**, run:

```sh
python3 --version
python3 workshop.py doctor
python3 workshop.py run 0 --source recorded --repeat 1
```

On **Windows PowerShell**, run:

```powershell
py -3 --version
py -3 workshop.py doctor
py -3 workshop.py run 0 --source recorded --repeat 1
```

Success means you see `READY for recorded exercises`, generated text, timing and
token measurements, and a new JSON file in `results/`. These are genuine saved
measurements from another computer, not a benchmark of yours.

All commands below use `python3`; **Windows users substitute `py -3`**. You do not
need a virtual environment because this repo installs nothing. If you use one,
select its Python interpreter in your editor and terminal consistently.

## 3. Choose the live or recorded track

Follow [SETUP.md](docs/SETUP.md) for OS-specific installation and recovery. If you
already have Ollama running, prepare the local model before the event:

```sh
ollama pull qwen3:0.6b
python3 workshop.py doctor --source live
python3 workshop.py run 0 --source live --repeat 1
```

The model download is approximately 523 MB. Allow time and disk space before
arriving; download size is not a RAM requirement. Use recorded mode immediately
if setup is slow or your laptop cannot run the model. Both tracks complete the
same code exercises, but only live mode measures your edited scheduler on your
machine.

## 4. Work through the exercises

Open [EXERCISES.md](docs/EXERCISES.md) beside your editor. Predict each outcome
before running the comparison, and keep notes in [WORKSHEET.md](docs/WORKSHEET.md).

| Exercise | Edit | Run | Check |
|---|---|---|---|
| 0: first request | Read `workshop/runtime.py:generate` | `python3 workshop.py run 0` | Confirm text and saved JSON |
| 1: first visible text | `exercises/ex01_stream.py` | `python3 workshop.py run 1` | `python3 workshop.py check 1` |
| 2: output budget | `exercises/ex02_budget.py` | `python3 workshop.py run 2` | `python3 workshop.py check 2` |
| 3: bounded concurrency | `exercises/ex03_concurrency.py` | `python3 workshop.py run 3` | `python3 workshop.py check 3` |

`run` defaults to recorded mode with two saved repetitions. Add `--source live`
to make new local measurements. The unfinished starters are intentional: checks
1–3 should initially fail with an actionable hint. Reference implementations are
in `solutions/`; add `--solution` to `run` or `check` to use them without changing
your files. Save your own progress with `git add exercises docs/WORKSHEET.md` and
`git commit -m "Complete workshop exercises"` if you use Git.

## Where things live

```text
workshop.py            CLI entry point: doctor, run, check
exercises/            Three small functions for you to edit
solutions/            Reference implementations (never loaded implicitly for your exercise)
workshop/runtime.py   Local HTTP streaming, measurement, historical-data loading
workshop/checks.py    Offline behavior checks with useful failure messages
data/                Real saved runs, machine/settings provenance and integrity hash
results/             Your generated JSON, excluded from Git
docs/                Setup, exercises, worksheet, instructor guide and verification
slides/index.html    Offline teaching deck with exact file and command references
tests/               Runtime regressions and fresh-clone rehearsal
```

Open `slides/index.html` in a browser, or serve only the slides directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory slides
```

Then visit <http://127.0.0.1:8000/>. Use arrow keys to move through the deck and
press `S` for speaker notes. The [instructor guide](docs/INSTRUCTOR.md) maps the
60-minute session to the commands. The previous A/B comparison is separate and
its identities are not part of this repo.

## Verification and limits

Run `python3 -m unittest discover -s tests -v` for runtime checks, then
`python3 workshop.py check all --solution` for reference answers. To rehearse from
a committed fresh clone, run `python3 tests/rehearse.py`; add `--live --port 11434`
to include the local model. See [VERIFICATION.md](docs/VERIFICATION.md) for the
actual platform, commands, revision and limitations of the release rehearsal.

The sample model is for studying inference behavior, not a quality recommendation.
Two repetitions demonstrate variation but do not establish statistical significance.
Inspect actual output length and completeness before calling a result better.
The measurement contract and sources are in [EXERCISES.md](docs/EXERCISES.md).
