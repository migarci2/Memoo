from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass
class NormalizedAction:
    title: str
    step_type: str
    target_url: str | None
    selector: str | None
    variables: dict
    guardrails: dict


class GeminiLiveCaptureService:
    """
    Infrastructure wrapper for Gemini Live capture sessions.

    In production, connect this service to Google's Live API stream. For now, this
    module keeps the session contract stable and provides deterministic fallback
    normalization from incoming browser events.
    """

    def __init__(self, model_name: str) -> None:
        self.model_name = model_name

    def normalize_event(self, event: dict) -> NormalizedAction:
        kind = (event.get('kind') or 'event').lower().strip()
        target = event.get('target')
        value = event.get('value')
        url = event.get('url')

        if kind in {'click', 'tap'}:
            title = f"Click {target or 'element'}"
            step_type = 'click'
        elif kind in {'type', 'input', 'fill'}:
            title = f"Fill {target or 'field'}"
            step_type = 'input'
        elif kind in {'navigate', 'goto'}:
            title = f"Navigate to {url or 'page'}"
            step_type = 'navigate'
        elif kind in {'submit'}:
            title = f"Submit {target or 'form'}"
            step_type = 'submit'
        elif kind in {'select'}:
            title = f"Select value in {target or 'field'}"
            step_type = 'select'
        else:
            title = f"Handle {kind}"
            step_type = 'action'

        return NormalizedAction(
            title=title,
            step_type=step_type,
            target_url=url,
            selector=target,
            variables={'value': value} if value else {},
            guardrails={
                'captured_at': datetime.now(UTC).isoformat(),
                'source': 'gemini-live-fallback-normalizer',
            },
        )
