# Workload control room

Students use a coding agent to set up this repository and a dashboard to operate three local Qwen2.5 1.5B workloads. All scenarios and fees are fictional. Live runs must invoke Ollama and save reproducible configurations and outputs; saved reference runs must never masquerade as live.

Visual thesis: a calm, green-and-ivory lab notebook consistent with the lecture, with a scenario navigator, operational controls and a wide results workspace.
Content: scenario and agreement; controls; live progress; baseline comparison; per-request outputs and traces.
Interaction: immediate form feedback, short progress updates, native details for output inspection, reduced motion respected.

## Acceptance and proof
- Configuration persists: save, reload, inspect JSON and read back UI.
- Serving settings are real: restart only an owned Ollama child, record PID, environment and running-model metadata; CPU/GPU remains an observed property.
- Live work is real: streamed responses and final Ollama timing/token counters accompany every request; fixture tests do not prove live readiness.
- Results compare honestly: immutable per-run config, hashes, workload/sample counts, quality failures, totals and assumed-cost labels; baseline comparison warns on changed work size.
- Model setup: fixed Qwen2.5 1.5B download, localhost only, no cloud keys, no changes to a user's normal Ollama process.
- Accessibility: native forms/labels, status announcements, keyboard operation/focus, contrast, 44px controls, responsive reflow, reduced motion.
- Publication: sanitized current deck, dashboard and reference lab; no book PDF, local chat history, credentials, models or private run state.
- Rehearsal: clone GitHub, start from README, operate all three exercises, compare settings and saved runs, inspect output failures and browser errors.
