# Dashboard UI robustness — November 10, 2026

Fuzzing used an isolated instance on 8877, a separate model-server port, and copies of existing run records. The user's 8876 state was preserved.

## Fixed defects

- Unknown URL fragments could crash initialization; invalid fragments now recover to a valid exercise.
- Skip navigation could change the selected exercise; it now targets the main region without changing the route.
- Run bypassed native number validation; required fields and range errors now prevent invalid submissions.
- Controls were usable before saved settings loaded; they now wait for initialization.
- Rapid actions could race the separate save/start requests; the server now saves and starts atomically and the UI locks pending actions immediately.
- Action errors disappeared on the next poll; a dedicated alert keeps them visible until the next action or input.
- Polling could collapse an expanded output; open details and focus are retained.
- Saved-run metrics could be confused with current form settings; each result now states its own configuration, and controls are labeled for the next run.
- Timestamps used UTC without saying so; history now uses the viewer's local date and time.
- Cancelled partial runs could show pass indicators; they are labeled incomplete and cannot become a baseline.
- Cancellation during preparation could proceed to workload execution; cancelled preparation now skips requests.
- Malformed API input could close the connection; validation now returns a readable error.
- A failed configuration write could change only in-memory settings; accepted settings now change only after persistence succeeds.
- One corrupt run could hide all history; it is skipped with a warning and the original file remains intact.
- The export and baseline lookup were limited to 40 runs; exports include all valid runs and pinned older baselines remain available.
- Returning shared mutable state could create inconsistent responses during worker updates; state is now snapshotted under the lock.

## Verification

- Twelve repeated configuration-save/switch cycles, including reloads, retained exact selected values.
- Invalid count zero was blocked before a run; corrected count four persisted after reload.
- Rapid double click launched one live four-document run.
- Expanded output remained open after changing the baseline.
- A 24-job live run was cancelled after one result; 23 jobs were skipped, verdicts showed incomplete, and baseline selection was disabled.
- Unit/API checks cover invalid JSON shapes/scenarios, corrupt state, persistence failures, cancellation during preparation, full-history export and detached snapshots.
- Browser checks use the real backend; unit fixtures are not claimed as live-model evidence.

This is a bounded robustness pass, not a guarantee that no undiscovered defect exists. Live hardware verification remains on macOS; CI checks cover Windows, Linux and macOS.
