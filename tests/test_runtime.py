import hashlib
import io
import json
import unittest
from unittest.mock import patch

from workshop import runtime
from workshop.checks import check
from solutions.ex03_concurrency import schedule


class RuntimeTests(unittest.TestCase):
    def test_reference_checkpoints(self):
        for number in (1, 2, 3):
            check(number, True)

    def test_recordings_integrity_and_arithmetic(self):
        data = (runtime.ROOT / "data/runs.json").read_bytes()
        provenance = json.loads((runtime.ROOT / "data/provenance.json").read_text())
        self.assertEqual(hashlib.sha256(data).hexdigest(), provenance["runs_sha256"])
        runs = json.loads(data)
        self.assertEqual(len(runs), 8)
        for run in runs:
            self.assertEqual(run["source"], "recorded")
            tokens = sum(r["output_tokens"] for r in run["requests"])
            self.assertEqual(tokens, run["total_output_tokens"])
            self.assertAlmostEqual(tokens / (run["group_ms"] / 1000), run["throughput_tokens_s"])
            for request in run["requests"]:
                self.assertLessEqual(request["first_text_ms"], request["wall_ms"])
                self.assertEqual(request["text"], "".join(c["text"] for c in request["chunks"]))

    def test_recorded_load_does_not_modify_source(self):
        first = runtime.recorded(32, 1, 1, 0)
        first["requests"][0]["text"] = "changed"
        self.assertNotEqual(runtime.recorded(32, 1, 1, 0)["requests"][0]["text"], "changed")
        with self.assertRaises(ValueError):
            runtime.recorded(64, 1, 1, 0)

    def test_partial_and_error_streams_fail(self):
        for body in (b'{"response":"hello"}\n', b'{"done":true,"eval_count":1}\n',
                     b'{"error":"out of memory"}\n', b'not json\n',
                     b'{"response":"hello","done":true}\n'):
            with self.subTest(body=body), patch.object(runtime, "api", return_value=io.BytesIO(body)):
                with self.assertRaises(ValueError):
                    runtime.generate(11434, 32)

    def test_final_text_chunk_and_ns_conversion(self):
        body = b'{"response":"hello","done":true,"eval_count":1,"eval_duration":2000000}\n'
        chunks = []
        with patch.object(runtime, "api", return_value=io.BytesIO(body)):
            result = runtime.generate(11434, 32, on_text=chunks.append)
        self.assertEqual(result["text"], "hello")
        self.assertEqual(chunks, ["hello"])
        self.assertEqual(result["decode_ms"], 2)
        self.assertGreaterEqual(result["wall_ms"], result["first_text_ms"])

    def test_invalid_port_and_cap(self):
        for port in (0, -1, 65536, True, "remote.example"):
            with self.assertRaises(ValueError):
                runtime.api(port, "/api/tags")
        for cap in (0, 97, True):
            with self.assertRaises(ValueError):
                runtime.generate(11434, cap)

    def test_duplicate_missing_or_reordered_results_rejected(self):
        def fake_generate(port, cap, request_id=1, *args, **kwargs):
            return {"id": request_id, "output_tokens": 5}
        schedulers = [lambda jobs, workers: [jobs[0]()] * len(jobs),
                      lambda jobs, workers: [jobs[0]()],
                      lambda jobs, workers: [job() for job in reversed(jobs)]]
        for scheduler in schedulers:
            with patch.object(runtime, "status", return_value={}), patch.object(runtime, "generate", side_effect=fake_generate):
                with self.assertRaisesRegex(ValueError, "exactly once"):
                    runtime.live(11434, 32, 4, 4, scheduler)

    def test_failed_group_propagates(self):
        calls = 0
        def fail_after_warmup(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls > 1:
                raise ValueError("request failed")
        with patch.object(runtime, "status", return_value={}), patch.object(runtime, "generate", side_effect=fail_after_warmup):
            with self.assertRaisesRegex(ValueError, "request failed"):
                runtime.live(11434, 32, 4, 4, schedule)


if __name__ == "__main__":
    unittest.main()
