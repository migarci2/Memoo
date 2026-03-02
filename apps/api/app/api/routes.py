from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.db.session import SessionLocal, get_db
from app.models.entities import (
    CaptureSession,
    CaptureStatus,
    Evidence,
    Invite,
    Membership,
    MembershipRole,
    OnboardingProgress,
    Playbook,
    PlaybookStatus,
    PlaybookStep,
    PlaybookVersion,
    Run,
    RunEvent,
    RunItem,
    RunStatus,
    Team,
    User,
)
from app.schemas.entities import (
    AuthLoginIn,
    AuthLoginOut,
    CaptureEventIn,
    CaptureFinalizeIn,
    CaptureSessionStart,
    DashboardMetrics,
    HealthOut,
    PlaybookCreate,
    PlaybookOut,
    PlaybookVersionCreate,
    RunCreate,
    RunOut,
    TeamBootstrapResponse,
    TeamOnboardingCreate,
    TeamSummary,
    UserSummary,
)
from app.services.gemini_live import GeminiLiveCaptureService

router = APIRouter()
settings = get_settings()
live_service = GeminiLiveCaptureService(model_name=settings.gemini_live_model)


@router.get('/health', response_model=HealthOut)
async def health() -> HealthOut:
    return HealthOut(status='ok', app='memoo-api')


@router.post('/auth/login', response_model=AuthLoginOut)
async def auth_login(payload: AuthLoginIn, db: AsyncSession = Depends(get_db)) -> AuthLoginOut:
    team = await db.scalar(select(Team).where(Team.slug == payload.team_slug.lower()))
    if not team:
        raise HTTPException(status_code=401, detail='Invalid team slug or email.')

    row = await db.execute(
        select(User, Membership.role)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.team_id == team.id, func.lower(User.email) == payload.email.lower())
    )
    found = row.first()
    if not found:
        raise HTTPException(status_code=401, detail='Invalid team slug or email.')

    user, role = found
    return AuthLoginOut(
        team_id=team.id,
        team_slug=team.slug,
        team_name=team.name,
        user_id=user.id,
        full_name=user.full_name,
        role=role.value if hasattr(role, 'value') else str(role),
    )


@router.post('/onboarding/team', response_model=TeamBootstrapResponse)
async def create_team_onboarding(payload: TeamOnboardingCreate, db: AsyncSession = Depends(get_db)) -> TeamBootstrapResponse:
    normalized_slug = payload.team_slug.lower()
    existing_slug = await db.scalar(select(Team).where(Team.slug == normalized_slug))
    if existing_slug:
        raise HTTPException(status_code=409, detail='Team slug already exists.')

    user = await db.scalar(select(User).where(User.email == payload.owner_email.lower()))
    if not user:
        user = User(email=payload.owner_email.lower(), full_name=payload.owner_name, job_title=payload.owner_title)
        db.add(user)
        await db.flush()

    team = Team(name=payload.team_name, slug=normalized_slug, domain=payload.team_domain)
    db.add(team)
    await db.flush()

    membership = Membership(team_id=team.id, user_id=user.id, role=MembershipRole.OWNER)
    db.add(membership)

    progress = OnboardingProgress(
        team_id=team.id,
        owner_user_id=user.id,
        current_step='create_first_playbook',
        completed_steps=['workspace_created'],
    )
    db.add(progress)

    await db.commit()
    await db.refresh(team)
    await db.refresh(user)

    return TeamBootstrapResponse(
        team=TeamSummary.model_validate(team),
        owner=UserSummary.model_validate(user),
        next_step='Create your first playbook from a Gemini Live capture session.',
    )


@router.get('/teams/{team_id}/dashboard', response_model=DashboardMetrics)
async def get_dashboard_metrics(team_id: str, db: AsyncSession = Depends(get_db)) -> DashboardMetrics:
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail='Team not found.')

    active_playbooks = await db.scalar(
        select(func.count()).select_from(Playbook).where(Playbook.team_id == team_id, Playbook.status == PlaybookStatus.ACTIVE)
    )
    draft_playbooks = await db.scalar(
        select(func.count()).select_from(Playbook).where(Playbook.team_id == team_id, Playbook.status == PlaybookStatus.DRAFT)
    )

    since = datetime.now(UTC) - timedelta(days=7)
    runs_last_7 = await db.scalar(
        select(func.count()).select_from(Run).where(Run.team_id == team_id, Run.started_at >= since)
    )

    completed = await db.scalar(
        select(func.count()).select_from(Run).where(Run.team_id == team_id, Run.status == RunStatus.COMPLETED)
    )
    failed = await db.scalar(
        select(func.count()).select_from(Run).where(Run.team_id == team_id, Run.status == RunStatus.FAILED)
    )
    total = (completed or 0) + (failed or 0)
    success_rate = ((completed or 0) / total * 100.0) if total > 0 else 100.0

    return DashboardMetrics(
        team_id=team_id,
        active_playbooks=active_playbooks or 0,
        draft_playbooks=draft_playbooks or 0,
        runs_last_7_days=runs_last_7 or 0,
        success_rate=round(success_rate, 2),
    )


@router.get('/teams/{team_id}/members')
async def list_team_members(team_id: str, db: AsyncSession = Depends(get_db)) -> list[dict]:
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail='Team not found.')

    rows = await db.execute(
        select(User, Membership.role)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.team_id == team_id)
        .order_by(User.full_name)
    )

    return [
        {
            'id': user.id,
            'email': user.email,
            'full_name': user.full_name,
            'job_title': user.job_title,
            'role': role.value if hasattr(role, 'value') else str(role),
        }
        for user, role in rows.all()
    ]


@router.get('/teams/{team_id}/playbooks', response_model=list[PlaybookOut])
async def list_playbooks(team_id: str, db: AsyncSession = Depends(get_db)) -> list[PlaybookOut]:
    records = await db.scalars(select(Playbook).where(Playbook.team_id == team_id).order_by(desc(Playbook.updated_at)))
    return [PlaybookOut.model_validate(playbook, from_attributes=True) for playbook in records]


@router.post('/teams/{team_id}/playbooks', response_model=PlaybookOut)
async def create_playbook(team_id: str, payload: PlaybookCreate, db: AsyncSession = Depends(get_db)) -> PlaybookOut:
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail='Team not found.')

    playbook = Playbook(
        team_id=team_id,
        created_by=payload.created_by,
        name=payload.name,
        description=payload.description,
        tags=payload.tags,
        status=PlaybookStatus.DRAFT,
    )
    db.add(playbook)
    await db.flush()

    version = PlaybookVersion(
        playbook_id=playbook.id,
        version_number=1,
        created_by=payload.created_by,
        change_note='Initial version',
        graph={'source': 'manual-create', 'steps': len(payload.steps)},
    )
    db.add(version)
    await db.flush()

    for idx, step in enumerate(payload.steps, start=1):
        db.add(
            PlaybookStep(
                playbook_version_id=version.id,
                sequence=idx,
                title=step.title,
                step_type=step.step_type,
                target_url=step.target_url,
                selector=step.selector,
                variables=step.variables,
                guardrails=step.guardrails,
            )
        )

    await db.commit()
    await db.refresh(playbook)
    return PlaybookOut.model_validate(playbook, from_attributes=True)


@router.get('/playbooks/{playbook_id}')
async def get_playbook(playbook_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    playbook = await db.scalar(
        select(Playbook)
        .where(Playbook.id == playbook_id)
        .options(selectinload(Playbook.versions).selectinload(PlaybookVersion.steps))
    )
    if not playbook:
        raise HTTPException(status_code=404, detail='Playbook not found.')

    latest_version = None
    if playbook.versions:
        latest_version = sorted(playbook.versions, key=lambda row: row.version_number)[-1]

    return {
        'playbook': PlaybookOut.model_validate(playbook, from_attributes=True).model_dump(),
        'latest_version': (
            {
                'id': latest_version.id,
                'version_number': latest_version.version_number,
                'change_note': latest_version.change_note,
                'created_at': latest_version.created_at,
                'steps': [
                    {
                        'id': step.id,
                        'sequence': step.sequence,
                        'title': step.title,
                        'step_type': step.step_type,
                        'target_url': step.target_url,
                        'selector': step.selector,
                        'variables': step.variables,
                        'guardrails': step.guardrails,
                    }
                    for step in sorted(latest_version.steps, key=lambda item: item.sequence)
                ],
            }
            if latest_version
            else None
        ),
    }


@router.post('/playbooks/{playbook_id}/versions')
async def create_playbook_version(playbook_id: str, payload: PlaybookVersionCreate, db: AsyncSession = Depends(get_db)) -> dict:
    playbook = await db.get(Playbook, playbook_id)
    if not playbook:
        raise HTTPException(status_code=404, detail='Playbook not found.')

    current_max = await db.scalar(
        select(func.max(PlaybookVersion.version_number)).where(PlaybookVersion.playbook_id == playbook_id)
    )
    version_number = (current_max or 0) + 1

    version = PlaybookVersion(
        playbook_id=playbook_id,
        version_number=version_number,
        created_by=payload.created_by,
        change_note=payload.change_note,
        graph={'source': 'manual-version', 'steps': len(payload.steps)},
    )
    db.add(version)
    await db.flush()

    for idx, step in enumerate(payload.steps, start=1):
        db.add(
            PlaybookStep(
                playbook_version_id=version.id,
                sequence=idx,
                title=step.title,
                step_type=step.step_type,
                target_url=step.target_url,
                selector=step.selector,
                variables=step.variables,
                guardrails=step.guardrails,
            )
        )

    playbook.updated_at = datetime.now(UTC)
    await db.commit()

    return {'playbook_id': playbook_id, 'version_id': version.id, 'version_number': version_number}


@router.post('/capture-sessions/start')
async def start_capture(payload: CaptureSessionStart, db: AsyncSession = Depends(get_db)) -> dict:
    team = await db.get(Team, payload.team_id)
    if not team:
        raise HTTPException(status_code=404, detail='Team not found.')

    user = await db.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found.')

    capture = CaptureSession(
        team_id=payload.team_id,
        user_id=payload.user_id,
        title=payload.title or 'Untitled Capture Session',
        status=CaptureStatus.ACTIVE,
    )
    db.add(capture)
    await db.commit()
    await db.refresh(capture)

    return {
        'session_id': capture.id,
        'team_id': capture.team_id,
        'status': capture.status,
        'provider': capture.provider,
        'websocket_url': f'/api/ws/live/{capture.id}',
    }


@router.post('/capture-sessions/{capture_session_id}/events')
async def append_capture_event(capture_session_id: str, payload: CaptureEventIn, db: AsyncSession = Depends(get_db)) -> dict:
    session = await db.get(CaptureSession, capture_session_id)
    if not session:
        raise HTTPException(status_code=404, detail='Capture session not found.')

    raw_events = list(session.raw_events or [])
    event_payload = payload.model_dump(mode='json')
    raw_events.append(event_payload)
    session.raw_events = raw_events

    action = live_service.normalize_event(event_payload)
    derived = list(session.derived_actions or [])
    derived.append(
        {
            'title': action.title,
            'step_type': action.step_type,
            'target_url': action.target_url,
            'selector': action.selector,
            'variables': action.variables,
            'guardrails': action.guardrails,
        }
    )
    session.derived_actions = derived

    await db.commit()

    return {'capture_session_id': capture_session_id, 'total_events': len(raw_events), 'latest_action': action.title}


@router.post('/capture-sessions/{capture_session_id}/finalize')
async def finalize_capture(capture_session_id: str, payload: CaptureFinalizeIn, db: AsyncSession = Depends(get_db)) -> dict:
    session = await db.get(CaptureSession, capture_session_id)
    if not session:
        raise HTTPException(status_code=404, detail='Capture session not found.')

    session.status = CaptureStatus.FINALIZED
    session.ended_at = datetime.now(UTC)

    created_playbook_id = None
    if payload.create_playbook:
        playbook = Playbook(
            team_id=session.team_id,
            created_by=payload.created_by or session.user_id,
            name=payload.playbook_name or session.title,
            description=payload.description or 'Generated from Gemini Live capture.',
            status=PlaybookStatus.DRAFT,
            tags=['captured', 'gemini-live'],
        )
        db.add(playbook)
        await db.flush()

        version = PlaybookVersion(
            playbook_id=playbook.id,
            version_number=1,
            created_by=payload.created_by or session.user_id,
            change_note='Imported from capture session',
            graph={'source': 'gemini-live-capture', 'events': len(session.raw_events or [])},
        )
        db.add(version)
        await db.flush()

        for idx, action in enumerate(session.derived_actions or [], start=1):
            db.add(
                PlaybookStep(
                    playbook_version_id=version.id,
                    sequence=idx,
                    title=action.get('title', f'Step {idx}'),
                    step_type=action.get('step_type', 'action'),
                    target_url=action.get('target_url'),
                    selector=action.get('selector'),
                    variables=action.get('variables', {}),
                    guardrails=action.get('guardrails', {}),
                )
            )

        created_playbook_id = playbook.id

    await db.commit()

    return {
        'capture_session_id': session.id,
        'status': session.status,
        'events': len(session.raw_events or []),
        'actions': len(session.derived_actions or []),
        'created_playbook_id': created_playbook_id,
    }


@router.get('/teams/{team_id}/capture-sessions')
async def list_capture_sessions(team_id: str, db: AsyncSession = Depends(get_db)) -> list[dict]:
    sessions = await db.scalars(
        select(CaptureSession).where(CaptureSession.team_id == team_id).order_by(desc(CaptureSession.started_at))
    )
    return [
        {
            'id': row.id,
            'title': row.title,
            'status': row.status,
            'provider': row.provider,
            'events': len(row.raw_events or []),
            'actions': len(row.derived_actions or []),
            'started_at': row.started_at,
            'ended_at': row.ended_at,
        }
        for row in sessions
    ]


@router.post('/teams/{team_id}/runs', response_model=RunOut)
async def create_run(team_id: str, payload: RunCreate, db: AsyncSession = Depends(get_db)) -> RunOut:
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail='Team not found.')

    run = Run(
        team_id=team_id,
        playbook_version_id=payload.playbook_version_id,
        trigger_type=payload.trigger_type,
        input_source=payload.input_source,
        status=RunStatus.RUNNING,
        total_items=len(payload.items),
        started_at=datetime.now(UTC),
    )
    db.add(run)
    await db.flush()

    success_count = 0
    failed_count = 0

    for idx, item in enumerate(payload.items):
        is_success = (idx + 1) % 5 != 0
        status = 'completed' if is_success else 'failed'
        if is_success:
            success_count += 1
        else:
            failed_count += 1

        run_item = RunItem(
            run_id=run.id,
            row_index=idx,
            input_payload=item,
            status=status,
            error_message=None if is_success else 'Validation check failed before submit',
        )
        db.add(run_item)
        await db.flush()

        db.add(
            RunEvent(
                run_item_id=run_item.id,
                step_title='Verify preconditions',
                status='success' if is_success else 'error',
                message='Verification passed' if is_success else 'Verification failed, run paused',
                screenshot_url='https://picsum.photos/seed/memoo-evidence-verify/1200/700',
            )
        )

        db.add(
            Evidence(
                run_item_id=run_item.id,
                evidence_type='screenshot',
                url=f'https://picsum.photos/seed/memoo-evidence-{idx}/1200/700',
                metadata_json={'row_index': idx, 'status': status},
            )
        )

    run.success_count = success_count
    run.failed_count = failed_count
    run.status = RunStatus.COMPLETED if failed_count == 0 else RunStatus.FAILED
    run.ended_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(run)

    return RunOut.model_validate(run, from_attributes=True)


@router.get('/runs/{run_id}')
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail='Run not found.')

    items = await db.scalars(select(RunItem).where(RunItem.run_id == run.id).order_by(RunItem.row_index))
    item_rows = list(items)

    payload_items = []
    for item in item_rows:
        events = await db.scalars(select(RunEvent).where(RunEvent.run_item_id == item.id).order_by(RunEvent.created_at))
        evidence = await db.scalars(select(Evidence).where(Evidence.run_item_id == item.id).order_by(Evidence.created_at))

        payload_items.append(
            {
                'id': item.id,
                'row_index': item.row_index,
                'input_payload': item.input_payload,
                'status': item.status,
                'error_message': item.error_message,
                'events': [
                    {
                        'step_title': event.step_title,
                        'status': event.status,
                        'message': event.message,
                        'screenshot_url': event.screenshot_url,
                        'created_at': event.created_at,
                    }
                    for event in events
                ],
                'evidence': [
                    {
                        'evidence_type': row.evidence_type,
                        'url': row.url,
                        'metadata': row.metadata_json,
                    }
                    for row in evidence
                ],
            }
        )

    return {
        'run': RunOut.model_validate(run, from_attributes=True).model_dump(),
        'items': payload_items,
    }


@router.websocket('/ws/live/{capture_session_id}')
async def live_capture_ws(websocket: WebSocket, capture_session_id: str) -> None:
    await websocket.accept()

    async with SessionLocal() as db:
        session = await db.get(CaptureSession, capture_session_id)
        if not session:
            await websocket.send_json({'type': 'error', 'message': 'Capture session not found.'})
            await websocket.close(code=4404)
            return

    try:
        while True:
            payload = await websocket.receive_json()

            async with SessionLocal() as db:
                session = await db.get(CaptureSession, capture_session_id)
                if not session:
                    await websocket.send_json({'type': 'error', 'message': 'Capture session no longer exists.'})
                    continue

                event_payload = {
                    'timestamp': payload.get('timestamp') or datetime.now(UTC).isoformat(),
                    'kind': payload.get('kind', 'event'),
                    'target': payload.get('target'),
                    'value': payload.get('value'),
                    'url': payload.get('url'),
                    'metadata': payload.get('metadata', {}),
                }

                raw_events = list(session.raw_events or [])
                raw_events.append(event_payload)
                session.raw_events = raw_events

                action = live_service.normalize_event(event_payload)
                derived = list(session.derived_actions or [])
                derived.append(
                    {
                        'title': action.title,
                        'step_type': action.step_type,
                        'target_url': action.target_url,
                        'selector': action.selector,
                        'variables': action.variables,
                        'guardrails': action.guardrails,
                    }
                )
                session.derived_actions = derived
                await db.commit()

            await websocket.send_json(
                {
                    'type': 'normalized-action',
                    'title': action.title,
                    'step_type': action.step_type,
                    'target_url': action.target_url,
                    'selector': action.selector,
                    'variables': action.variables,
                }
            )
    except WebSocketDisconnect:
        return


@router.post('/teams/{team_id}/invites')
async def create_invite(team_id: str, email: str, role: MembershipRole = MembershipRole.MEMBER, db: AsyncSession = Depends(get_db)) -> dict:
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail='Team not found.')

    token = uuid4().hex
    invite = Invite(
        team_id=team_id,
        email=email.lower(),
        role=role,
        token=token,
        status='pending',
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    db.add(invite)
    await db.commit()

    return {'invite_id': invite.id, 'token': invite.token, 'status': invite.status}
