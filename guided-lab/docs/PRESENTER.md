# Presenter guide

## The intent

Students should leave believing the infrastructure under an AI product is something they can understand and work on. The way in is the customer's work:

work → what makes the result useful → shape and demand → measurable objectives and promises → engineering choices → measurement under representative load → did the useful work meet the promise, the quality floor and the cost limit?

In the lab they do this for real: read a promise, run the workload on their own hardware, change a lever, run again, compare. Token mechanics come up only to explain a result.

## Words to keep straight

- **SLI** is a measurement. **SLO** is a target for it over a defined window. **SLA** is an agreement with commitments and consequences.
- Not every objective is contractual. Contracts do not necessarily promise model correctness or every latency number.
- A faster model server alone does not keep an SLA.
- **Application levers** change what the product asks for: prompt, validation, output format, client workers. **Serving levers** change how the model is run: processor, serving slots. **Demand** is what arrives.
- **Client workers** are how many requests your code sends at once. **Serving slots** are how many the server works on at once. They are different numbers and the lab shows both.

Every promise in the lab is hypothetical. Say so when one is on screen.

## Before the session

1. `ollama list` shows `qwen2.5:1.5b`. Nothing can be downloaded at the venue.
2. From the kit folder: `python3 tools/serve.py --open`, then **Setup → Run setup check**.
3. Run each lab's baseline once so you have seen your own numbers.
4. In any lab, under "Choose your settings", press **4 slots** next to "Start another model server owned by this lab". Confirm the lab reports "serving 4+ at once". Your normal Ollama server is not touched.
5. **Setup → Reset everything** so the room sees a clean page.

## Running a lab (about ten minutes each)

1. Read the top card aloud: the work, what makes it useful, the promise.
2. "Know the systems": A, B and C are one model in three serving setups. Press **Observe this laptop's serving setup** and read out what yours is.
3. Everyone predicts and locks in.
4. Everyone presses **Run the baseline**. A standard run takes a few minutes; the counter shows progress. Talk through the first discussion question while it runs.
5. Change one lever and run again. Two columns appear side by side.
6. **Reveal recorded systems** and read "Which system keeps which promise".
7. Discuss.

If time is short, have the room choose 40 samples instead of 100. Anything under 20 gives no p95 verdict, by design.

## What to draw out

**Lab 1.** Three kinds of work need three measurements. The agent is the lesson: open the trace table and the transcript. With the baseline prompt this small model usually looks up free slots and then says the meeting is booked without booking it. The calendar says otherwise. That is an application failure; no serving lever fixes it. Have someone switch to the step-by-step prompt and compare the "really booked" row.

**Lab 2.** One user passes almost anywhere. Have half the room run 1 user and half run 4. Then compare the recorded A and B columns: one slot makes later arrivals wait; four slots start everyone at once and slow everyone down. Good for chat, bad for a completion.

**Lab 3.** More client workers than serving slots buys nothing. With slots to spare the batch gets faster and cheaper per correct notice. The chat user on the same server pays for it. Ask: one deployment or two?

A student's laptop missing a promise is a finding, not a fault. The choices are to change the system or change the promise.

## Honest delivery

- Recorded columns are your laptop, earlier, under other load. Say "recorded".
- A run of 100 requests is a bounded experiment. It does not prove a monthly promise.
- The quality checks are exact but simple. They are not a model evaluation.
- The agent result describes this model with these prompts.
- Do not describe any named company's traffic or contracts.

## Fallbacks

| Situation | Move |
|---|---|
| A laptop has no model or no Ollama | Open `lab/index.html` as a file, choose **Recorded data**. Same predictions, recorded runs |
| A run is too slow | Stop it, choose 40 samples, run again. A stopped run keeps nothing |
| "Start another model server" fails | It needs `ollama` on PATH and the page from `tools/serve.py`. Compare with recorded system B instead |
| CPU only was chosen and the laptop is stuck slow | Switch Processor back to "server default" and run: the lab reloads the model and reports where it landed |
| The page looks wrong after an update | **Reset this exercise** at the top of that lab. Other labs and the worksheet are kept |
| Behind schedule | Do Lab 1 and Lab 2 in full; reveal Lab 3's recorded systems and discuss |

## Controls

| Control | Where | Does |
|---|---|---|
| Run setup check | Setup | Readiness only: origin, server, model, one generation. Not a measurement |
| Observe this laptop's serving setup | each lab, step 1 | Four probe requests; reports processor and requests served at once |
| Levers | each lab, "Choose your settings" | Tagged application, serving or demand |
| Start another model server owned by this lab | same card | A second Ollama process on its own port with 1, 2 or 4 slots |
| Run / Stop | each lab | Standard run with a live count; Stop keeps nothing |
| Run tabs, "make this the baseline", "delete this run" | under the runs table | History of up to six runs per lab |
| Reveal recorded systems | each lab | Matrix of A, B, C beside your baseline and latest run |
| Reset this exercise | top of each lab | Clears that lab only |
| Download my runs | Setup | Every run with settings, observed setup, full outputs, tool calls and results |
| Reset everything | Setup | All labs and the worksheet |
