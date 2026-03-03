# ─────────────────────────────────────────────────────────────────────────────
# Memoo Sandbox — Visible Chromium browser controlled via Playwright CDP
#
# Stack:  Xvfb (virtual display) → Chromium → x11vnc → websockify → noVNC
# The user watches / interacts via a noVNC WebSocket in the frontend.
# The API drives the browser via Playwright CDP on port 9222.
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:99 \
    RESOLUTION=1280x800x24 \
    VNC_PORT=5900 \
    NOVNC_PORT=6080 \
    CDP_PORT=9222

# ── System packages ──────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Virtual display
    xvfb \
    # VNC server
    x11vnc \
    # noVNC + websockify
    novnc websockify \
    # Chromium
    chromium \
    # TCP forwarder (Chromium ignores --remote-debugging-address in newer versions)
    socat \
    # Utils
    procps curl xdg-utils fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# ── Supervisor-like start script ─────────────────────────────────────────────
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# ── Health endpoint (tiny Python HTTP server) ────────────────────────────────
COPY healthcheck.py /healthcheck.py

EXPOSE ${NOVNC_PORT} ${CDP_PORT} 9223

CMD ["/entrypoint.sh"]
