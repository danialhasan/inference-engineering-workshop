"""Loopback-only Ollama client and immutable historical measurements."""
from datetime import datetime, timezone
from pathlib import Path
import copy
import json
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
MODEL = "qwen3:0.6b"
PROMPT = ("Write a numbered list of 100 practical tips for organizing a community workshop. "
          "Use one short sentence per item. Start at 1. Continue the list without an introduction.")
SETTINGS = {"temperature": 0, "seed": 42, "think": False, "num_ctx": 2048}


def api(port, path, body=None, timeout=90):
    if type(port) is not int or not 1 <= port <= 65535:
        raise ValueError("Port must be an integer between 1 and 65535.")
    # Ignore ambient proxy settings and redirects: requests stay on loopback.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    request = urllib.request.Request(f"http://127.0.0.1:{port}{path}",
                                     data=None if body is None else json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"})
    return opener.open(request, timeout=timeout)


def status(port):
    with api(port, "/api/tags", timeout=5) as response:
        models = json.load(response)["models"]
    model = next((m for m in models if m["name"] == MODEL), None)
    if model is None:
        raise ValueError(f"Model missing. Run: ollama pull {MODEL}")
    with api(port, "/api/version", timeout=5) as response:
        version = json.load(response)["version"]
    return {"ollama_version": version, "model_digest": model["digest"]}


def generate(port, cap, request_id=1, group_start=None, prompt=PROMPT, on_text=None):
    if type(cap) is not int or not 1 <= cap <= 96:
        raise ValueError("Output cap must be between 1 and 96.")
    start = time.perf_counter()
    group_start = start if group_start is None else group_start
    chunks, final = [], None
    body = {"model": MODEL, "prompt": prompt, "stream": True, "think": False,
            "keep_alive": "5m", "options": {"num_predict": cap, "temperature": 0,
                                              "seed": 42, "num_ctx": 2048}}
    # Timeout is socket inactivity, with an elapsed-time check between lines.
    # It is not a hard total deadline for an interrupted or stalled server.
    with api(port, "/api/generate", body) as response:
        for line in response:
            if time.perf_counter() - start > 90:
                raise TimeoutError("Request exceeded 90 seconds between stream events.")
            if not line.strip():
                continue
            event = json.loads(line)
            if event.get("error"):
                raise ValueError("Ollama: " + str(event["error"]))
            delta = event.get("response", "")
            if delta:
                chunks.append({"ms": (time.perf_counter() - start) * 1000, "text": delta})
                if on_text:
                    on_text(delta)
            if event.get("done"):
                final = event
                break
    end = time.perf_counter()
    if final is None or not chunks:
        raise ValueError("Incomplete stream or no visible text; no result saved.")
    count = final.get("eval_count")
    if type(count) is not int or count <= 0:
        raise ValueError("Completion has no valid token count; no result saved.")
    durations = {name: final.get(key, 0) / 1_000_000 for name, key in
                 (("load_ms", "load_duration"), ("prefill_ms", "prompt_eval_duration"),
                  ("decode_ms", "eval_duration"), ("server_total_ms", "total_duration"))}
    return {"id": request_id, "start_ms": (start - group_start) * 1000,
            "end_ms": (end - group_start) * 1000, "wall_ms": (end - start) * 1000,
            "first_text_ms": chunks[0]["ms"], "chunks": chunks,
            "text": "".join(c["text"] for c in chunks), "output_tokens": count,
            "prompt_tokens": final.get("prompt_eval_count"),
            "done_reason": final.get("done_reason", "unknown"), **durations}


def recorded(cap, count, workers, repeat):
    runs = json.loads((ROOT / "data/runs.json").read_text())
    matches = [r for r in runs if r["config"] ==
               {"cap": cap, "count": count, "concurrency": workers}]
    if not matches:
        raise ValueError("No saved run for these settings; use a supported exercise or live mode.")
    run = copy.deepcopy(matches[repeat % len(matches)])
    run["execution_note"] = "Historical measurement; no inference or scheduling measured on this device."
    return run


def live(port, cap, count, workers, schedule, on_text=None):
    info = status(port)
    generate(port, 8, prompt="Say hello in one word.")  # excluded warm-up
    start = time.perf_counter()
    jobs = [lambda i=i: generate(port, cap, i + 1, start, on_text=on_text)
            for i in range(count)]
    requests = schedule(jobs, workers)
    wall = (time.perf_counter() - start) * 1000
    if [r.get("id") for r in requests] != list(range(1, count + 1)):
        raise ValueError("Scheduler must return each request exactly once in input order; no result saved.")
    tokens = sum(r["output_tokens"] for r in requests)
    return {"schema": 1, "source": "live", "created_at": datetime.now(timezone.utc).isoformat(),
            "model": MODEL, **info, "config": {"cap": cap, "count": count, "concurrency": workers},
            "prompt": PROMPT, "settings": SETTINGS, "group_ms": wall, "requests": requests,
            "total_output_tokens": tokens, "throughput_tokens_s": tokens / (wall / 1000),
            "execution_note": "8-token warm-up excluded; prefix cache remains active; concurrency is requested by client."}
