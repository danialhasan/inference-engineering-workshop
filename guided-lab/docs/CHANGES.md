# What changed from the first kit, and why

The first kit (`kit/`, archive `inference-workshop-kit.zip`) is preserved unchanged. This kit (`kit-workload-first/`, archive `inference-workshop-kit-workload-first.zip`) is a rebuild to a corrected teaching intent.

## The correction

The first kit taught inference from the inside out. It opened with "one request, three phases" (load, prefill, decode) and ran three experiments on token mechanics: output length, prompt-prefix reuse and fan-out. Agent-design decisions were attached at the end of each.

The corrected intent is the reverse order. Students should come to see the infrastructure as something they can understand and work on, and the teaching should run:

> customer's work → what makes the result useful → workload shape and demand → measurable objectives and contractual promises → engineering choices → measurement under representative load → whether the useful work met the promise, the quality floor and the cost limit

Token mechanics appear only where they explain a measured constraint or a fix.

## What is different

| | First kit | This kit |
|---|---|---|
| Opening | The anatomy of one request | Two jobs (applied AI, inference engineering), then "It's all about the workload" and the chain |
| Framing source | None | Kiely, *Inference Engineering*, §§1.2, 1.4, 4.5, quoted with printed page numbers; Google SRE book ch. 4 for SLI, SLO, SLA |
| Promises | Not covered | A full stop on SLI, SLO and SLA, a hypothetical service schedule, what contracts leave out, the four parts of a latency target, and who else keeps the promise |
| Unit of each lab | A mechanism (tokens, cache, fan-out) | A piece of customer work with a hypothetical promise |
| What students predict | How a number will move | Which system fits a stated workload and promise |
| What a result looks like | A chart of timings | A scorecard: each promise met or missed, with the measurement, the target and the sample size |
| Quality | Stated as out of scope | Measured beside speed in every lab, as its own promise. In Lab 1 the agent is fast and does not do the task |
| Load | One request at a time, plus a four-request burst | One, two and four concurrent users; percentile targets; end-to-end wait separated from server time |
| Cost | Not covered | Cost per correct result in Lab 3, at a stated hypothetical machine price |
| Systems compared | One server, with a second profile for reference | Three systems (A, B, C) as explicit choices, plus the attendee's laptop as a fourth |
| Mechanics | The subject | A "why did it behave that way" fold-out after each result, and one detail slide per lab |
| Closing exercise | Decision clinic on three agent scenarios, with a latency calculator | "Your promise": a worksheet that walks the attendee's own project down the chain |
| Audience projects | Not used | A slide mapping the room's projects to kinds of workload, with model uses labelled as proposals |
| Papers | Five minutes on four mechanisms | Four minutes on which promise each paper helps keep; optional |

## What was reused

- The request transport (`lab/core.js`), chart code, deck engine, page servers, start scripts and setup checks, with small changes.
- The setup, sizes and requirements, which did not change.
- The same four papers and their verified abstract figures, reframed.

## What was not reused

- **No measurement from the first kit appears in this one.** The first kit's recordings answer different questions. All three reference systems here were recorded again, for these workloads, on the afternoon of 10 November 2026.
- The first kit's experiments, lab pages, slides and exercise texts.

## Where the first kit is still useful

Its three experiments are the mechanics behind results in this kit: why later agent calls are quicker (prefix reuse), why a long answer takes long (output tokens are written one at a time), and what a multi-slot server does to each request (fan-out). A presenter who is asked "but why?" can open it.

## Live revision (evening of 10 November 2026)

Made in response to feedback while the lab was in use.

- **Systems are named where they are used.** A, B and C are the same Qwen2.5 1.5B on one laptop: GPU with 1 serving slot, GPU with 4, CPU with 1. The names appear in predictions and table headings, and a "Know the systems" step comes before the prediction. The live laptop's processor and serving slots are observed before every run.
- **Standard runs are real measurements.** 100 requests per condition (40 agent tasks), with a visible count and Stop. The earlier four-question runs and their "smoke test" verdicts are gone; too few samples now give no verdict.
- **The agent uses real tools.** Fixed waits and scripted histories were removed. Tools run on a sandbox calendar, results are fed back to the model, and success is read from the calendar under an exact contract.
- **Levers.** Students change prompt, calendar check, users, client workers, JSON-only output, model server, processor and sample size, and rerun. The page server can start extra Ollama processes that the lab owns.
- **History and resets.** Runs are kept side by side with a baseline. One exercise can be reset without touching the others.
- **Corrections.** The live progress display survives re-rendering. "Waiting in line" was renamed, because it was never a pure queue timer. Notice extraction now checks the agency too. Tool calls with empty or wrong arguments are rejected.
- **Targets.** The batch promise is new (100 notices within 30 s; previously 12 within 4 s) and all targets were held fixed for the new reference runs; they came from earlier trials on a quieter machine. Verdicts are not comparable with the earlier recordings, which remain in `kit-workload-first/` and its archive.
