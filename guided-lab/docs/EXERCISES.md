# Exercises

Each lab has the same six moves: read the work and its promise, know the systems, predict, choose settings and run, compare, decide.

**Promises are hypothetical.** They came from earlier teaching trials and were held fixed while the reference runs were recorded.

**The systems.** A, B and C are the same model, Qwen2.5 1.5B, on the same MacBook Pro (M2 Pro, 16 GB):

| | Processor | Serving slots (requests worked on at once) |
|---|---|---|
| A | GPU | 1 |
| B | GPU | 4 |
| C | CPU | 1 |

Your laptop is a fourth system. The lab observes its processor and serving slots before every run and prints what it found.

**Sample policy.** A standard run measures 100 requests per condition (40 agent tasks in Lab 1). You can choose 40 or 200. A p95 needs at least 20 samples and a p90 at least 10; below that the lab gives no verdict. A finite run is evidence about this laptop today. It does not prove a monthly promise.

**Method.** Run the defaults first: that is your baseline. Change one lever, run again, and compare the two columns.

The lab's "One reading" fold-outs carry the recorded numbers. They are computed from the recordings in `lab/data/`, so they are not repeated here.

---

## Lab 1 · What counts as done?

**Work.** A support chat, a code completion, and an agent that books a meeting in a calendar.

**Useful means.** Chat: first words quickly. Completion: the whole suggestion. Agent: the right meeting really exists afterwards.

**Promises (hypothetical).** 95% of chat answers start within 1 s. 95% of completions arrive whole within 250 ms, and at least 90% contain the expected code. 90% of agent tasks finish within 3.5 s, and at least 90% end with the right meeting in the calendar.

**How the agent is judged.** The calendar is a sandbox owned by the lab. The model may call `calendar_find_slots`, `calendar_create_event` and `notes_append`. A call runs only if it is valid, the model sees the real result, and the loop stops after six model calls. A task succeeds only if the calendar ends with exactly one new event that has the requested title, the requested person and nobody else, the requested length, and sits in the first free slot returned by a lookup for that person and length. What the model says does not count.

**Levers.** Agent prompt (baseline, or step-by-step with a rule against claiming success). Calendar check before accepting "done" (the application looks at the calendar and asks once more if nothing was booked).

**Discuss.**

1. What does "done" mean to the person waiting in each workload, and which row measures it?
2. The agent can be fast and still not book the meeting. Is the fix a serving lever or an application lever? Try one.
3. Would a faster model server have fixed the agent?

**Hint.** Open "Full transcript of the first task" to see exactly what the model saw and said.

---

## Lab 2 · Does the promise hold under load?

**Work.** The support chat, each question with its own document.

**Promise (hypothetical).** 95% of answers start within 1 s, measured in the browser, with 4 users asking at once. At least 90% contain the fact.

**Levers.** Users asking at once (1, 2, 4, 8). Model server and its serving slots. Processor.

**Discuss.**

1. Run with 1 user, then 4. What did the first result tell you about the second?
2. More serving slots start answers sooner and make each one slower to finish. For which Lab 1 workload is that the wrong trade?
3. You asked for a number of users; the server was observed serving some number at once. What happens to the rest?

**Hint.** "Outside prompt reading" is the wait for the first words minus the server's own time reading the prompt. When the server is busy it is mostly time in line. It also contains transport and the first token, so treat it as an upper bound on queueing, not a queue timer.

---

## Lab 3 · Two workloads, one server?

**Work.** Extract reference, agency and closing date from a batch of fictional tender notices. A proposed model use for a contract scraper.

**Promises (hypothetical).** 100 notices within 30 s. At least 90% with all three fields correct. At most $0.12 per 1,000 correct notices at $1.20 per machine-hour. The chat promise still holds for a chat user on the same server.

**Levers.** Client workers (1, 2, 4, 8). Chat user sharing or not. JSON-only output. Model server and its serving slots. Processor.

**Discuss.**

1. Client workers are your setting; serving slots are the server's. What happened with more workers than slots?
2. Wrong notices are paid for and deliver nothing. Which lever changed how many were right?
3. One server or two for the batch and the chat user? What volumes and prices would decide?

**Hint.** Cost per 1,000 correct = batch seconds × machine price ÷ correct notices × 1,000.

---

## Your promise

Open the **Your promise** tab and walk your own project down the chain: the work, what makes the result useful, shape and demand, the measurement (SLI), the target (SLO), the promise and its consequence (SLA) if any, who else is on the hook, and what you would measure first. Swap with a neighbour and look for the missing piece.

## Resets

"Reset this exercise" at the top of a lab clears that lab's prediction and runs only. "Reset everything" on the Setup tab clears all three labs and the worksheet. "Download my runs" on the Setup tab saves every run with its settings, observed serving setup, full model outputs, executed tool calls and results.
