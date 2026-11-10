# Release verification

The automated rehearsal clones committed HEAD into a temporary directory, checks
starter failures and reference answers, applies completed edits, exercises the
recorded track and optional live track, checks saved JSON and verifies that failures
and existing output files are handled correctly. Run it with:

```sh
python3 tests/rehearse.py --live --port 11434
```

This release is being verified on macOS with Python 3.15.2 and local Ollama 0.40.11,
qwen3:0.6b on an Apple M2 Pro. The local rehearsal uses port 11435 to avoid changing
other services. Native Windows/Linux execution, minimum Python 3.10 execution,
and a completely new machine's installer experience have not been tested.

A fresh Git clone is distinct from a factory-clean operating system. The model
was already downloaded; installer/download instructions are linked to official
sources and have not been rehearsed on all listed operating systems.

Independent review exercised live concurrency, stream failures, loopback routing
and saved-run accounting. Its duplicate-result finding was fixed by validating
request IDs and covered with a regression test. The maintained runtime suite
contains eight tests. Release-specific results are appended after rehearsal.
