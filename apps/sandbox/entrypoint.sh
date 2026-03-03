#!/bin/bash
set -e

echo "[sandbox] Starting Xvfb on :99 (${RESOLUTION})…"
Xvfb :99 -screen 0 "${RESOLUTION}" -ac +extension GLX +render -noreset &
sleep 1

echo "[sandbox] Starting Chromium with remote debugging on :${CDP_PORT}…"
chromium \
  --no-first-run \
  --disable-gpu \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-background-timer-throttling \
  --disable-renderer-backgrounding \
  --disable-backgrounding-occluded-windows \
  --remote-debugging-port="${CDP_PORT}" \
  --remote-debugging-address=0.0.0.0 \
  --window-size=1280,800 \
  --start-maximized \
  --user-data-dir=/tmp/chromium-profile \
  "about:blank" &
sleep 2

# Chromium may ignore --remote-debugging-address and bind to 127.0.0.1 only.
# Use socat to forward 0.0.0.0:CDP_PORT → 127.0.0.1:CDP_PORT so other
# containers on the Docker network can reach the DevTools protocol.
CDP_LISTEN=9223
echo "[sandbox] Starting socat forwarder 0.0.0.0:${CDP_LISTEN} → localhost:${CDP_PORT}…"
socat TCP-LISTEN:${CDP_LISTEN},fork,reuseaddr,bind=0.0.0.0 TCP:127.0.0.1:${CDP_PORT} &

echo "[sandbox] Starting x11vnc on :${VNC_PORT}…"
x11vnc -display :99 -nopw -listen 0.0.0.0 -rfbport "${VNC_PORT}" \
  -shared -forever -ncache 10 -ncache_cr &
sleep 1

echo "[sandbox] Starting noVNC (websockify) on :${NOVNC_PORT}…"
websockify --web /usr/share/novnc "${NOVNC_PORT}" localhost:"${VNC_PORT}" &

echo "[sandbox] Starting health server on :8585…"
python3 /healthcheck.py &

echo "[sandbox] Ready — noVNC ws://0.0.0.0:${NOVNC_PORT}, CDP http://0.0.0.0:${CDP_PORT}"

# Keep alive
wait -n
