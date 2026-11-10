#!/bin/sh
# Serves this kit from 127.0.0.1 and opens the lab. Needs python3 or node (either one).
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  exec python3 tools/serve.py --open "$@"
elif command -v node >/dev/null 2>&1; then
  exec node tools/serve.mjs --open "$@"
else
  echo "Neither python3 nor node was found, so the live path cannot start."
  echo "You can still take part: open lab/index.html in a browser and choose recorded data."
  exit 1
fi
