#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4174}"
OUT_DIR="${1:-ui-screenshots}"
SERVER_LOG="${RUNNER_TEMP:-/tmp}/zero2fit-visual-server.log"
mkdir -p "$OUT_DIR"

python3 -m http.server "$PORT" --bind 127.0.0.1 >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null; then break; fi
  sleep 0.25
done

CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then
  echo 'No Chrome/Chromium executable found on runner.' >&2
  exit 1
fi

capture() {
  local label="$1" width="$2" height="$3" name="$4" query="$5"
  local file="$OUT_DIR/${label}-${name}.png"
  "$CHROME" \
    --headless=new \
    --no-sandbox \
    --disable-gpu \
    --disable-dev-shm-usage \
    --hide-scrollbars \
    --virtual-time-budget=14000 \
    --window-size="$width,$height" \
    --screenshot="$file" \
    "http://127.0.0.1:${PORT}/?${query}" >/dev/null 2>&1
  test -s "$file"
  echo "Captured $file"
}

capture iphone 393 852 today 'qaPage=today'
capture iphone 393 852 train 'qaPage=train'
capture iphone 393 852 adventure 'qaPage=character&qaFocus=frontier'
capture iphone 393 852 fuel 'qaPage=nutrition'
capture iphone 393 852 progress 'qaPage=journey'
capture iphone 393 852 devices 'qaPage=data'
capture iphone 393 852 settings 'qaPage=today&qaSettings=1'

capture desktop 1440 1000 today 'qaPage=today'
capture desktop 1440 1000 train 'qaPage=train'
capture desktop 1440 1000 adventure 'qaPage=character&qaFocus=frontier'
capture desktop 1440 1000 fuel 'qaPage=nutrition'
capture desktop 1440 1000 progress 'qaPage=journey'
capture desktop 1440 1000 devices 'qaPage=data'

echo "UI screenshot set complete: $(find "$OUT_DIR" -name '*.png' | wc -l) images."
