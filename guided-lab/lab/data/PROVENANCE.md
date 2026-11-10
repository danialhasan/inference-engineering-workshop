# Provenance of the recorded systems

The files in `recorded/` contain actual local inference runs of the revised workload code. `recorded.js` packages those records as a classic script so recorded mode can load them without a fetch request or an internet connection. The current reference capture uses the same Qwen2.5 1.5B model on one M2 Pro laptop with 16 GB of memory, configured as A (GPU, one slot), B (GPU, four slots) and C (CPU, one slot). Each file records its actual capture timestamp, sample count, request options, runtime observation and hardware metadata.

The revised calendar workload executes real sandbox tools only in response to emitted model calls. It has no artificial tool delays and does not invent missing calls or successful histories. The model's claim of completion is checked against the resulting calendar and executed call sequence. Invalid calls, missing events and step-limit failures remain failures. The files under `evidence/` retain complete real model/tool transcripts and final sandbox stores, including unsuccessful tasks.

These recordings replace the earlier reference set for the active guided lab. The older lab remains separately available under the repository's `reference/` directory; its historical agent timings included simulated waits and must not be treated as validation of this revised final-state contract.

## What the numbers support

The captures ran on 10 November 2026 while development and independent verification also used the laptop. They are genuine measured observations under shared host load, not controlled idle-machine benchmarks. Differences may include contention and load variation as well as the selected serving configuration. The model and recorded hardware are the same; the current attendee's laptop is a different system.

The GPU references use 100 observations per primary measured condition. The CPU reference uses a smaller, explicitly recorded sample count to keep capture practical. Lab 1's agent-task count is 40% of the selected request count, with a minimum of 10. Lab 3's shared-chat probe count depends on how long its batch takes. The interface reports the actual count and withholds a percentile verdict when it has too few observations.

The fictional objectives were created for teaching after earlier trial runs and were held fixed for these new captures. A finite workshop sample does not establish a monthly SLA. Machine cost uses a hypothetical rate of $1.20 per hour; it is not a measured electricity or cloud bill.

The quantity labelled outside prompt reading is client first-token latency minus server prompt-evaluation time. It includes transport, loading and first-token overhead as well as possible queueing; it is not a directly measured queue timer.

## Validation and export

The integrated evaluator requires the requested normalized event title, exact intended participant and duration, a matching prior free-slot lookup and its first returned slot. It checks every promised extraction field. Live exports retain each task's complete final sandbox in addition to its calls, transcript and created-event summary. Recorded model responses and measured durations are not edited to manufacture a pass. A and B were captured just before the final title check was tightened from substring matching to normalized equality. Independent replay of all 80 recorded agent tasks under the final evaluator preserved every outcome; the recorded durations were not changed.

See the repository's verification report for the exact checks performed and remaining platform limits. Windows and Linux instructions do not imply that native inference was executed on those systems.
