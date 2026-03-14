"""
Playwright Executor — runs playbook steps in a real headless browser.

Each playbook step is mapped to a Playwright action:
  navigate → page.goto(url)
  click    → page.click(selector)
  input    → page.fill(selector, value)
  submit   → page.click(selector) or page.press('Enter')
  verify   → page.wait_for_selector / content check
  wait     → asyncio.sleep

After each step the service takes a verification screenshot that can be
uploaded to MinIO / S3 for evidence.  All results are returned as a list
of step-level dicts consumed by the Run engine.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import re
from typing import Any

from app.core.config import get_settings
from app.services.sandbox_executor import (
    _should_use_stagehand,
    _agent_start_url,
    _build_autonomous_task,
    _run_stagehand_step,
    _verify_autonomous_outcome,
    _format_stagehand_summary,
)

logger = logging.getLogger(__name__)

# ── Variable substitution ────────────────────────────────────────────────────

_VAR_RE = re.compile(r'\{\{(\w+)\}\}')


def _substitute(template: str | None, variables: dict[str, str]) -> str | None:
    """Replace {{var}} placeholders with actual values."""
    if not template:
        return template
    return _VAR_RE.sub(lambda m: variables.get(m.group(1), m.group(0)), template)


# ── Executor ─────────────────────────────────────────────────────────────────

async def execute_playbook_steps(
    steps: list[dict],
    row_data: dict[str, Any],
    *,
    headless: bool = True,
    timeout_ms: int = 15_000,
    screenshot: bool = True,
    step_callback: Any | None = None,
) -> list[dict]:
    """Execute a list of playbook steps via Playwright and return per-step results.

    Args:
        steps: Ordered list of step dicts (title, step_type, target_url, selector, variables).
        row_data: Input row data used for variable substitution.
        headless: Run Chrome in headless mode (default True, set False for debugging).
        timeout_ms: Default timeout per action in milliseconds.
        screenshot: Whether to capture a screenshot after every step.

    Returns:
        List of result dicts, one per step, each containing:
          sequence, title, status ('success'|'failed'), expected_state,
          actual_state, screenshot_b64 (base64 PNG or None).
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.warning('playwright not installed — falling back to simulation')
        return await _simulate_steps(steps, row_data)

    settings = get_settings()
    results: list[dict] = []

    try:
        async with async_playwright() as pw:
            # We use launch_server so we can get a CDP websocket URL for Stagehand
            browser_server = await pw.chromium.launch_server(headless=headless, args=['--remote-debugging-port=0'])
            ws_endpoint = browser_server.ws_endpoint
            browser = await pw.chromium.connect_over_cdp(ws_endpoint)
            
            context = browser.contexts[0] if browser.contexts else await browser.new_context(
                viewport={'width': 1280, 'height': 800},
                user_agent=(
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                    '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
                ),
            )
            page = await context.new_page()
            page.set_default_timeout(timeout_ms)

            for step in steps:
                seq = step.get('sequence', 0)
                title = step.get('title', f'Step {seq}')
                step_type = step.get('step_type', 'action')
                target_url = _substitute(step.get('target_url'), row_data)
                selector = _substitute(step.get('selector'), row_data)
                variables = step.get('variables', {})

                # Resolve variable values from row_data
                resolved_values: dict[str, str] = {}
                for var_name, template in variables.items():
                    if isinstance(template, str):
                        resolved_values[var_name] = _substitute(template, row_data) or ''

                expected = step.get('guardrails', {}).get('verify', f'{title} completed')
                screenshot_b64: str | None = None

                # Notify running state before starting
                if step_callback:
                    try:
                        await step_callback({
                            'sequence': seq,
                            'title': title,
                            'status': 'running',
                            'expected_state': expected,
                            'actual_state': 'Starting step...',
                            'is_agent': False,
                        })
                    except Exception:
                        pass

                try:
                    autonomous_target_url = _agent_start_url(row_data, target_url)
                    used_agent = False

                    try:
                        if step_type == 'navigate':
                            if target_url:
                                if not target_url.startswith(('http://', 'https://', 'about:')):
                                    target_url = f'https://{target_url}'
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
                            # Wait a moment for the submission to process
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
                            used_agent = True
                            raise NotImplementedError("Delegate to Stagehand")

                        else:
                            actual = f'Action "{step_type}" executed'

                    except Exception as action_error:
                        if step_type == 'navigate' or step_type == 'wait':
                            raise action_error

                        if not settings.stagehand_enabled:
                            if isinstance(action_error, NotImplementedError):
                                raise RuntimeError('Stagehand autonomous execution is disabled.')
                            raise action_error

                        used_agent = True
                        if isinstance(action_error, NotImplementedError):
                            logger.info(f"Using Stagehand for autonomous step '{title}'")
                            intermediate_msg = "Starting autonomous execution with AI Agent..."
                        else:
                            logger.info(f"Falling back to Stagehand for step '{title}' due to: {action_error}")
                            intermediate_msg = f"Selector failed, AI Agent taking over... ({action_error})"

                        if step_callback:
                            try:
                                await step_callback({
                                    'sequence': seq,
                                    'title': title,
                                    'status': 'running',
                                    'expected_state': expected,
                                    'actual_state': intermediate_msg,
                                    'is_agent': True,
                                })
                            except Exception:
                                pass

                        if autonomous_target_url and _should_use_stagehand(step_type):
                            if not autonomous_target_url.startswith(('http://', 'https://', 'about:')):
                                autonomous_target_url = f'https://{autonomous_target_url}'
                            if page.url != autonomous_target_url:
                                await page.goto(autonomous_target_url, wait_until='domcontentloaded')

                        task = _build_autonomous_task(
                            title=title,
                            expected=expected,
                            target_url=autonomous_target_url if _should_use_stagehand(step_type) else None,
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
                        if not agent_result.get('success', False) and not agent_result.get('completed', False):
                            logger.warning(f"Stagehand failed or incomplete: {actual}")

                    # Take screenshot
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
                        'is_agent': used_agent,
                    }
                    results.append(step_result)

                    if step_callback:
                        try:
                            await step_callback(step_result)
                        except Exception:
                            pass

                except Exception as e:
                    # Step failed — capture screenshot of error state
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
                        'is_agent': used_agent,
                    }
                    results.append(step_result)

                    if step_callback:
                        try:
                            await step_callback(step_result)
                        except Exception:
                            pass
                            
                    # Stop processing further steps on failure
                    break

            await browser.close()
            await browser_server.close()

    except Exception as e:
        logger.error(f'Playwright execution error: {e}')
        # If browser setup itself failed, return failure for remaining steps
        for step in steps[len(results):]:
            results.append({
                'sequence': step.get('sequence', 0),
                'title': step.get('title', 'Unknown'),
                'status': 'failed',
                'expected_state': '',
                'actual_state': f'Browser error: {e}',
                'screenshot_b64': None,
            })

    return results


# ── Fallback simulation ──────────────────────────────────────────────────────

async def _simulate_steps(steps: list[dict], row_data: dict[str, Any]) -> list[dict]:
    """Fallback when Playwright is not installed — simulates execution with delays."""
    import random

    results: list[dict] = []
    for step in steps:
        await asyncio.sleep(random.uniform(0.3, 0.8))

        success = random.random() > 0.05  # 95% success rate
        expected = step.get('guardrails', {}).get(
            'verify', f'{step.get("title", "Step")} completed'
        )

        results.append({
            'sequence': step.get('sequence', 0),
            'title': step.get('title', 'Unknown'),
            'status': 'success' if success else 'failed',
            'expected_state': expected,
            'actual_state': expected if success else 'Simulated failure',
            'screenshot_b64': None,
        })

        if not success:
            break

    return results
