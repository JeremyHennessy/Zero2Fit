#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4174}"
OUT_DIR="${1:-ui-screenshots}"
SERVER_LOG="${RUNNER_TEMP:-/tmp}/zero2fit-visual-server.log"
mkdir -p "$OUT_DIR"

python3 -m http.server "$PORT" --bind 127.0.0.1 >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

server_ready=0
for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null; then
    server_ready=1
    break
  fi
  sleep 0.25
done
if [[ "$server_ready" != 1 ]]; then
  echo 'Visual QA server did not become ready.' >&2
  cat "$SERVER_LOG" >&2 || true
  exit 1
fi

CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then
  echo 'No Chrome/Chromium executable found on runner.' >&2
  exit 1
fi

capture() {
  local label="$1" width="$2" height="$3" name="$4" query="$5"
  local file="$OUT_DIR/${label}-${name}.png"
  local target="http://127.0.0.1:${PORT}/?${query}"
  if [[ "$query" == path:* ]]; then
    target="http://127.0.0.1:${PORT}/${query#path:}"
  fi

  local attempt chrome_status profile
  for attempt in 1 2; do
    profile="${RUNNER_TEMP:-/tmp}/z2f-chrome-${label}-${name}-${attempt}-$$"
    rm -rf "$profile" "$file"

    set +e
    timeout --signal=TERM --kill-after=5s 35s "$CHROME" \
      --headless=new \
      --no-sandbox \
      --disable-gpu \
      --disable-dev-shm-usage \
      --disable-background-networking \
      --disable-component-update \
      --no-first-run \
      --no-default-browser-check \
      --hide-scrollbars \
      --user-data-dir="$profile" \
      --virtual-time-budget=6000 \
      --window-size="$width,$height" \
      --screenshot="$file" \
      "$target" >/dev/null 2>&1
    chrome_status=$?
    set -e

    rm -rf "$profile"
    if [[ -s "$file" ]]; then
      if [[ "$chrome_status" -ne 0 ]]; then
        echo "Chrome exit ${chrome_status} after producing ${file}; accepting verified non-empty screenshot."
      elif [[ "$attempt" -eq 2 ]]; then
        echo "Captured $file on retry."
      else
        echo "Captured $file"
      fi
      return 0
    fi

    if [[ "$attempt" -eq 1 ]]; then
      echo "Screenshot attempt 1 failed for ${label}-${name}; Chrome exit ${chrome_status}. Retrying once with a fresh profile." >&2
    fi
  done

  echo "Screenshot failed for ${label}-${name} after 2 attempts; final Chrome exit ${chrome_status}." >&2
  return "${chrome_status:-1}"
}

capture iphone 393 852 today 'qaPage=today'
capture iphone 393 852 train 'qaPage=train'
capture iphone 393 852 adventure 'qaPage=character&qaFocus=frontier'
capture iphone 393 852 fuel 'path:qa-fuel-fixture.html?page=nutrition'
capture iphone 393 852 progress 'path:qa-fuel-fixture.html?page=journey'
capture iphone 393 852 photos 'path:qa-photos-fixture.html'
capture iphone 393 852 devices 'qaPage=data'
capture iphone 393 852 acceptance 'path:qa-acceptance-fixture.html'
capture iphone 393 852 settings 'qaPage=today&qaSettings=1'

capture desktop 1440 1000 today 'qaPage=today'
capture desktop 1440 1000 train 'qaPage=train'
capture desktop 1440 1000 adventure 'qaPage=character&qaFocus=frontier'
capture desktop 1440 1000 fuel 'path:qa-fuel-fixture.html?page=nutrition'
capture desktop 1440 1000 progress 'path:qa-fuel-fixture.html?page=journey'
capture desktop 1440 1000 devices 'qaPage=data'

count="$(find "$OUT_DIR" -name '*.png' | wc -l)"
if [[ "$count" -ne 15 ]]; then
  echo "Expected 15 screenshots, found ${count}." >&2
  exit 1
fi

echo "UI screenshot set complete: ${count} images."
