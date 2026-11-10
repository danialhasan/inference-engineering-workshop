# Rehearsal — November 10, 2026

The workshop was cloned from GitHub at `02980d1` and updated to `a011441` for the Windows trace fix and source manifest. Live measurements used the clone, not the authoring folder. The later frontend-only synchronization change does not alter these model measurements.

## Setup and platform checks

- Python 3.13, Ollama, Qwen2.5 1.5B Q4_K_M on Apple M2 Pro/macOS.
- Existing downloaded model files were reused through OLLAMA_MODELS. A fresh ~986 MB download and fresh OS installation were not repeated.
- The dashboard started on loopback; its separate Ollama child used port 18731. Slot changes produced new owned process IDs and actual loaded-model metadata. Existing model services on ports 18611 and 18612 were preserved.
- CPU-only run: four reports correct, 7.63 seconds; running-model metadata showed zero GPU allocation. Automatic runs showed GPU allocation.
- 16 tests passed locally. GitHub Actions run 42912368830 passed on Windows, Ubuntu and macOS. These are fixture/API checks, not Windows/Linux live-model or hardware tests.

## Live exercise results

These are single short runs on one laptop. Input cases, model and price assumption stayed fixed within each comparison. Natural prompt-cache reuse was enabled; no statistical speedup or monthly service compliance is claimed.

| Experiment | Result |
|---|---|
| Brief field instructions, 12 reports | 0/12 fully correct; 13.23 seconds |
| Explicit field instructions, same 12 reports | 12/12 correct; 11.52 seconds |
| Burst: 1 client / 1 server slot | 12/12 correct; 10.87 seconds; 66.2 correct reports/minute |
| Burst: 4 clients / 1 server slot | 12/12 correct; 11.31 seconds; 63.7 correct reports/minute |
| Burst: 4 clients / 4 server slots | 12/12 correct; 5.14 seconds; 140.0 correct reports/minute |
| Shared: 4 background clients / 4 slots | 12/12 reports and 4/4 chat answers correct; chat first-token worst/p95 3.76 seconds; 0/4 within 1 second |
| Shared: 1 background client / 4 slots | 12/12 reports and 4/4 chat answers correct; chat first-token worst/p95 0.05 seconds; 4/4 within 1 second; batch slower |

The assumed cost per 1,000 correct reports in the burst runs changed from $0.30 to $0.14 at $1.20 per machine-hour. This is a teaching estimate based on whole-run duration, not a measured hosting price or electricity saving.

Machine-readable summaries and exact configurations are in [rehearsal-results.json](rehearsal-results.json). Raw outputs and provider records remain in the presenter's local ignored .workshop directory and can be exported through the dashboard.

## Browser checks

- Used the dashboard to prepare the model, run a baseline, pin it, change field instructions, save, reload, and rerun.
- Verified output inspection, recorded input/expected answer, baseline metrics, observed CPU/GPU placement, and source/configuration manifests.
- Verified exercise navigation with keyboard Enter and form traversal with Tab; native controls expose names and values in the accessibility tree.
- Narrow-layout check at the browser's effective 400 CSS-pixel minimum and desktop check showed no horizontal overflow. 320 pixels could not be forced by this browser surface; that size remains unverified.
- Flat text contrast: ink/paper 12.08:1; muted/paper 5.64:1; green/paper 6.57:1. Control border/paper 3.33:1. Controls have a 44px CSS minimum height. Motion is limited to a 100ms button-color transition and removed for reduced-motion preference.
- No browser console errors during the inspected journeys.

## Limits

The quality checks are intentionally narrow and compare synthetic known fields. They are not general evaluations of model truthfulness. Scenario 3 has only four interactive requests per run. Repeat experiments with representative data before deployment. Hardware, background applications, power mode and cache state affect results.

The dashboard manages batching-related runtime slots; it does not expose kernels, quantization, or prefill/decode disaggregation. Those require other runtimes/deployments, as explained in the lecture.
