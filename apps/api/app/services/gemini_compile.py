"""
Gemini Compile Service — transforms raw capture events into semantic playbook steps.

This is the central Gemini integration point. Given raw browser interaction events
recorded during a Teach session, it produces structured, human-readable playbook
steps with automatic variable detection and guardrails.
"""

from __future__ import annotations

import json
import logging

from app.core.config import get_settings

logger = logging.getLogger(__name__)
NON_ACTION_EVENT_KINDS = {'voice_note', 'gemini_clarification'}

COMPILE_PROMPT = """You are an expert workflow analyst. Given the following raw browser interaction events
recorded during a user session, produce a structured list of semantic playbook steps.

The event stream may include:
- grounded visual actions from the screen observer (`navigate`, `click`, `input`, `submit`, `verify`, `wait`, `scroll`, `action`)
- `voice_note` entries spoken by the user during Teach Mode
- `gemini_clarification` entries spoken by the Memoo Navigator voice assistant

Use `voice_note` and `gemini_clarification` entries as context, but NEVER output
them as standalone steps. They should influence step titles, variable detection,
and guardrails only when relevant.

For each step, output:
- title: A clear, human-readable description of the action (e.g. "Fill in employee first name")
- step_type: One of navigate, click, input, submit, verify, wait, scroll, action
- target_url: The URL involved, if applicable
- selector: CSS selector or element identifier, if applicable
- variables: A dict of variable_name -> template_string for values that should be parameterized
  across different runs (e.g. {"first_name": "{{first_name}}", "email": "{{email}}"}).
  Detect which values are likely to change between runs (names, emails, IDs) vs constants.
- guardrails: A dict with optional "verify" key describing the expected state after this step

Important rules:
1. Transform raw low-level events into meaningful business-level steps
2. Detect variables automatically — anything that looks like personal data, names, emails, 
   IDs, or user-specific values should become a {{variable}}
3. Merge consecutive related events into single logical steps when appropriate
4. Add verification guardrails where they make sense (after form submissions, page navigations)
5. Keep step titles professional and clear
6. When visual events contain grounded `observed_text`, `confidence`, or `evidence`, prefer
   those visible details over assumptions
7. If the user explicitly states a constraint in a `voice_note` (for example "double-check the
   company email domain"), incorporate that into the most relevant step guardrail

Respond ONLY with a valid JSON array. No markdown, no explanation.

Raw events:
{events_json}
"""


def _short_title(value: object, fallback: str, max_len: int = 220) -> str:
    if not isinstance(value, str):
        return fallback
    text = ' '.join(value.split()).strip()
    if not text:
        return fallback
    if len(text) <= max_len:
        return text
    return f'{text[: max_len - 3].rstrip()}...'


async def compile_events(raw_events: list[dict]) -> list[dict]:
    """Call Gemini to compile raw capture events into semantic playbook steps."""
    settings = get_settings()

    if not settings.google_api_key:
        logger.warning('GOOGLE_API_KEY not set — using fallback compiler')
        return _fallback_compile(raw_events)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.google_api_key)

        events_json = json.dumps(raw_events, indent=2)
        prompt = COMPILE_PROMPT.format(events_json=events_json)

        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
            ),
        )

        text = response.text.strip()
        # Strip markdown code fences if present
        if text.startswith('```'):
            text = text.split('\n', 1)[1]
            if text.endswith('```'):
                text = text[:-3].strip()

        steps = json.loads(text)

        if not isinstance(steps, list):
            logger.error('Gemini returned non-list response, using fallback')
            return _fallback_compile(raw_events)

        # Normalize step structure
        normalized = []
        for step in steps:
            normalized.append({
                'title': step.get('title', 'Untitled step'),
                'step_type': step.get('step_type', 'action'),
                'target_url': step.get('target_url'),
                'selector': step.get('selector'),
                'variables': step.get('variables', {}),
                'guardrails': step.get('guardrails', {}),
            })

        return normalized

    except ImportError:
        logger.warning('google-genai not installed — using fallback compiler')
        return _fallback_compile(raw_events)
    except Exception as e:
        logger.error(f'Gemini compile failed: {e} — using fallback compiler')
        return _fallback_compile(raw_events)


def _fallback_compile(raw_events: list[dict]) -> list[dict]:
    """Simple rule-based compiler for when Gemini is unavailable."""
    steps = []
    for idx, event in enumerate(raw_events):
        kind = event.get('kind', 'action')
        if kind in NON_ACTION_EVENT_KINDS:
            continue
        step: dict = {
            'step_type': kind,
            'target_url': event.get('url'),
            'selector': event.get('selector'),
            'variables': {},
            'guardrails': {},
        }

        if kind == 'navigate':
            step['title'] = f'Navigate to {event.get("url", "page")}'
            step['guardrails'] = {'verify': 'Page loaded successfully'}
        elif kind == 'click':
            step['title'] = f'Click "{event.get("text", event.get("selector", "element"))}"'
        elif kind == 'input':
            value = event.get('value', '')
            var_name = _guess_variable_name(event.get('selector', ''), value)
            step['title'] = f'Fill in {var_name.replace("_", " ")}'
            step['variables'] = {var_name: f'{{{{{var_name}}}}}'}
        elif kind == 'submit':
            step['title'] = f'Submit form'
            step['guardrails'] = {'verify': 'Form submitted successfully'}
        elif kind == 'scroll':
            step['title'] = _short_title(event.get('text'), 'Scroll the page')
        elif kind == 'verify':
            step['title'] = f'Verify: {event.get("text", "expected state")}'
            step['guardrails'] = {'verify': event.get('text', '')}
        else:
            step['title'] = _short_title(event.get('text'), f'Step {idx + 1}')

        steps.append(step)

    return steps


def _guess_variable_name(selector: str | None, value: str | None) -> str:
    """Guess a variable name from the selector or value."""
    selector = selector or ''
    value = value or ''
    sel_lower = selector.lower()

    if 'email' in sel_lower:
        return 'email'
    if 'first' in sel_lower and 'name' in sel_lower:
        return 'first_name'
    if 'last' in sel_lower and 'name' in sel_lower:
        return 'last_name'
    if 'name' in sel_lower:
        return 'full_name'
    if 'phone' in sel_lower:
        return 'phone'
    if 'department' in sel_lower:
        return 'department'
    if 'title' in sel_lower or 'role' in sel_lower:
        return 'job_title'
    if 'password' in sel_lower:
        return 'password'

    # Try to extract from selector ID
    for part in selector.replace('#', '').replace('.', ' ').replace('-', '_').split():
        if len(part) > 2:
            return part

    return 'value'
