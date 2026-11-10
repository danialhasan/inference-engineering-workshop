#!/bin/sh
# Pre-event setup check for macOS and Linux. Changes nothing on your machine.
# Usage: sh tools/check.sh [ollama-url] [model]
BASE="${1:-http://127.0.0.1:11434}"
MODEL="${2:-qwen2.5:1.5b}"
FAIL=0
ok()   { printf '  [ok]   %s\n' "$1"; }
bad()  { printf '  [FAIL] %s\n' "$1"; FAIL=1; }
note() { printf '  [note] %s\n' "$1"; }

echo "Inference workshop setup check"
echo "  server: $BASE   model: $MODEL"
echo

echo "1. This laptop"
case "$(uname -s)" in
  Darwin)
    note "macOS $(sw_vers -productVersion 2>/dev/null), $(sysctl -n machdep.cpu.brand_string 2>/dev/null)"
    RAM_GB=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1073741824 ));;
  Linux)
    note "Linux $(uname -r), $(uname -m)"
    RAM_GB=$(( $(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0) / 1048576 ));;
  *) note "$(uname -s) (not a system this script was written for)"; RAM_GB=0;;
esac
if [ "$RAM_GB" -ge 8 ]; then ok "${RAM_GB} GB RAM"; elif [ "$RAM_GB" -gt 0 ]; then note "${RAM_GB} GB RAM: below the 8 GB this kit was planned for; close other apps, or use recorded data"; fi
FREE_KB=$(df -Pk "$HOME" 2>/dev/null | awk 'NR==2 {print $4}')
[ -n "$FREE_KB" ] && note "$(( FREE_KB / 1048576 )) GB free disk in your home folder (the model needs about 1 GB)"

echo "2. Ollama"
if command -v ollama >/dev/null 2>&1; then ok "ollama command found: $(command -v ollama)"; else note "no 'ollama' command on PATH (fine if the desktop app is running)"; fi
if ! command -v curl >/dev/null 2>&1; then bad "curl is missing, so this script cannot test the server. Use the Setup tab in the lab instead."; exit 1; fi
VERSION=$(curl -s -m 5 "$BASE/api/version" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p')
if [ -n "$VERSION" ]; then ok "server answers, version $VERSION"; else bad "no answer from $BASE. Start Ollama (open the app, or run: ollama serve)"; fi

echo "3. Model"
if [ -n "$VERSION" ]; then
  if curl -s -m 5 "$BASE/api/tags" | grep -q "\"name\":\"$MODEL\""; then ok "$MODEL is installed"
  else bad "$MODEL is not installed. With a good connection run: ollama pull $MODEL   (about 1 GB)"; fi
else note "skipped (no server)"; fi

echo "4. A short generation"
if [ "$FAIL" -eq 0 ]; then
  OUT=$(curl -s -m 180 "$BASE/api/generate" -d "{\"model\":\"$MODEL\",\"prompt\":\"Count from one to twenty in words.\",\"stream\":false,\"options\":{\"num_predict\":32,\"temperature\":0}}")
  N=$(printf '%s' "$OUT" | sed -n 's/.*"eval_count":\([0-9]*\).*/\1/p')
  D=$(printf '%s' "$OUT" | sed -n 's/.*"eval_duration":\([0-9]*\).*/\1/p')
  if [ -n "$N" ] && [ -n "$D" ] && [ "$D" -gt 0 ]; then
    ok "$N tokens at $(awk -v n="$N" -v d="$D" 'BEGIN { printf "%.0f", n / (d / 1000000000) }') tokens per second, measured on this laptop just now"
  else bad "generation failed: $(printf '%s' "$OUT" | cut -c1-200)"; fi
else note "skipped"; fi

echo "5. Page server for the lab"
if command -v python3 >/dev/null 2>&1; then ok "python3 found (start.sh will use it)"
elif command -v node >/dev/null 2>&1; then ok "node found (start.sh will use it)"
else bad "neither python3 nor node found; the live lab page cannot be served. Recorded data still works."; fi

echo
if [ "$FAIL" -eq 0 ]; then
  echo "READY for the live path. Now switch Wi-Fi off and run this once more to prove it works offline."
  echo "On the day: sh start.sh   then press 'Run setup check' on the Setup tab."
else
  echo "NOT READY for the live path. Fix the FAIL lines above while you still have a good connection."
  echo "If you cannot, you can still take part: open lab/index.html and choose recorded data."
fi
exit $FAIL
