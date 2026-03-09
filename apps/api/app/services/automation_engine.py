from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import or_, select, update

from app.db.session import SessionLocal
from app.models.entities import (
    AutomationTriggerType,
    Playbook,
    PlaybookAutomation,
)
from app.services.run_engine import create_run_record, enqueue_run_execution

logger = logging.getLogger(__name__)

SCHEDULER_POLL_SECONDS = 10
SCHEDULER_BATCH_SIZE = 20
LOCK_STALE_MINUTES = 30
_scheduler_task: asyncio.Task | None = None


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _next_run_at(interval_minutes: int, now: datetime | None = None) -> datetime:
    base = now or _utcnow()
    return base + timedelta(minutes=interval_minutes)


def _default_input_rows(rows: list[dict] | None) -> list[dict]:
    data = list(rows or [])
    return data if data else [{}]


async def _run_claimed_automation(
    automation_id: str,
    *,
    reason: str,
    input_rows_override: list[dict] | None = None,
    input_source_override: str | None = None,
    use_sandbox_override: bool | None = None,
) -> str:
    async with SessionLocal() as db:
        automation = await db.get(PlaybookAutomation, automation_id)
        if not automation:
            raise HTTPException(status_code=404, detail='Automation not found.')

        now = _utcnow()
        run_id: str | None = None

        try:
            playbook = await db.get(Playbook, automation.playbook_id)
            if not playbook or playbook.team_id != automation.team_id:
                raise HTTPException(
                    status_code=400,
                    detail='Automation playbook is invalid for this team.',
                )

            input_rows = _default_input_rows(
                input_rows_override if input_rows_override is not None else automation.input_rows
            )
            input_source = (
                input_source_override
                if input_source_override is not None
                else (automation.input_source or f'automation:{reason}')
            )
            use_sandbox = (
                use_sandbox_override
                if use_sandbox_override is not None
                else automation.use_sandbox
            )

            run = await create_run_record(
                db,
                team_id=automation.team_id,
                playbook_id=automation.playbook_id,
                input_rows=input_rows,
                input_source=input_source,
                selected_vault_credential_ids=automation.selected_vault_credential_ids,
                use_sandbox=use_sandbox,
                trigger_type=f'automation_{reason}',
            )
            enqueue_run_execution(run.id)
            run_id = run.id

            automation.last_run_id = run.id
            automation.last_run_at = now
            automation.last_error = None
        except Exception as e:
            automation.last_error = str(e)[:1500]
            if isinstance(e, HTTPException) and e.status_code == 400:
                automation.enabled = False
            logger.exception('Automation run failed automation_id=%s', automation_id)
            raise
        finally:
            if (
                automation.trigger_type == AutomationTriggerType.INTERVAL
                and automation.interval_minutes
                and automation.enabled
            ):
                automation.next_run_at = _next_run_at(automation.interval_minutes, now)
            automation.is_running = False
            automation.updated_at = _utcnow()
            await db.commit()

        return run_id or ''


async def trigger_automation_now(
    automation_id: str,
    *,
    reason: str = 'manual',
    input_rows_override: list[dict] | None = None,
    input_source_override: str | None = None,
    use_sandbox_override: bool | None = None,
) -> str:
    now = _utcnow()
    stale_cutoff = now - timedelta(minutes=LOCK_STALE_MINUTES)
    async with SessionLocal() as db:
        claimed = await db.execute(
            update(PlaybookAutomation)
            .where(
                PlaybookAutomation.id == automation_id,
                or_(
                    PlaybookAutomation.is_running.is_(False),
                    PlaybookAutomation.updated_at < stale_cutoff,
                ),
            )
            .values(is_running=True, updated_at=now)
        )
        await db.commit()
        if claimed.rowcount == 0:
            raise HTTPException(status_code=409, detail='Automation is already running.')

    return await _run_claimed_automation(
        automation_id,
        reason=reason,
        input_rows_override=input_rows_override,
        input_source_override=input_source_override,
        use_sandbox_override=use_sandbox_override,
    )


async def trigger_webhook_now(
    webhook_token: str,
    *,
    input_rows_override: list[dict] | None = None,
    input_source_override: str | None = None,
    use_sandbox_override: bool | None = None,
) -> str:
    async with SessionLocal() as db:
        automation = await db.scalar(
            select(PlaybookAutomation).where(PlaybookAutomation.webhook_token == webhook_token)
        )
        if not automation:
            raise HTTPException(status_code=404, detail='Automation webhook not found.')
        if not automation.enabled:
            raise HTTPException(status_code=409, detail='Automation is disabled.')
        automation_id = automation.id

    return await trigger_automation_now(
        automation_id,
        reason='webhook',
        input_rows_override=input_rows_override,
        input_source_override=input_source_override,
        use_sandbox_override=use_sandbox_override,
    )


async def process_due_automations(limit: int = SCHEDULER_BATCH_SIZE) -> None:
    now = _utcnow()
    stale_cutoff = now - timedelta(minutes=LOCK_STALE_MINUTES)

    async with SessionLocal() as db:
        due_ids = list(await db.scalars(
            select(PlaybookAutomation.id)
            .where(
                PlaybookAutomation.enabled.is_(True),
                PlaybookAutomation.trigger_type == AutomationTriggerType.INTERVAL,
                or_(
                    PlaybookAutomation.is_running.is_(False),
                    PlaybookAutomation.updated_at < stale_cutoff,
                ),
                PlaybookAutomation.next_run_at.is_not(None),
                PlaybookAutomation.next_run_at <= now,
            )
            .order_by(PlaybookAutomation.next_run_at.asc())
            .limit(limit)
        ))

        claimed_ids: list[str] = []
        for automation_id in due_ids:
            claimed = await db.execute(
                update(PlaybookAutomation)
                .where(
                    PlaybookAutomation.id == automation_id,
                    or_(
                        PlaybookAutomation.is_running.is_(False),
                        PlaybookAutomation.updated_at < stale_cutoff,
                    ),
                )
                .values(is_running=True, updated_at=now)
            )
            if claimed.rowcount:
                claimed_ids.append(automation_id)
        await db.commit()

    for automation_id in claimed_ids:
        try:
            await _run_claimed_automation(automation_id, reason='interval')
        except Exception:
            # Error already persisted in automation.last_error.
            continue


async def _scheduler_loop() -> None:
    logger.info('Automation scheduler started (poll=%ss)', SCHEDULER_POLL_SECONDS)
    while True:
        try:
            await process_due_automations()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception('Automation scheduler tick failed')
        await asyncio.sleep(SCHEDULER_POLL_SECONDS)


def start_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        return
    _scheduler_task = asyncio.create_task(_scheduler_loop())


async def stop_scheduler() -> None:
    global _scheduler_task
    if not _scheduler_task:
        return
    _scheduler_task.cancel()
    try:
        await _scheduler_task
    except asyncio.CancelledError:
        pass
    _scheduler_task = None
