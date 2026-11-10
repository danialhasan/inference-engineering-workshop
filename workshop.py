#!/usr/bin/env python3
"""Run from any directory: python /path/to/workshop.py --help."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import urllib.error

from workshop import runtime
from workshop.checks import check, load


def sequential(jobs, workers):
    return [job() for job in jobs]


def doctor(args):
    if sys.version_info < (3, 10):
        raise ValueError("Python 3.10 or later is required.")
    provenance = json.loads((runtime.ROOT / "data/provenance.json").read_text())
    digest = hashlib.sha256((runtime.ROOT / "data/runs.json").read_bytes()).hexdigest()
    if digest != provenance["runs_sha256"]:
        raise ValueError("Saved-run integrity check failed; get a fresh copy of data/runs.json.")
    runtime.recorded(32, 1, 1, 0)
    directory = runtime.ROOT / "results"
    directory.mkdir(exist_ok=True)
    import tempfile
    with tempfile.TemporaryFile(dir=directory) as probe:
        probe.write(b"ready")
    print(f"PASS Python {sys.version.split()[0]}; saved data verified; results folder writable.")
    if args.source == "live":
        info = runtime.status(args.port)
        result = runtime.generate(args.port, 8, prompt="Say hello in one word.")
        print(f"PASS local model {runtime.MODEL}; Ollama {info['ollama_version']}; generated {result['output_tokens']} tokens.")
    else:
        print("READY for recorded exercises; Ollama is not required.")


def run(args):
    schedule, measure = sequential, load(1, True).measure
    if args.exercise == 1:
        measure = load(1, args.solution).measure
    caps = load(2, args.solution).output_caps() if args.exercise == 2 else [32]
    if not caps or any(type(cap) is not int or cap not in (32, 96) for cap in caps) or len(caps) > 2:
        raise ValueError("Use one or two output caps selected from 32 and 96.")
    workers_list = [1, 4] if args.exercise == 3 else [1]
    if args.exercise == 3:
        schedule = load(3, args.solution).schedule
    count = 4 if args.exercise == 3 else 1
    print(f"SOURCE: {args.source.upper()} | Exercise {args.exercise} | {'solution' if args.solution else 'participant code'}")
    if args.source == "recorded":
        print("Historical measurements from data/provenance.json; these are not your laptop's speed.")
        if args.exercise == 3:
            print("Saved groups bypass your scheduler. Run 'check 3' to verify your code; use live mode to measure it.")
    runs = []
    for cap in caps:
        for workers in workers_list:
            for repeat in range(args.repeat):
                print(f"\ncap={cap}, requests={count}, requested concurrency={workers}, repetition={repeat + 1}")
                stream = (lambda text: print(text, end="", flush=True)) if count == 1 else None
                result = (runtime.recorded(cap, count, workers, repeat) if args.source == "recorded"
                          else runtime.live(args.port, cap, count, workers, schedule, stream))
                print()
                for request in result["requests"]:
                    if args.source == "recorded" or count > 1:
                        print(request["text"])
                derived = [measure(request) for request in result["requests"]]
                result["participant_metrics"] = derived
                for i, metrics in enumerate(derived, 1):
                    first = metrics["first_text_ms"]
                    first_label = "unfinished (edit ex01_stream.py)" if first is None else f"{first:.2f} ms"
                    print(f"Request {i}: first text {first_label}; finish {metrics['wall_ms']:.2f} ms; {metrics['output_tokens']} tokens")
                print(f"Group: {result['group_ms']:.2f} ms; {result['throughput_tokens_s']:.2f} output tokens/s")
                runs.append(result)
    output = args.output or runtime.ROOT / "results" / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + f"-ex{args.exercise}-{args.source}.json")
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    # Never overwrite an attendee's earlier observations.
    with output.open("x", encoding="utf-8") as file:
        json.dump({"exercise": args.exercise, "implementation": "solution" if args.solution else "participant",
                   "source": args.source, "runs": runs}, file, indent=2)
        file.write("\n")
    print(f"\nSaved {output.resolve()}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    def source_options(p):
        p.add_argument("--source", choices=("recorded", "live"), default="recorded")
        p.add_argument("--port", type=int, default=11434, help="Local Ollama port (default: 11434)")
    doctor_parser = sub.add_parser("doctor", help="Check Python, data, output folder and optional local model")
    source_options(doctor_parser)
    run_parser = sub.add_parser("run", help="Run an exercise and save JSON measurements")
    run_parser.add_argument("exercise", type=int, choices=range(4))
    source_options(run_parser)
    run_parser.add_argument("--solution", action="store_true")
    run_parser.add_argument("--repeat", type=int, choices=(1, 2), default=2)
    run_parser.add_argument("--output", type=Path, help="New JSON file; an existing file is never overwritten")
    check_parser = sub.add_parser("check", help="Check an exercise implementation without a model")
    check_parser.add_argument("exercise", choices=("1", "2", "3", "all"))
    check_parser.add_argument("--solution", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "doctor":
            doctor(args)
        elif args.command == "run":
            run(args)
        else:
            for number in ([1, 2, 3] if args.exercise == "all" else [int(args.exercise)]):
                check(number, args.solution)
                print(f"PASS Exercise {number}")
    except (AssertionError, ValueError, OSError, KeyError, TypeError, urllib.error.URLError) as error:
        print(f"CHECK FAILED: {error}", file=sys.stderr)
        if args.command in ("doctor", "run") and args.source == "live":
            print("Check Ollama and the model, or retry with --source recorded. No fallback is automatic.", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nStopped; no completed group saved. A submitted Ollama request may finish on the server.", file=sys.stderr)
        return 130
    return 0


if __name__ == "__main__":
    sys.exit(main())
