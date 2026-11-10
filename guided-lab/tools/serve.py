#!/usr/bin/env python3
"""Serve the workshop kit on a loopback address so the lab page can talk to Ollama.

Standard library only. Binds 127.0.0.1 and never listens on the network.
On request from the lab page it can start extra Ollama processes on their own ports
(to change serving slots). It stops only the processes it started.
Usage: python3 tools/serve.py [port] [--open]
"""
import atexit
import functools
import http.server
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


OWNED = []  # Ollama processes started by this page server, and only those


def start_owned(slots):
    """Start one more Ollama process that this lab owns. Existing servers are never touched."""
    for o in OWNED:
        if o["slots"] == slots and o["proc"].poll() is None:
            return o
    if len([o for o in OWNED if o["proc"].poll() is None]) >= 3:
        raise RuntimeError("three owned servers are already running; stop the kit to clear them")
    exe = shutil.which("ollama")
    if not exe:
        raise RuntimeError("the 'ollama' command was not found on PATH")
    port = free_port(11500)
    env = dict(os.environ, OLLAMA_HOST="127.0.0.1:%d" % port, OLLAMA_NUM_PARALLEL=str(slots), OLLAMA_MAX_LOADED_MODELS="1")
    proc = subprocess.Popen([exe, "serve"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = "http://127.0.0.1:%d" % port
    for _ in range(60):
        if proc.poll() is not None:
            raise RuntimeError("ollama exited while starting")
        try:
            urllib.request.urlopen(base + "/api/version", timeout=0.5).read()
            break
        except Exception:
            time.sleep(0.25)
    else:
        proc.terminate()
        raise RuntimeError("the new server did not answer in time")
    o = {"base": base, "slots": slots, "proc": proc}
    OWNED.append(o)
    return o


def stop_owned():
    for o in OWNED:
        if o["proc"].poll() is None:
            o["proc"].terminate()


atexit.register(stop_owned)
# A plain terminate (not only Ctrl+C) must also stop the processes this server started.
signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))


class Handler(http.server.SimpleHTTPRequestHandler):
    def _json(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _servers(self):
        return [{"base": o["base"], "slots_requested": o["slots"]} for o in OWNED if o["proc"].poll() is None]

    def do_GET(self):
        if self.path.split("?")[0] == "/lab-api/servers":
            return self._json(200, {"servers": self._servers()})
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/lab-api/servers":
            return self._json(404, {"error": "not found"})
        # Only pages served by this server may ask it to start a process.
        origin = self.headers.get("Origin", "")
        if origin and origin != "http://%s" % self.headers.get("Host", ""):
            return self._json(403, {"error": "cross-origin request refused"})
        try:
            slots = int(urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("slots", ["1"])[0])
            if slots not in (1, 2, 4, 8):
                raise ValueError("slots must be 1, 2, 4 or 8")
            o = start_owned(slots)
            return self._json(200, {"base": o["base"], "slots_requested": slots, "servers": self._servers()})
        except Exception as err:  # reported to the page, which shows it
            return self._json(500, {"error": str(err)})

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


def free_port(first):
    for port in range(first, first + 30):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise SystemExit("No free port found between %d and %d." % (first, first + 29))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    port = free_port(int(args[0]) if args else 8765)
    handler = functools.partial(Handler, directory=ROOT)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    base = "http://127.0.0.1:%d" % port
    print("Workshop kit is being served from this laptop only.")
    print("  Lab:    %s/lab/index.html" % base)
    print("  Slides: %s/slides/index.html" % base)
    print("Leave this window open. Press Ctrl+C to stop.", flush=True)
    if "--open" in sys.argv:
        import webbrowser

        webbrowser.open(base + "/lab/index.html")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        stop_owned()


if __name__ == "__main__":
    main()
