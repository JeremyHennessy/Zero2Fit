#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4181}"
OUT_DIR="${1:-build045-fuel-friction-screenshots}"
SERVER_LOG="${RUNNER_TEMP:-/tmp}/zero2fit-build045-fuel-visual-server.log"
mkdir -p "$OUT_DIR"

python3 -m http.server "$PORT" --bind 127.0.0.1 >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

ready=0
for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT}/qa-fuel-friction-fixture.html" >/dev/null; then ready=1; break; fi
  sleep 0.25
done
if [[ "$ready" != 1 ]]; then echo 'Build 045 Fuel-friction visual server did not become ready.' >&2; cat "$SERVER_LOG" >&2 || true; exit 1; fi

CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then echo 'No Chrome/Chromium executable found on runner.' >&2; exit 1; fi

capture() {
  local width="$1" height="$2" name="$3"
  local file="$OUT_DIR/${name}.png"
  local attempt chrome_status profile
  for attempt in 1 2; do
    profile="${RUNNER_TEMP:-/tmp}/z2f-build045-fuel-shot-${name}-${attempt}-$$"
    rm -rf "$profile" "$file"
    set +e
    timeout --signal=TERM --kill-after=5s 40s "$CHROME" \
      --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
      --disable-background-networking --disable-component-update --no-first-run \
      --no-default-browser-check --hide-scrollbars --user-data-dir="$profile" \
      --virtual-time-budget=10000 --window-size="$width,$height" \
      --screenshot="$file" "http://127.0.0.1:${PORT}/qa-fuel-friction-fixture.html" >/dev/null 2>&1
    chrome_status=$?
    set -e
    rm -rf "$profile"
    if [[ -s "$file" ]]; then
      echo "Captured $file"
      return 0
    fi
    if [[ "$attempt" -eq 1 ]]; then echo "Build 045 Fuel screenshot retry for ${name}; Chrome exit ${chrome_status}." >&2; fi
  done
  echo "Build 045 Fuel screenshot failed for ${name}." >&2
  return 1
}

capture 393 852 iphone-fuel-friction
capture 393 3200 iphonefull-fuel-friction
capture 1440 1000 desktop-fuel-friction

count="$(find "$OUT_DIR" -name '*.png' | wc -l)"
if [[ "$count" -ne 3 ]]; then echo "Expected 3 Build 045 Fuel screenshots, found ${count}." >&2; exit 1; fi

echo 'Build 045 populated Fuel-friction screenshot set complete: 3 images.'
