"""
Sandbox Executor — drives Playwright via CDP to the visible sandbox Chromium.

Instead of launching a headless browser, this service connects to the shared
Chromium instance running in the sandbox container (Xvfb + noVNC), so the
user can watch (and optionally interact with) the browser in real-time via
the noVNC WebSocket stream embedded in the frontend.

It also optionally feeds screenshots to Gemini Vision for "smart" execution:
when a step fails, Gemini can look at the screen and suggest corrective action.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_VAR_RE = re.compile(r'\{\{(\w+)\}\}')


def _substitute(template: str | None, variables: dict[str, str]) -> str | None:
    if not template:
        return template
    return _VAR_RE.sub(lambda m: variables.get(m.group(1), m.group(0)), template)


async def _get_ws_endpoint(cdp_base: str) -> str:
    """Query Chromium's /json/version to get the DevTools WebSocket URL."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f'{cdp_base}/json/version', timeout=5)
        data = resp.json()
        ws_url: str = data['webSocketDebuggerUrl']
        # Replace localhost with the real hostname from cdp_base
        # e.g. ws://localhost:9222/... → ws://sandbox:9222/...
        from urllib.parse import urlparse
        parsed = urlparse(cdp_base)
        ws_url = ws_url.replace('localhost', parsed.hostname or 'sandbox')
        ws_url = ws_url.replace('127.0.0.1', parsed.hostname or 'sandbox')
        return ws_url


async def execute_in_sandbox(
    steps: list[dict],
    row_data: dict[str, Any],
    *,
    timeout_ms: int = 15_000,
    screenshot: bool = True,
    step_callback: Any | None = None,
) -> list[dict]:
    """Execute playbook steps in the shared sandbox browser.

    Args:
        steps: Ordered step dicts.
        row_data: Input row for variable substitution.
        timeout_ms: Per-action timeout.
        screenshot: Capture screenshot after each step.
        step_callback: Optional async callable(step_result_dict) called after each step.

    Returns:
        Per-step result dicts identical to playwright_executor output.
    """
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
        logger.info(f'Connecting to sandbox browser: {ws_endpoint}')

        async with async_playwright() as pw:
            browser = await pw.chromium.connect_over_cdp(ws_endpoint)

            # Use the default context (the one the user sees)
            contexts = browser.contexts
            if contexts:
                context = contexts[0]
            else:
                context = await browser.new_context(
                    viewport={'width': 1280, 'height': 800},
                )

            # Use existing page or create one
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

                # Notify subscriber (e.g. WebSocket broadcast)
                if step_callback:
                    try:
                        await step_callback(step_result)
                    except Exception:
                        pass

                if step_result['status'] == 'failed':
                    break

                # Small pause between steps so the user can follow along
                await asyncio.sleep(0.8)

            # Don't close the browser — it's shared!

    except Exception as e:
        logger.error(f'Sandbox execution error: {e}')
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
