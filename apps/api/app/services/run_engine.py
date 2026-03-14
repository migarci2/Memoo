from __future__ import annotations

import asyncio
import logging
import re
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import SessionLocal
from app.models.entities import (
    Playbook,
    PlaybookVersion,
    Run,
    RunEvent,
    RunItem,
    RunStatus,
    Team,
    VaultCredential,
)

logger = logging.getLogger(__name__)
_VAR_RE = re.compile(r'\{\{(\w+)\}\}')


def vault_template_key(name: str) -> str:
    cleaned = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
    return f'vault_{cleaned or "credential"}'


def _extract_step_tokens(step: dict) -> set[str]:
    tokens: set[str] = set()
    for field in (step.get('target_url'), step.get('selector')):
        if isinstance(field, str):
            tokens.update(_VAR_RE.findall(field))

    variables = step.get('variables') or {}
    if isinstance(variables, dict):
        for value in variables.values():
            if isinstance(value, str):
                tokens.update(_VAR_RE.findall(value))
    return tokens


def _build_direct_agent_steps(row_data: dict) -> list[dict]:
    brief = str((row_data or {}).get('agent_brief') or '').strip()
    if not brief:
        raise HTTPException(
            status_code=400,
            detail='Browser agent runs require a non-empty agent_brief.',
        )

    return [{
        'sequence': 1,
        'title': brief[:220],
        'step_type': 'action',
        'target_url': None,
        'selector': None,
        'variables': {},
        'guardrails': {'verify': 'User goal completed'},
    }]


async def create_run_record(
    db: AsyncSession,
    *,
    team_id: str,
    playbook_id: str | None,
    input_rows: list[dict],
    input_source: str | None,
    selected_vault_credential_ids: list[str] | None,
    use_sandbox: bool,
    trigger_type: str = 'csv_batch',
) -> Run:
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail='Team not found.')

    selected_ids = list(dict.fromkeys(selected_vault_credential_ids or []))
    if selected_ids:
        rows = list(await db.scalars(
            select(VaultCredential).where(
                VaultCredential.team_id == team_id,
                VaultCredential.id.in_(selected_ids),
            )
        ))
        if len(rows) != len(set(selected_ids)):
            raise HTTPException(status_code=400, detail='Some selected vault credentials are invalid.')

    playbook: Playbook | None = None
    if playbook_id:
        playbook = await db.scalar(
            select(Playbook)
            .where(Playbook.id == playbook_id)
            .options(selectinload(Playbook.versions).selectinload(PlaybookVersion.steps))
        )
        if not playbook:
            raise HTTPException(status_code=404, detail='Playbook not found.')
        if playbook.team_id != team_id:
            raise HTTPException(status_code=400, detail='Playbook does not belong to this team.')
    else:
        has_agent_brief = any(str((row or {}).get('agent_brief') or '').strip() for row in input_rows)
        if not has_agent_brief:
            raise HTTPException(
                status_code=400,
                detail='Select a playbook or provide instructions for the browser agent.',
            )

    latest_version = None
    if playbook and playbook.versions:
        latest_version = sorted(playbook.versions, key=lambda v: v.version_number)[-1]

    run = Run(
        team_id=team_id,
        playbook_id=playbook.id if playbook else None,
        playbook_version_id=latest_version.id if latest_version else None,
        status=RunStatus.PENDING,
        trigger_type=trigger_type,
        input_source=input_source,
        total_items=len(input_rows),
        selected_vault_credential_ids=selected_ids,
        use_sandbox=use_sandbox,
    )
    db.add(run)
    await db.flush()

    for idx, row_data in enumerate(input_rows):
        item = RunItem(
            run_id=run.id,
            row_index=idx,
            input_payload=row_data,
            status=RunStatus.PENDING,
        )
        db.add(item)

    await db.commit()
    await db.refresh(run)
    return run


def enqueue_run_execution(run_id: str) -> None:
    asyncio.create_task(execute_run(run_id))


async def execute_run(run_id: str) -> None:
    """Execute a run using Playwright (sandbox or headless)."""
    from app.services.playwright_executor import execute_playbook_steps
    from app.services.sandbox_executor import execute_in_sandbox

    await asyncio.sleep(0.5)  # let HTTP response flush first

    async with SessionLocal() as db:
        run = await db.scalar(
            select(Run).where(Run.id == run_id).options(selectinload(Run.items))
        )
        if not run:
            return

        try:
            # Load playbook steps if this run is bound to a playbook.
            playbook_steps: list[dict] = []
            if run.playbook_version_id:
                version = await db.scalar(
                    select(PlaybookVersion)
                    .where(PlaybookVersion.id == run.playbook_version_id)
                    .options(selectinload(PlaybookVersion.steps))
                )
                if version:
                    for s in sorted(version.steps, key=lambda s: s.sequence):
                        playbook_steps.append({
                            'sequence': s.sequence,
                            'title': s.title,
                            'step_type': s.step_type,
                            'target_url': s.target_url,
                            'selector': s.selector,
                            'variables': s.variables or {},
                            'guardrails': s.guardrails or {},
                        })

            # Load vault credentials for context
            selected_ids = list(run.selected_vault_credential_ids or [])
            selected_creds = list(await db.scalars(
                select(VaultCredential).where(
                    VaultCredential.team_id == run.team_id,
                    VaultCredential.id.in_(selected_ids),
                )
            )) if selected_ids else []
            if selected_ids and len(selected_creds) != len(set(selected_ids)):
                run.status = RunStatus.FAILED
                run.ended_at = datetime.now(UTC)
                await db.commit()
                return

            vault_values_by_key: dict[str, str] = {}
            vault_name_by_key: dict[str, str] = {}
            for cred in selected_creds:
                key = vault_template_key(cred.name)
                secret_value = cred.encrypted_value or ''
                vault_values_by_key[key] = secret_value
                vault_name_by_key[key] = cred.name

            step_credential_usage: dict[int, set[str]] = {}
            if vault_name_by_key and playbook_steps:
                for step in playbook_steps:
                    seq = int(step.get('sequence') or 0)
                    used_names = {
                        vault_name_by_key[token]
                        for token in _extract_step_tokens(step)
                        if token in vault_name_by_key
                    }
                    if used_names:
                        step_credential_usage[seq] = used_names

            run.status = RunStatus.RUNNING
            run.started_at = datetime.now(UTC)
            await db.commit()

            success_count = 0
            failed_count = 0

            for item in sorted(run.items, key=lambda i: i.row_index):
                item.status = RunStatus.RUNNING
                item.started_at = datetime.now(UTC)
                await db.commit()

                row_data = dict(item.input_payload or {})
                row_data.update(vault_values_by_key)
                steps = playbook_steps or _build_direct_agent_steps(row_data)

                if run.use_sandbox:
                    step_results = await execute_in_sandbox(
                        steps=steps,
                        row_data=row_data,
                        screenshot=True,
                    )
                else:
                    step_results = await execute_playbook_steps(
                        steps=steps,
                        row_data=row_data,
                        headless=True,
                        screenshot=True,
                    )

                item_failed = False
                used_credential_names_for_item: set[str] = set()
                for result in step_results:
                    seq = int(result.get('sequence') or 0)
                    used_names = step_credential_usage.get(seq, set())
                    if used_names:
                        used_credential_names_for_item.update(used_names)
                    vault_used = ', '.join(sorted(used_names)) if used_names else None

                    event = RunEvent(
                        run_item_id=item.id,
                        step_sequence=result['sequence'],
                        step_title=result['title'],
                        status=result['status'],
                        expected_state=result.get('expected_state', ''),
                        actual_state=result.get('actual_state', ''),
                        vault_credential_used=vault_used,
                        # screenshot_url can be set after uploading to MinIO
                    )
                    db.add(event)

                    if result['status'] == 'failed':
                        item_failed = True

                if selected_creds and playbook_steps and not used_credential_names_for_item:
                    item_failed = True
                    db.add(RunEvent(
                        run_item_id=item.id,
                        step_sequence=999,
                        step_title='Vault credential usage validation',
                        status='failed',
                        expected_state='At least one selected vault credential must be referenced.',
                        actual_state='No {{vault_*}} placeholder from selected credentials was used by this playbook.',
                        vault_credential_used=None,
                    ))

                item.status = RunStatus.FAILED if item_failed else RunStatus.COMPLETED
                item.ended_at = datetime.now(UTC)
                await db.commit()

                if item_failed:
                    failed_count += 1
                else:
                    success_count += 1

            run.status = RunStatus.COMPLETED
            run.success_count = success_count
            run.failed_count = failed_count
            run.ended_at = datetime.now(UTC)
            await db.commit()
        except Exception as e:
            logger.exception('Run execution failed for run_id=%s: %s', run_id, e)
            run.status = RunStatus.FAILED
            run.ended_at = datetime.now(UTC)
            await db.commit()
