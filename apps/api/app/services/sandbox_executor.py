"""
Sandbox Executor — drives Playwright via CDP to the visible sandbox Chromium.

The browser itself runs inside the sandbox container (Xvfb + noVNC). This
service connects to that shared Chromium instance so the user can watch the
automation live while autonomous steps are executed by a dedicated Stagehand
service over the same CDP endpoint.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import re
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_VAR_RE = re.compile(r'\{\{(\w+)\}\}')
_HTTP_URL_RE = re.compile(r'https?://[^\s)<>"\']+', re.IGNORECASE)
_BARE_DOMAIN_RE = re.compile(r'\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:/[^\s)<>"\']*)?\b', re.IGNORECASE)
_AUTONOMOUS_STEP_TYPES = {'action', 'autonomous', 'agent_action'}


def _substitute(template: str | None, variables: dict[str, str]) -> str | None:
    if not template:
        return template
    return _VAR_RE.sub(lambda m: variables.get(m.group(1), m.group(0)), template)


async def _get_ws_endpoint(cdp_base: str) -> str:
    """Query Chromium's /json/version to get the DevTools WebSocket URL."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f'{cdp_base}/json/version', timeout=5, headers={"Host": "localhost"})
        data = resp.json()
        ws_url: str = data['webSocketDebuggerUrl']

        from urllib.parse import urlparse

        parsed = urlparse(cdp_base)
        ws_parsed = urlparse(ws_url)
        host = parsed.hostname or 'sandbox'
        port = parsed.port or ws_parsed.port or 9223
        path = ws_parsed.path or '/devtools/browser'
        if ws_parsed.query:
            path = f'{path}?{ws_parsed.query}'
        return f'ws://{host}:{port}{path}'


def _should_use_stagehand(step_type: str) -> bool:
    return step_type in _AUTONOMOUS_STEP_TYPES


def _looks_sensitive_var(name: str, template: str | None) -> bool:
    return name.startswith('vault_') or (template is not None and '{{vault_' in template)


def _agent_start_url(row_data: dict[str, Any], fallback_target_url: str | None = None) -> str | None:
    explicit = str(row_data.get('agent_start_url') or '').strip()
    if explicit:
        return explicit

    if fallback_target_url:
        return fallback_target_url

    brief = str(row_data.get('agent_brief') or '').strip()
    if not brief:
        return None

    match = _HTTP_URL_RE.search(brief)
    if match:
        return match.group(0).rstrip('.,)')

    domain_match = _BARE_DOMAIN_RE.search(brief)
    if domain_match:
        return f'https://{domain_match.group(0).rstrip(".,)")}'

    return None


def _build_autonomous_task(
    *,
    title: str,
    expected: str,
    target_url: str | None,
    selector: str | None,
    resolved_values: dict[str, str],
    row_data: dict[str, Any],
    step: dict[str, Any],
) -> str:
    parts = [
        'You are executing one autonomous Memoo browser step inside the current sandbox tab.',
        f'Primary goal: {title}',
    ]

    if target_url:
        parts.append(f'Start from this page when relevant: {target_url}')
    if selector:
        parts.append(f'CSS selector hint from the playbook: {selector}')

    guardrails = step.get('guardrails') or {}
    expected_text = guardrails.get('expected_text')
    if expected:
        parts.append(f'Done condition: {expected}')
    if expected_text:
        parts.append(f'Expected text after completion: {expected_text}')

    agent_brief = str(row_data.get('agent_brief') or '').strip()
    if agent_brief:
        parts.append(f'User context for this run:\n{agent_brief}')

    attachments_manifest = str(row_data.get('agent_attachments_manifest') or '').strip()
    if attachments_manifest:
        parts.append(f'Attached material:\n{attachments_manifest}')

    context_text = str(row_data.get('agent_context_text') or '').strip()
    if context_text:
        parts.append(f'Useful text extracted from attachments:\n{context_text}')

    safe_values = {
        key: value
        for key, value in resolved_values.items()
        if value and not _looks_sensitive_var(key, step.get('variables', {}).get(key))
    }
    if safe_values:
        rendered_values = '\n'.join(f'- {key}: {value}' for key, value in safe_values.items())
        parts.append(f'Use these step inputs if relevant:\n{rendered_values}')

    parts.append(
        'Rules: operate only in the current tab, prefer visible controls, avoid destructive '
        'actions unless they are explicitly required by the goal, and stop once the goal is done '
        'with a concise result.'
    )
    return '\n\n'.join(parts)


async def _run_stagehand_step(
    settings: Any,
    *,
    ws_endpoint: str,
    task: str,
    start_url: str | None,
) -> dict[str, Any]:
    if not settings.stagehand_service_url:
        raise RuntimeError('Stagehand service URL is not configured.')
    if not settings.stagehand_model:
        raise RuntimeError('Stagehand model is not configured.')

    payload = {
        'cdpUrl': ws_endpoint,
        'instruction': task,
        'startUrl': start_url,
        'modelName': settings.stagehand_model,
        'maxSteps': settings.stagehand_max_steps,
        'waitBetweenActionsMs': settings.stagehand_wait_between_actions_ms,
        'highlightCursor': settings.stagehand_highlight_cursor,
        'navigationTimeoutMs': settings.stagehand_navigation_timeout_ms,
    }

    timeout = httpx.Timeout(settings.stagehand_request_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(f'{settings.stagehand_service_url}/execute', json=payload)

    if response.is_success:
        return response.json()

    detail = None
    try:
        error_payload = response.json()
        detail = error_payload.get('error') or error_payload.get('detail')
    except Exception:
        detail = response.text

    raise RuntimeError(detail or f'Stagehand service returned HTTP {response.status_code}.')


async def _verify_autonomous_outcome(
    page: Any,
    *,
    selector: str | None,
    expected_text: str | None,
    timeout_ms: int,
) -> None:
    if selector:
        await page.wait_for_selector(selector, timeout=timeout_ms)
    if expected_text:
        await page.wait_for_function(
            '(text) => document.body && document.body.innerText.includes(text)',
            arg=expected_text,
            timeout=timeout_ms,
        )


def _format_stagehand_summary(result: dict[str, Any]) -> str:
    actions = result.get('actions') or []
    labels: list[str] = []
    for action in actions[-3:]:
        if not isinstance(action, dict):
            continue
        label = action.get('type') or action.get('action') or action.get('instruction')
        if label:
            labels.append(str(label))

    actions_text = ', '.join(labels) if labels else 'no actions recorded'
    message = str(result.get('message') or 'task completed').strip()
    return f'Stagehand: {message} (actions: {actions_text})'


async def execute_in_sandbox(
    steps: list[dict],
    row_data: dict[str, Any],
    *,
    timeout_ms: int = 15_000,
    screenshot: bool = True,
    step_callback: Any | None = None,
) -> list[dict]:
    """Execute playbook steps in the shared sandbox browser."""
    settings = get_settings()

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.warning('playwright not installed — falling back to simulation')
        from app.services.playwright_executor import _simulate_steps
        return await _simulate_steps(steps, row_data)

    results: list[dict] = []

    try:
        ws_endpoint = await _get_ws_endpoint(settings.sandbox_cdp_url)
        logger.info('Connecting to sandbox browser: %s', ws_endpoint)

        async with async_playwright() as pw:
            browser = await pw.chromium.connect_over_cdp(ws_endpoint)

            contexts = browser.contexts
            if contexts:
                context = contexts[0]
            else:
                context = await browser.new_context(viewport={'width': 1280, 'height': 800})

            pages = context.pages
            page = pages[0] if pages else await context.new_page()
            page.set_default_timeout(timeout_ms)

            for step in steps:
                seq = step.get('sequence', 0)
                title = step.get('title', f'Step {seq}')
                step_type = step.get('step_type', 'action')
                target_url = _substitute(step.get('target_url'), row_data)
                selector = _substitute(step.get('selector'), row_data)
                variables = step.get('variables', {})

                resolved_values: dict[str, str] = {}
                for var_name, template in variables.items():
                    if isinstance(template, str):
                        resolved_values[var_name] = _substitute(template, row_data) or ''

                expected = step.get('guardrails', {}).get('verify', f'{title} completed')
                screenshot_b64: str | None = None

                try:
                    autonomous_target_url = _agent_start_url(row_data, target_url)

                    if step_type == 'navigate':
                        if target_url:
                            await page.goto(target_url, wait_until='domcontentloaded')
                        actual = f'Navigated to {page.url}'

                    elif step_type == 'click':
                        if selector:
                            await page.click(selector)
                        actual = f'Clicked {selector or "element"}'

                    elif step_type == 'input':
                        if selector and resolved_values:
                            value = next(iter(resolved_values.values()), '')
                            await page.fill(selector, value)
                            actual = f'Filled {selector} with value'
                        else:
                            actual = 'Input step skipped (no selector or value)'

                    elif step_type == 'submit':
                        if selector:
                            await page.click(selector)
                        else:
                            await page.keyboard.press('Enter')
                        await asyncio.sleep(0.5)
                        actual = 'Form submitted'

                    elif step_type == 'verify':
                        if selector:
                            await page.wait_for_selector(selector, timeout=timeout_ms)
                            actual = f'Verified {selector} is present'
                        else:
                            actual = expected or 'Verification passed'

                    elif step_type == 'wait':
                        wait_secs = float(step.get('variables', {}).get('seconds', 2))
                        await asyncio.sleep(wait_secs)
                        actual = f'Waited {wait_secs}s'

                    elif _should_use_stagehand(step_type):
                        if not settings.stagehand_enabled:
                            raise RuntimeError('Stagehand autonomous execution is disabled.')

                        if autonomous_target_url and page.url != autonomous_target_url:
                            await page.goto(autonomous_target_url, wait_until='domcontentloaded')

                        task = _build_autonomous_task(
                            title=title,
                            expected=expected,
                            target_url=autonomous_target_url,
                            selector=selector,
                            resolved_values=resolved_values,
                            row_data=row_data,
                            step=step,
                        )
                        agent_result = await _run_stagehand_step(
                            settings,
                            ws_endpoint=ws_endpoint,
                            task=task,
                            start_url=None,
                        )

                        await _verify_autonomous_outcome(
                            page,
                            selector=selector,
                            expected_text=step.get('guardrails', {}).get('expected_text'),
                            timeout_ms=timeout_ms,
                        )

                        actual = _format_stagehand_summary(agent_result)
                        if not agent_result.get('success', False) or not agent_result.get('completed', False):
                            raise RuntimeError(actual)

                    else:
                        actual = f'Action "{step_type}" executed'

                    if screenshot:
                        png_bytes = await page.screenshot(type='png')
                        screenshot_b64 = base64.b64encode(png_bytes).decode()

                    step_result = {
                        'sequence': seq,
                        'title': title,
                        'status': 'success',
                        'expected_state': expected,
                        'actual_state': actual,
                        'screenshot_b64': screenshot_b64,
                    }

                except Exception as e:
                    if screenshot:
                        try:
                            png_bytes = await page.screenshot(type='png')
                            screenshot_b64 = base64.b64encode(png_bytes).decode()
                        except Exception:
                            pass

                    step_result = {
                        'sequence': seq,
                        'title': title,
                        'status': 'failed',
                        'expected_state': expected,
                        'actual_state': str(e),
                        'screenshot_b64': screenshot_b64,
                    }

                results.append(step_result)

                if step_callback:
                    try:
                        await step_callback(step_result)
                    except Exception:
                        pass

                if step_result['status'] == 'failed':
                    break

                await asyncio.sleep(0.8)

    except Exception as e:
        logger.error('Sandbox execution error: %s', e)
        for step in steps[len(results):]:
            results.append({
                'sequence': step.get('sequence', 0),
                'title': step.get('title', 'Unknown'),
                'status': 'failed',
                'expected_state': '',
                'actual_state': f'Sandbox error: {e}',
                'screenshot_b64': None,
            })

    return results
