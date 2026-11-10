"""Rehearse committed HEAD in a temporary clone; never edit the source checkout."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--live", action="store_true")
parser.add_argument("--port", type=int, default=11434)
parser.add_argument("--report", type=Path)
args = parser.parse_args()
steps = []


def command(cwd, argv, expect=0):
    result = subprocess.run(argv, cwd=cwd, capture_output=True, text=True, timeout=300)
    steps.append({"command": argv, "expected_exit": expect, "exit": result.returncode,
                  "stdout": result.stdout, "stderr": result.stderr})
    if result.returncode != expect:
        raise RuntimeError(f"Unexpected exit for {argv}:\n{result.stdout}\n{result.stderr}")
    print("PASS", " ".join(argv[1:]), f"(exit {expect})")


with tempfile.TemporaryDirectory(prefix="inference-workshop-rehearsal-") as temporary:
    clone = Path(temporary) / "attendee"
    command(ROOT, ["git", "clone", "--no-local", str(ROOT), str(clone)])
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=clone, text=True).strip()
    command(clone, ["git", "switch", "-c", "my-workshop"])
    python = sys.executable
    cli = [python, "workshop.py"]
    command(clone, [python, "-m", "unittest", "discover", "-s", "tests", "-v"])
    command(clone, cli + ["doctor"])
    for number in range(4):
        command(clone, cli + ["run", str(number), "--repeat", "1"])
    for number in (1, 2, 3):
        command(clone, cli + ["check", str(number)], expect=1)
    command(clone, cli + ["check", "all", "--solution"])
    for name in ("ex01_stream.py", "ex02_budget.py", "ex03_concurrency.py"):
        shutil.copyfile(clone / "solutions" / name, clone / "exercises" / name)
    command(clone, cli + ["check", "all"])
    for number in range(4):
        command(clone, cli + ["run", str(number)])
    # Confirm protected outputs and unavailable-server behavior.
    command(clone, cli + ["run", "0", "--repeat", "1", "--output", "results/keep.json"])
    before = (clone / "results/keep.json").read_bytes()
    command(clone, cli + ["run", "0", "--repeat", "1", "--output", "results/keep.json"], expect=1)
    assert (clone / "results/keep.json").read_bytes() == before
    # Bind without listening to reserve an unavailable port, avoiding assumptions about port 1.
    import socket
    with socket.socket() as unavailable:
        unavailable.bind(("127.0.0.1", 0))
        port = str(unavailable.getsockname()[1])
        command(clone, cli + ["doctor", "--source", "live", "--port", port], expect=1)
        command(clone, cli + ["run", "0", "--source", "live", "--port", port,
                              "--output", "results/failed.json"], expect=1)
        assert not (clone / "results/failed.json").exists()
    if args.live:
        live_args = ["--source", "live", "--port", str(args.port)]
        command(clone, cli + ["doctor"] + live_args)
        for number in range(4):
            command(clone, cli + ["run", str(number)] + live_args)
    files = list((clone / "results").glob("*.json"))
    for path in files:
        document = json.loads(path.read_text())
        for run in document["runs"]:
            assert document["source"] == run["source"]
            assert [r["id"] for r in run["requests"]] == list(range(1, len(run["requests"]) + 1))
            assert run["total_output_tokens"] == sum(r["output_tokens"] for r in run["requests"])
    report = {"revision": revision, "python": sys.version, "platform": sys.platform,
              "live": args.live, "steps_passed": len(steps), "result_files_checked": len(files), "steps": steps}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n")
    print(f"REHEARSAL PASSED: {len(steps)} steps; {len(files)} result files; revision {revision}")
