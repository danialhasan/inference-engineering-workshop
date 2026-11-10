"""Behavioral checkpoints that run without a model or network."""
import importlib
import threading

MODULES = {1: "ex01_stream", 2: "ex02_budget", 3: "ex03_concurrency"}


def load(number, solution=False):
    return importlib.import_module(("solutions." if solution else "exercises.") + MODULES[number])


def check(number, solution=False):
    module = load(number, solution)
    if number == 1:
        for first in (0, 12.5):
            result = module.measure({"chunks": [{"ms": 0, "text": ""},
                                    {"ms": first, "text": "Hi"}, {"ms": 19, "text": "!"}],
                                    "wall_ms": 40, "output_tokens": 2})
            assert result == {"first_text_ms": first, "wall_ms": 40, "output_tokens": 2}, \
                "Use the first nonempty text chunk, including when its time is zero."
        assert module.measure({"chunks": [], "wall_ms": 1, "output_tokens": 0})["first_text_ms"] is None
    elif number == 2:
        assert module.output_caps() == [32, 96], "Keep the baseline at 32 and change only the second cap to 96."
    else:
        for workers in (1, 2, 4):
            lock, release = threading.Lock(), threading.Event()
            active, peak = 0, 0
            def job(value):
                nonlocal active, peak
                with lock:
                    active += 1
                    peak = max(peak, active)
                    if active == workers:
                        release.set()
                release.wait(0.3)
                with lock:
                    active -= 1
                return value
            results = module.schedule([lambda i=i: job(i) for i in range(4)], workers)
            assert results == [0, 1, 2, 3], "Return every result in input order."
            assert peak == workers, f"Expected {workers} overlapping jobs, observed {peak}; submit before waiting."
        def failed_job():
            raise ValueError("expected failure")
        try:
            module.schedule([failed_job], 1)
        except ValueError:
            pass
        else:
            raise AssertionError("Propagate failed requests instead of reporting a successful group.")
