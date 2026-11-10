# Run the 60-minute session

Before the event, distribute the attendee ZIP or Git bundle with README.md and ask
attendees to complete the recorded doctor and Exercise 0, then optionally prepare
Ollama. Test the projector and have the saved results and deck on the presenting
machine. Do not spend the opening block troubleshooting everyone's installation;
move an affected attendee to recorded mode and continue the same code exercise.

| Minutes | Slide | Teaching action | Participant checkpoint |
|---|---|---|---|
| 0–5 | 1–2 | Ask what faster means, then verify setup | Doctor passes, editor open |
| 5–13 | 3 | Trace one request and inspect saved JSON | Exercise 0 provenance and response |
| 13–23 | 4 | Explain streaming just before editing | Exercise 1 first-text check passes |
| 23–33 | 5 | Ask for a prediction, then change one cap | Exercise 2 check and quality judgment |
| 33–45 | 6 | Separate client concurrency from server capacity | Exercise 3 check and group comparison |
| 45–50 | 7 | Apply the metrics to an attendee's agent | One evidence-backed recommendation |
| 50–55 | 8 | Compare two research interventions | Resource, mechanism, required measurement |
| 55–60 | 9 | Discuss limits and capture the next experiment | Worksheet and handoff |

Use `python3 workshop.py run N --solution` for a demonstration without changing a
participant's files. The default is recorded data; deliberately add `--source live`
when demonstrating new inference. Tell the room which source is in use.

Before teaching, run `python3 tests/rehearse.py --live` on the presenting machine.
It clones the committed repository into a new temporary directory and exercises
the documented flow, including copying solutions into the fresh clone as stand-ins
for completed attendee edits. It leaves the original working tree untouched.

The previous A/B slide decks remain separate comparison artifacts. This deck is
the command-linked teaching companion for this repository and makes no claim
about the identity or superiority of either candidate.
