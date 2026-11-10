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

## Completed rehearsal — 2026-11-10

Implementation revision `0fb862ba778ee7f81a909bdbb3136fd6e8767669` passed the
26-step fresh-clone rehearsal with real local inference. The release adds this
verification record after that run; runtime, exercises, solutions, data and test
code are unchanged from the tested implementation.

- Eight runtime regression tests passed, including missing/duplicate/reordered
  scheduler results, partial streams, failed groups and recording integrity.
- The clone started with unmodified starter files. Checks 1, 2 and 3 failed as
  expected; all reference checks passed. Copying reference implementations into
  the clone simulated completed attendee edits, after which all participant
  checkpoints passed.
- Exercise 0 and all three completed exercises ran in recorded mode and live mode,
  including two repetitions per setting and both concurrency limits.
- Thirteen saved JSON files were parsed and checked for source labels, request IDs
  and token totals. A deliberate unavailable-server run produced no completed file.
- A deliberately reused output filename failed and preserved the original bytes.
- The independent reviewer confirmed the duplicate-result repair with the original
  live counterexample, and a valid four-worker group still passed.
- The teaching deck loaded in the in-app browser; next-slide navigation and the
  setup/request walkthrough were inspected, with no browser console errors.

This establishes the fresh-checkout flow on the verified Mac. It does not establish
native Windows/Linux compatibility, installer behavior on a clean OS, or performance
on another attendee's hardware. No hosted repository or public deployment was made.
