#!/bin/bash
set -Eeuo pipefail

child_pids=()

cleanup() {
  local code=$?
  trap - EXIT INT TERM
  if ((${#child_pids[@]})); then
    kill "${child_pids[@]}" 2>/dev/null || true
    wait "${child_pids[@]}" 2>/dev/null || true
  fi
  exit "$code"
}

register_child() {
  child_pids+=("$1")
}

require_process() {
  local pattern="$1"
  local label="$2"
  if ! pgrep -f "$pattern" >/dev/null 2>&1; then
    echo "[sandbox] ${label} is not running"
    exit 1
  fi
}

tcp_ready() {
  local port="$1"
  (echo >"/dev/tcp/127.0.0.1/${port}") >/dev/null 2>&1
}

wait_for_process() {
  local pattern="$1"
  local label="$2"
  local attempts="${3:-20}"
  local delay="${4:-0.5}"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if pgrep -f "$pattern" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done

  echo "[sandbox] ${label} did not start in time"
  exit 1
}

wait_for_tcp() {
  local port="$1"
  local label="$2"
  local attempts="${3:-20}"
  local delay="${4:-0.5}"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if tcp_ready "$port"; then
      return 0
    fi
    sleep "$delay"
  done

  echo "[sandbox] ${label} on port ${port} did not start in time"
  exit 1
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-20}"
  local delay="${4:-0.5}"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done

  echo "[sandbox] ${label} at ${url} did not start in time"
  exit 1
}

trap cleanup EXIT INT TERM

echo "[sandbox] Starting Xvfb on :99 (${RESOLUTION})..."
Xvfb :99 -screen 0 "${RESOLUTION}" -ac +extension GLX +render -noreset &
register_child "$!"
wait_for_process "Xvfb :99" "Xvfb"

echo "[sandbox] Starting Chromium with remote debugging on :${CDP_PORT}..."
chromium \
  --no-first-run \
  --disable-gpu \
  --no-sandbox \
  --test-type \
  --disable-infobars \
  --disable-dev-shm-usage \
  --disable-background-timer-throttling \
  --disable-renderer-backgrounding \
  --disable-backgrounding-occluded-windows \
  --remote-debugging-port="${CDP_PORT}" \
  --remote-debugging-address=0.0.0.0 \
  --remote-allow-origins=* \
  --window-size=1280,800 \
  --start-maximized \
  --user-data-dir=/tmp/chromium-profile \
  "http://127.0.0.1:8585/" &
register_child "$!"
wait_for_http "http://127.0.0.1:${CDP_PORT}/json/version" "Chromium DevTools" 40 0.5

# Chromium may ignore --remote-debugging-address and bind to 127.0.0.1 only.
# Use socat to forward 0.0.0.0:CDP_PORT -> 127.0.0.1:CDP_PORT so other
# containers on the Docker network can reach the DevTools protocol.
CDP_LISTEN=9223
echo "[sandbox] Starting socat forwarder 0.0.0.0:${CDP_LISTEN} -> localhost:${CDP_PORT}..."
socat TCP-LISTEN:${CDP_LISTEN},fork,reuseaddr,bind=0.0.0.0 TCP:127.0.0.1:${CDP_PORT} &
register_child "$!"

echo "[sandbox] Forwarding localhost:3000 -> web:3000 for in-browser app access..."
socat TCP-LISTEN:3000,fork,reuseaddr,bind=127.0.0.1 TCP:web:3000 &
register_child "$!"

echo "[sandbox] Forwarding localhost:8000 -> api:8000 for in-browser API access..."
socat TCP-LISTEN:8000,fork,reuseaddr,bind=127.0.0.1 TCP:api:8000 &
register_child "$!"

echo "[sandbox] Starting x11vnc on :${VNC_PORT}..."
x11vnc -display :99 -nopw -listen 0.0.0.0 -rfbport "${VNC_PORT}" \
  -shared -forever &
register_child "$!"
wait_for_tcp "${VNC_PORT}" "x11vnc" 20 0.5

echo "[sandbox] Starting noVNC (websockify) on :${NOVNC_PORT}..."
websockify --web /usr/share/novnc "${NOVNC_PORT}" localhost:"${VNC_PORT}" &
register_child "$!"
wait_for_tcp "${NOVNC_PORT}" "websockify" 20 0.5

echo "[sandbox] Starting health server on :8585..."
python3 /healthcheck.py &
register_child "$!"
wait_for_http "http://127.0.0.1:8585/health" "health server" 20 0.5

echo "[sandbox] Ready - noVNC ws://0.0.0.0:${NOVNC_PORT}, CDP http://0.0.0.0:${CDP_PORT}"

while true; do
  require_process "Xvfb :99" "Xvfb"
  wait_for_http "http://127.0.0.1:${CDP_PORT}/json/version" "Chromium DevTools" 1 0
  require_process "TCP-LISTEN:${CDP_LISTEN}" "socat"
  wait_for_tcp "${VNC_PORT}" "x11vnc" 1 0
  wait_for_tcp "${NOVNC_PORT}" "websockify" 1 0
  wait_for_http "http://127.0.0.1:8585/health" "health server" 1 0
  sleep 2
done
