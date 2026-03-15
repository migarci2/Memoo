"""
Gemini Live Vision Service — analyses screenshots in real-time to detect user actions.

The user shares their screen via the browser Screen Capture API.  The frontend
captures a frame every few seconds and POSTs it here.  We feed each frame —
together with the history of previously detected events — into Gemini's
multimodal vision model and return any newly detected interactions.
"""

from __future__ import annotations

import base64
import json
import logging

from app.core.config import get_settings

logger = logging.getLogger(__name__)
ALLOWED_CAPTURE_EVENT_KINDS = {'navigate', 'click', 'input', 'submit', 'verify', 'wait', 'action'}

# ── Prompt ───────────────────────────────────────────────────────────────────

VISION_PROMPT = """You are an expert workflow analyst watching a user's screen in real-time.

Your job is to detect meaningful browser/application interactions:
- Page navigations (new URL loaded)
- Clicks on buttons, links, menu items
- Text inputs being filled in forms
- Form submissions
- Page state changes (modals appearing, content updating)

Context — actions already detected so far in this session:
{previous_events}

Analyse the screenshot and determine whether the user has performed a NEW
action that differs from the most recent detected action above.

If a new action is visible, respond with:
{{
  "detected": true,
  "events": [
    {{
      "kind": "<navigate|click|input|submit|verify|wait>",
      "url": "<URL visible in the address bar, if any>",
      "selector": "<human-readable description of the UI element, e.g. 'Login button', '#email-input'>",
      "value": "<value being typed or selected, if applicable>",
      "text": "<one-line human-readable description of the action>"
    }}
  ]
}}

If there is NO new meaningful action (same screen as before, nothing changed), respond with:
{{
  "detected": false,
  "events": []
}}

Rules:
1. Only report GENUINELY NEW actions — never repeat the last detected action.
2. Focus on meaningful business interactions; ignore mouse movements or scroll alone.
3. If the screenshot shows a form being filled, identify which field is active.
4. When the URL bar is visible, always include it.
5. Prefer descriptive selectors ("Submit button", "Email field") over raw CSS selectors.
6. If multiple small actions happened at once, you may return more than one event.

Respond ONLY with valid JSON. No markdown, no code fences, no explanation."""


async def analyse_frame(
    image_b64: str,
    previous_events: list[dict],
    mime_type: str = 'image/jpeg',
) -> dict:
    """Send a screenshot frame to Gemini Vision and return detected events.

    Args:
        image_b64: Base64-encoded screenshot (JPEG or PNG).
        previous_events: List of events already detected in this session.
        mime_type: MIME type of the image (default: image/jpeg).

    Returns:
        dict with keys ``detected`` (bool) and ``events`` (list[dict]).
    """
    settings = get_settings()

    if not settings.google_api_key:
        logger.warning('GOOGLE_API_KEY not set — returning empty analysis')
        return {'detected': False, 'events': []}

    # Format previous events for context
    if previous_events:
        prev_summary = '\n'.join(
            f"  {i + 1}. [{e.get('kind', '?')}] {e.get('text', e.get('url', 'unknown'))}"
            for i, e in enumerate(previous_events[-10:])  # last 10 for context window
        )
    else:
        prev_summary = '  (none — this is the first frame)'

    prompt = VISION_PROMPT.format(previous_events=prev_summary)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.google_api_key)

        image_bytes = base64.b64decode(image_b64)

        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=[
                types.Content(
                    parts=[
                        types.Part.from_text(text=prompt),
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    ]
                )
            ],
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
            ),
        )

        text = response.text.strip()

        # Strip markdown fences if present
        if text.startswith('```'):
            text = text.split('\n', 1)[1]
            if text.endswith('```'):
                text = text[:-3].strip()

        result = json.loads(text)

        if not isinstance(result, dict):
            logger.error('Gemini Vision returned non-dict — ignoring')
            return {'detected': False, 'events': []}

        # Normalise events
        events = result.get('events', [])
        normalised = []
        for ev in events:
            kind = ev.get('kind', 'action')
            if kind not in ALLOWED_CAPTURE_EVENT_KINDS:
                continue
            normalised.append({
                'kind': kind,
                'url': ev.get('url'),
                'selector': ev.get('selector'),
                'value': ev.get('value'),
                'text': ev.get('text', ''),
            })

        return {
            'detected': result.get('detected', len(normalised) > 0),
            'events': normalised,
        }

    except ImportError:
        logger.warning('google-genai not installed — returning empty')
        return {'detected': False, 'events': []}
    except json.JSONDecodeError as e:
        logger.error(f'Gemini Vision returned invalid JSON: {e}')
        return {'detected': False, 'events': []}
    except Exception as e:
        logger.error(f'Gemini Vision failed: {e}')
        return {'detected': False, 'events': []}
