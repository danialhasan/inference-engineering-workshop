#!/bin/sh
# Presenter helper for Labs 2 and 3 (System B): starts a SECOND Ollama server with four request slots on its own
# loopback port. Your normal Ollama server and its settings are left alone. It uses your usual
# model folder unless OLLAMA_MODELS is already set. Stop it with Ctrl+C.
# Usage: sh tools/four-slot-server.sh [port]      then open the lab with  ?base=http://127.0.0.1:<port>
PORT="${1:-11435}"
echo "Four-slot Ollama server on http://127.0.0.1:$PORT  (Ctrl+C to stop)"
echo "Lab address: add  ?base=http://127.0.0.1:$PORT  to the lab URL, e.g."
echo "  http://127.0.0.1:8765/lab/index.html?base=http://127.0.0.1:$PORT#load"
OLLAMA_HOST="127.0.0.1:$PORT" OLLAMA_NUM_PARALLEL=4 OLLAMA_MAX_LOADED_MODELS=1 exec ollama serve
