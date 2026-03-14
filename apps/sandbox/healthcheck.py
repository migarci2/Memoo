"""Tiny health + landing endpoint for the sandbox container."""
import http.server
import json
import subprocess
import sys


LANDING_HTML = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Memoo Sandbox</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #eef3f8;
        --panel: rgba(255,255,255,0.88);
        --text: #10243a;
        --muted: #5f7184;
        --line: rgba(76, 98, 122, 0.16);
        --blue: #2563eb;
        --blue-soft: rgba(37,99,235,0.10);
        --green: #18794e;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--text);
        background:
          linear-gradient(180deg, rgba(255,255,255,0.72), rgba(238,243,248,0.92)),
          linear-gradient(90deg, rgba(76,98,122,0.06) 1px, transparent 1px),
          linear-gradient(rgba(76,98,122,0.06) 1px, transparent 1px);
        background-size: auto, 28px 28px, 28px 28px;
      }
      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 40px 28px 56px;
      }
      .hero {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 22px;
        align-items: stretch;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 28px;
        box-shadow: 0 24px 60px -34px rgba(16, 36, 58, 0.28);
        backdrop-filter: blur(8px);
      }
      .copy {
        padding: 34px;
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 8px 12px;
        background: var(--blue-soft);
        color: var(--blue);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        margin: 18px 0 0;
        font-size: 46px;
        line-height: 0.95;
        letter-spacing: -0.05em;
      }
      p {
        margin: 0;
      }
      .lede {
        margin-top: 18px;
        max-width: 46ch;
        color: var(--muted);
        font-size: 16px;
        line-height: 1.6;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 26px;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 46px;
        padding: 0 18px;
        border-radius: 999px;
        border: 1px solid var(--line);
        text-decoration: none;
        color: var(--text);
        background: #fff;
        font-weight: 700;
      }
      .btn.primary {
        border-color: rgba(37,99,235,0.26);
        color: #fff;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
      }
      .status {
        display: grid;
        gap: 12px;
        padding: 24px;
      }
      .statusCard {
        border-radius: 22px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.92);
        padding: 18px;
      }
      .statusCard strong {
        display: block;
        margin-top: 6px;
        font-size: 18px;
        letter-spacing: -0.03em;
      }
      .ok {
        color: var(--green);
      }
      .label {
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .list {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        margin-top: 18px;
      }
      .tile {
        padding: 20px;
        border-radius: 24px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.78);
      }
      .tile p + p {
        margin-top: 8px;
      }
      .mono {
        font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
        font-size: 13px;
      }
      @media (max-width: 900px) {
        .hero, .list { grid-template-columns: 1fr; }
        h1 { font-size: 36px; }
        main { padding: 24px 16px 40px; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="panel copy">
          <span class="eyebrow">Memoo Sandbox</span>
          <h1>Internet is available.<br />Gemini agent is ready.</h1>
          <p class="lede">
            This visible browser is the same session used by sandbox runs. The AI agent itself runs
            from the backend through Gemini. When a run starts, it will take control of this tab and
            navigate wherever it needs.
          </p>
          <div class="actions">
            <a class="btn primary" href="https://www.google.com">Open Google</a>
            <a class="btn" href="https://ai.google.dev/gemini-api/docs">Open Gemini Docs</a>
            <a class="btn" href="https://example.com">Open Example.com</a>
          </div>
        </div>

        <div class="panel status">
          <div class="statusCard">
            <span class="label">Network</span>
            <strong class="ok">Online from inside the sandbox</strong>
            <p class="lede">External websites can be loaded directly from Chromium and by the agent runtime.</p>
          </div>
          <div class="statusCard">
            <span class="label">Agent model</span>
            <strong>Gemini via backend</strong>
            <p class="lede">PageAgent runs with the backend-configured Gemini credentials, not from a browser extension.</p>
          </div>
          <div class="statusCard">
            <span class="label">Run behavior</span>
            <strong>Shared live session</strong>
            <p class="lede">You can watch the browser here while a run is executing in the same tab.</p>
          </div>
        </div>
      </section>

      <section class="list">
        <div class="tile">
          <p class="label">What you are seeing</p>
          <p>This page replaces <span class="mono">about:blank</span> so the sandbox does not look disconnected before navigation starts.</p>
        </div>
        <div class="tile">
          <p class="label">AI location</p>
          <p>The browser is visible here, but the reasoning loop and Gemini calls happen in the API service.</p>
        </div>
        <div class="tile">
          <p class="label">Good next step</p>
          <p>Start a run with an autonomous <span class="mono">action</span> step or click one of the links above to test live browsing.</p>
        </div>
      </section>
    </main>
  </body>
</html>
"""


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            # Check if Chromium is running
            try:
                result = subprocess.run(
                    ['pgrep', '-f', 'chromium'], capture_output=True, timeout=2,
                )
                ok = result.returncode == 0
            except Exception:
                ok = False

            status = 200 if ok else 503
            body = json.dumps({'status': 'ok' if ok else 'unhealthy', 'service': 'sandbox'})
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(body.encode())
        elif self.path in ('/', '/index.html'):
            body = LANDING_HTML.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *_):
        pass  # silence logs


if __name__ == '__main__':
    server = http.server.HTTPServer(('0.0.0.0', 8585), Handler)
    print('[health] Listening on :8585')
    sys.stdout.flush()
    server.serve_forever()
