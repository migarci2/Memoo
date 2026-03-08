from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.entities import (
    CaptureSession,
    CaptureStatus,
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
    VaultCredential,
)
from app.schemas.entities import (
    AuthLoginIn,
    AuthLoginOut,
    CaptureCreate,
    CaptureEventIn,
    CaptureOut,
    CompileOut,
    FrameAnalysisIn,
    FrameAnalysisOut,
    HealthOut,
    InviteCreate,
    PlaybookCreate,
    PlaybookOut,
    PlaybookUpdate,
    PlaybookVersionCreate,
    RunCreate,
    RunDetailOut,
    RunEventOut,
    RunItemOut,
    RunOut,
    SandboxStatusOut,
    TeamBootstrapResponse,
    TeamMemberCreate,
    TeamMemberOut,
    TeamMemberProfileUpdate,
    TeamOnboardingCreate,
    TeamOverview,
    TeamSummary,
    UserSummary,
    VaultCredentialCreate,
    VaultCredentialOut,
)

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_STEP_TYPES = {'navigate', 'click', 'input', 'submit', 'verify', 'wait', 'action'}
NON_ACTION_EVENT_KINDS = {'voice_note', 'gemini_clarification'}


def _clean_text(value: object, max_len: int) -> str | None:
    if not isinstance(value, str):
        return None
    text = ' '.join(value.split()).strip()
    if not text:
        return None
    if len(text) <= max_len:
        return text
    if max_len <= 3:
        return text[:max_len]
    return f'{text[:max_len - 3].rstrip()}...'


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def _check_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── Health ───────────────────────────────────────────────────────────────────

@router.get('/health', response_model=HealthOut)
async def health() -> HealthOut:
    return HealthOut(status='ok', app='memoo-api')


# ── Auth ─────────────────────────────────────────────────────────────────────

@router.post('/auth/login', response_model=AuthLoginOut)
async def auth_login(payload: AuthLoginIn, db: AsyncSession = Depends(get_db)) -> AuthLoginOut:
    team = await db.scalar(select(Team).where(Team.slug == payload.team_slug.lower()))
    if not team:
        raise HTTPException(status_code=401, detail='Invalid credentials.')

    row = await db.execute(
        select(User, Membership.role)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.team_id == team.id, func.lower(User.email) == payload.email.lower())
    )
    found = row.first()
    if not found:
        raise HTTPException(status_code=401, detail='Invalid credentials.')

    user, role = found

    if not user.password_hash or not _check_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail='Invalid credentials.')

    return AuthLoginOut(
        team_id=team.id,
        team_slug=team.slug,
        team_name=team.name,
        user_id=user.id,
        full_name=user.full_name,
        role=role.value if hasattr(role, 'value') else str(role),
    )


@router.post('/onboarding/team', response_model=TeamBootstrapResponse)
async def create_team_onboarding(
    payload: TeamOnboardingCreate, db: AsyncSession = Depends(get_db)
) -> TeamBootstrapResponse:
    normalized_slug = payload.team_slug.lower()
    existing_slug = await db.scalar(select(Team).where(Team.slug == normalized_slug))
    if existing_slug:
        raise HTTPException(status_code=409, detail='Team slug already exists.')

    user = await db.scalar(select(User).where(User.email == payload.owner_email.lower()))
    if not user:
        user = User(
            email=payload.owner_email.lower(),
            full_name=payload.owner_name,
            job_title=payload.owner_title,
            password_hash=_hash_password(payload.password),
        )
        db.add(user)
        await db.flush()
    else:
        if not user.password_hash:
            user.password_hash = _hash_password(payload.password)

    team = Team(name=payload.team_name, slug=normalized_slug, domain=payload.team_domain)
    db.add(team)
    await db.flush()

    membership = Membership(team_id=team.id, user_id=user.id, role=MembershipRole.OWNER)
    db.add(membership)

    progress = OnboardingProgress(
        team_id=team.id,
        owner_user_id=user.id,
        current_step='invite_team',
        completed_steps=['workspace_created'],
    )
    db.add(progress)

    await db.commit()
    await db.refresh(team)
    await db.refresh(user)

    return TeamBootstrapResponse(
        team=TeamSummary.model_validate(team),
        owner=UserSummary.model_validate(user),
        next_step='Create your first playbook and start automating.',
    )


# ── Dashboard ────────────────────────────────────────────────────────────────

@router.get('/teams/{team_id}/dashboard', response_model=TeamOverview)
async def get_dashboard(team_id: str, db: AsyncSession = Depends(get_db)) -> TeamOverview:
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail='Team not found.')

    members_count = await db.scalar(
        select(func.count()).select_from(Membership).where(Membership.team_id == team_id)
    ) or 0
    playbooks_count = await db.scalar(
        select(func.count()).select_from(Playbook).where(Playbook.team_id == team_id)
    ) or 0
    active_playbooks = await db.scalar(
        select(func.count())
        .select_from(Playbook)
        .where(Playbook.team_id == team_id, Playbook.status.in_([PlaybookStatus.ACTIVE, PlaybookStatus.PUBLISHED]))
    ) or 0
    total_runs = await db.scalar(
        select(func.count()).select_from(Run).where(Run.team_id == team_id)
    ) or 0
    successful_runs = await db.scalar(
        select(func.count())
        .select_from(Run)
        # A run is "successful" only when it completed with zero failed items.
        .where(
            Run.team_id == team_id,
            Run.status == RunStatus.COMPLETED,
            Run.failed_count == 0,
        )
    ) or 0
    vault_count = await db.scalar(
        select(func.count()).select_from(VaultCredential).where(VaultCredential.team_id == team_id)
    ) or 0

    return TeamOverview(
        team_id=team_id,
        members_count=members_count,
        playbooks_count=playbooks_count,
        active_playbooks=active_playbooks,
        total_runs=total_runs,
        successful_runs=successful_runs,
        vault_credentials=vault_count,
    )


# ── Members ──────────────────────────────────────────────────────────────────

@router.get('/teams/{team_id}/members', response_model=list[TeamMemberOut])
async def list_team_members(team_id: str, db: AsyncSession = Depends(get_db)) -> list[TeamMemberOut]:
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
        TeamMemberOut(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            job_title=user.job_title,
            role=role.value if hasattr(role, 'value') else str(role),
        )
        for user, role in rows.all()
    ]


@router.post('/teams/{team_id}/members', response_model=TeamMemberOut)
async def create_team_member(
    team_id: str, payload: TeamMemberCreate, db: AsyncSession = Depends(get_db)
) -> TeamMemberOut:
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail='Team not found.')

    email = payload.email.lower()
    user = await db.scalar(select(User).where(func.lower(User.email) == email))

    if user:
        existing_membership = await db.scalar(
            select(Membership).where(Membership.team_id == team_id, Membership.user_id == user.id)
        )
        if existing_membership:
            raise HTTPException(status_code=409, detail='User is already a member of this team.')

        if payload.full_name.strip():
            user.full_name = payload.full_name.strip()
        if payload.job_title is not None:
            user.job_title = payload.job_title.strip() or None
        if payload.password and not user.password_hash:
            user.password_hash = _hash_password(payload.password)
    else:
        user = User(
            email=email,
            full_name=payload.full_name.strip(),
            job_title=(payload.job_title.strip() if payload.job_title else None),
            password_hash=_hash_password(payload.password) if payload.password else None,
        )
        db.add(user)
        await db.flush()

    membership = Membership(
        team_id=team_id,
        user_id=user.id,
        role=MembershipRole(payload.role),
    )
    db.add(membership)
    await db.commit()
    await db.refresh(user)

    return TeamMemberOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        job_title=user.job_title,
        role=membership.role.value,
    )


@router.patch('/teams/{team_id}/members/{user_id}', response_model=TeamMemberOut)
async def update_team_member_profile(
    team_id: str,
    user_id: str,
    payload: TeamMemberProfileUpdate,
    db: AsyncSession = Depends(get_db),
) -> TeamMemberOut:
    membership = await db.scalar(
        select(Membership).where(Membership.team_id == team_id, Membership.user_id == user_id)
    )
    if not membership:
        raise HTTPException(status_code=404, detail='Team member not found.')

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found.')

    if payload.full_name is not None:
        cleaned_name = payload.full_name.strip()
        if not cleaned_name:
            raise HTTPException(status_code=400, detail='Name cannot be empty.')
        user.full_name = cleaned_name
    if payload.job_title is not None:
        user.job_title = payload.job_title.strip() or None

    await db.commit()
    await db.refresh(user)

    return TeamMemberOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        job_title=user.job_title,
        role=membership.role.value if hasattr(membership.role, 'value') else str(membership.role),
    )


# ── Playbooks ────────────────────────────────────────────────────────────────

@router.get('/teams/{team_id}/playbooks', response_model=list[PlaybookOut])
async def list_playbooks(team_id: str, db: AsyncSession = Depends(get_db)) -> list[PlaybookOut]:
    records = await db.scalars(
        select(Playbook).where(Playbook.team_id == team_id).order_by(desc(Playbook.updated_at))
    )
    return [PlaybookOut.model_validate(p, from_attributes=True) for p in records]


@router.post('/teams/{team_id}/playbooks', response_model=PlaybookOut)
async def create_playbook(
    team_id: str, payload: PlaybookCreate, db: AsyncSession = Depends(get_db)
) -> PlaybookOut:
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


@router.patch('/playbooks/{playbook_id}', response_model=PlaybookOut)
async def update_playbook(
    playbook_id: str, payload: PlaybookUpdate, db: AsyncSession = Depends(get_db)
) -> PlaybookOut:
    playbook = await db.get(Playbook, playbook_id)
    if not playbook:
        raise HTTPException(status_code=404, detail='Playbook not found.')

    if payload.name is not None:
        playbook.name = payload.name
    if payload.description is not None:
        playbook.description = payload.description
    if payload.status is not None:
        try:
            playbook.status = PlaybookStatus(payload.status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f'Invalid status: {payload.status}')
    if payload.tags is not None:
        playbook.tags = payload.tags

    playbook.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(playbook)
    return PlaybookOut.model_validate(playbook, from_attributes=True)


@router.delete('/playbooks/{playbook_id}')
async def delete_playbook(playbook_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    playbook = await db.get(Playbook, playbook_id)
    if not playbook:
        raise HTTPException(status_code=404, detail='Playbook not found.')
    await db.delete(playbook)
    await db.commit()
    return {'deleted': True}


@router.post('/playbooks/{playbook_id}/versions')
async def create_playbook_version(
    playbook_id: str, payload: PlaybookVersionCreate, db: AsyncSession = Depends(get_db)
) -> dict:
    playbook = await db.get(Playbook, playbook_id)
    if not playbook:
        raise HTTPException(status_code=404, detail='Playbook not found.')

    current_max = await db.scalar(
        select(func.max(PlaybookVersion.version_number)).where(
            PlaybookVersion.playbook_id == playbook_id
        )
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


# ── Capture (Teach mode) ────────────────────────────────────────────────────

@router.post('/teams/{team_id}/captures', response_model=CaptureOut)
async def create_capture(
    team_id: str, payload: CaptureCreate, db: AsyncSession = Depends(get_db)
) -> CaptureOut:
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail='Team not found.')

    capture = CaptureSession(
        team_id=team_id,
        user_id=payload.user_id,
        title=payload.title,
        status=CaptureStatus.RECORDING,
    )
    db.add(capture)
    await db.commit()
    await db.refresh(capture)
    return CaptureOut.model_validate(capture, from_attributes=True)


@router.get('/teams/{team_id}/captures', response_model=list[CaptureOut])
async def list_captures(team_id: str, db: AsyncSession = Depends(get_db)) -> list[CaptureOut]:
    rows = await db.scalars(
        select(CaptureSession)
        .where(CaptureSession.team_id == team_id)
        .order_by(desc(CaptureSession.started_at))
    )
    return [CaptureOut.model_validate(c, from_attributes=True) for c in rows]


@router.get('/captures/{capture_id}', response_model=CaptureOut)
async def get_capture(capture_id: str, db: AsyncSession = Depends(get_db)) -> CaptureOut:
    capture = await db.get(CaptureSession, capture_id)
    if not capture:
        raise HTTPException(status_code=404, detail='Capture not found.')
    return CaptureOut.model_validate(capture, from_attributes=True)


@router.post('/captures/{capture_id}/events', response_model=CaptureOut)
async def add_capture_events(
    capture_id: str, events: list[CaptureEventIn], db: AsyncSession = Depends(get_db)
) -> CaptureOut:
    capture = await db.get(CaptureSession, capture_id)
    if not capture:
        raise HTTPException(status_code=404, detail='Capture not found.')

    current = list(capture.raw_events or [])
    for ev in events:
        current.append(ev.model_dump(exclude_none=True))
    capture.raw_events = current

    await db.commit()
    await db.refresh(capture)
    return CaptureOut.model_validate(capture, from_attributes=True)


@router.post('/captures/{capture_id}/finalize', response_model=CaptureOut)
async def finalize_capture(capture_id: str, db: AsyncSession = Depends(get_db)) -> CaptureOut:
    capture = await db.get(CaptureSession, capture_id)
    if not capture:
        raise HTTPException(status_code=404, detail='Capture not found.')

    capture.status = CaptureStatus.COMPLETED
    capture.ended_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(capture)
    return CaptureOut.model_validate(capture, from_attributes=True)


# ── Frame analysis (Gemini Vision — live capture) ────────────────────────────

@router.post('/captures/{capture_id}/analyze-frame', response_model=FrameAnalysisOut)
async def analyze_frame(
    capture_id: str, payload: FrameAnalysisIn, db: AsyncSession = Depends(get_db)
) -> FrameAnalysisOut:
    """Receive a screenshot frame, analyse it with Gemini Vision, and auto-append any
    newly detected events to the capture session."""
    capture = await db.get(CaptureSession, capture_id)
    if not capture:
        raise HTTPException(status_code=404, detail='Capture not found.')

    previous_events: list[dict] = list(capture.raw_events or [])

    from app.services.gemini_live import analyse_frame as _analyse

    result = await _analyse(
        image_b64=payload.image,
        previous_events=previous_events,
        mime_type=payload.mime_type,
    )

    # Auto-save newly detected events into the capture
    if result.get('detected') and result.get('events'):
        for ev in result['events']:
            previous_events.append(ev)
        capture.raw_events = previous_events
        await db.commit()
        await db.refresh(capture)

    return FrameAnalysisOut(
        detected=result.get('detected', False),
        events=[
            {
                'kind': e.get('kind', 'action'),
                'url': e.get('url'),
                'selector': e.get('selector'),
                'value': e.get('value'),
                'text': e.get('text'),
            }
            for e in result.get('events', [])
        ],
    )


# ── Compile (Gemini) ────────────────────────────────────────────────────────

@router.post('/captures/{capture_id}/compile', response_model=CompileOut)
async def compile_capture(capture_id: str, db: AsyncSession = Depends(get_db)) -> CompileOut:
    capture = await db.get(CaptureSession, capture_id)
    if not capture:
        raise HTTPException(status_code=404, detail='Capture not found.')

    if not capture.raw_events:
        raise HTTPException(status_code=400, detail='No capture events to compile.')

    try:
        # Import and call Gemini service
        from app.services.gemini_compile import compile_events

        actionable_events = [
            ev for ev in (capture.raw_events or [])
            if isinstance(ev, dict) and ev.get('kind') not in NON_ACTION_EVENT_KINDS
        ]
        if not actionable_events:
            raise HTTPException(
                status_code=400,
                detail='No actionable capture events to compile.',
            )

        compiled_steps = await compile_events(actionable_events)

        if not isinstance(compiled_steps, list):
            raise HTTPException(status_code=500, detail='Compiler returned invalid step list.')

        normalized_steps: list[dict] = []
        for idx, step in enumerate(compiled_steps, start=1):
            if not isinstance(step, dict):
                fallback_title = _clean_text(step, 220) or f'Step {idx}'
                normalized_steps.append({
                    'title': fallback_title,
                    'step_type': 'action',
                    'target_url': None,
                    'selector': None,
                    'variables': {},
                    'guardrails': {},
                })
                continue
            raw_step_type = step.get('step_type')
            step_type = (
                raw_step_type.strip().lower()
                if isinstance(raw_step_type, str) and raw_step_type.strip()
                else 'action'
            )
            if step_type not in ALLOWED_STEP_TYPES:
                step_type = 'action'

            title = _clean_text(step.get('title'), 220) or f'Step {idx}'
            target_url = _clean_text(step.get('target_url'), 500)
            selector = _clean_text(step.get('selector'), 500)
            normalized_steps.append({
                'title': title,
                'step_type': step_type,
                'target_url': target_url,
                'selector': selector,
                'variables': step.get('variables') if isinstance(step.get('variables'), dict) else {},
                'guardrails': step.get('guardrails') if isinstance(step.get('guardrails'), dict) else {},
            })

        # Create or reuse playbook
        if capture.playbook_id:
            playbook = await db.get(Playbook, capture.playbook_id)
            if not playbook:
                raise HTTPException(status_code=404, detail='Linked playbook not found.')
        else:
            playbook = Playbook(
                team_id=capture.team_id,
                created_by=capture.user_id,
                name=capture.title,
                description=f'Auto-compiled from capture: {capture.title}',
                tags=['automated', 'gemini-compiled'],
                status=PlaybookStatus.DRAFT,
            )
            db.add(playbook)
            await db.flush()
            capture.playbook_id = playbook.id

        # New version
        current_max = await db.scalar(
            select(func.max(PlaybookVersion.version_number)).where(
                PlaybookVersion.playbook_id == playbook.id
            )
        )
        version_number = (current_max or 0) + 1

        version = PlaybookVersion(
            playbook_id=playbook.id,
            version_number=version_number,
            created_by=capture.user_id,
            change_note='Gemini-compiled from capture session',
            graph={'source': 'gemini-compile', 'steps': len(normalized_steps)},
        )
        db.add(version)
        await db.flush()

        for idx, step in enumerate(normalized_steps, start=1):
            db.add(
                PlaybookStep(
                    playbook_version_id=version.id,
                    sequence=idx,
                    title=step['title'],
                    step_type=step['step_type'],
                    target_url=step['target_url'],
                    selector=step['selector'],
                    variables=step['variables'],
                    guardrails=step['guardrails'],
                )
            )

        capture.status = CaptureStatus.COMPILED
        if capture.ended_at is None:
            capture.ended_at = datetime.now(UTC)
        playbook.updated_at = datetime.now(UTC)
        await db.commit()

        return CompileOut(
            playbook_id=playbook.id,
            version_id=version.id,
            steps_count=len(normalized_steps),
        )
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.exception('compile_capture failed for capture_id=%s', capture_id)
        raise HTTPException(status_code=500, detail=f'Compile pipeline failed: {e}') from e


# ── Sandbox ───────────────────────────────────────────────────────────────────

@router.get('/sandbox/status', response_model=SandboxStatusOut)
async def sandbox_status() -> SandboxStatusOut:
    """Return the health and connection URLs for the visible sandbox browser."""
    import httpx
    from app.core.config import get_settings
    settings = get_settings()
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f'{settings.sandbox_cdp_url}/json/version', timeout=3)
            resp.raise_for_status()
        return SandboxStatusOut(
            healthy=True,
            novnc_url='http://localhost:6080/vnc.html?autoconnect=true&resize=scale',
            cdp_url=settings.sandbox_cdp_url,
        )
    except Exception:
        return SandboxStatusOut(healthy=False)


# ── Runs (batch execution) ──────────────────────────────────────────────────

@router.get('/teams/{team_id}/runs', response_model=list[RunOut])
async def list_runs(team_id: str, db: AsyncSession = Depends(get_db)) -> list[RunOut]:
    rows = await db.scalars(
        select(Run).where(Run.team_id == team_id).order_by(desc(Run.started_at))
    )
    return [RunOut.model_validate(r, from_attributes=True) for r in rows]


@router.post('/teams/{team_id}/runs', response_model=RunOut)
async def create_run(
    team_id: str, payload: RunCreate, db: AsyncSession = Depends(get_db)
) -> RunOut:
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail='Team not found.')

    playbook = await db.scalar(
        select(Playbook)
        .where(Playbook.id == payload.playbook_id)
        .options(selectinload(Playbook.versions).selectinload(PlaybookVersion.steps))
    )
    if not playbook:
        raise HTTPException(status_code=404, detail='Playbook not found.')

    latest_version = None
    if playbook.versions:
        latest_version = sorted(playbook.versions, key=lambda v: v.version_number)[-1]

    run = Run(
        team_id=team_id,
        playbook_id=payload.playbook_id,
        playbook_version_id=latest_version.id if latest_version else None,
        status=RunStatus.PENDING,
        trigger_type='csv_batch',
        input_source=payload.input_source,
        total_items=len(payload.input_rows),
        use_sandbox=payload.use_sandbox,
    )
    db.add(run)
    await db.flush()

    for idx, row_data in enumerate(payload.input_rows):
        item = RunItem(
            run_id=run.id,
            row_index=idx,
            input_payload=row_data,
            status=RunStatus.PENDING,
        )
        db.add(item)

    await db.commit()
    await db.refresh(run)

    # Fire-and-forget execution (Playwright if available, else simulated)
    asyncio.create_task(_execute_run(run.id))

    return RunOut.model_validate(run, from_attributes=True)


async def _execute_run(run_id: str) -> None:
    """Execute a run using Playwright (or sandbox / fallback simulation).

    When the run has ``use_sandbox=True``, steps are executed in the shared
    visible Chromium via CDP so the user can watch in real-time through noVNC.
    """
    await asyncio.sleep(0.5)  # small delay to let the HTTP response flush

    from app.db.session import SessionLocal
    from app.services.playwright_executor import execute_playbook_steps
    from app.services.sandbox_executor import execute_in_sandbox

    async with SessionLocal() as db:
        run = await db.scalar(
            select(Run).where(Run.id == run_id).options(selectinload(Run.items))
        )
        if not run:
            return

        # Load playbook steps
        steps: list[dict] = []
        if run.playbook_version_id:
            version = await db.scalar(
                select(PlaybookVersion)
                .where(PlaybookVersion.id == run.playbook_version_id)
                .options(selectinload(PlaybookVersion.steps))
            )
            if version:
                for s in sorted(version.steps, key=lambda s: s.sequence):
                    steps.append({
                        'sequence': s.sequence,
                        'title': s.title,
                        'step_type': s.step_type,
                        'target_url': s.target_url,
                        'selector': s.selector,
                        'variables': s.variables or {},
                        'guardrails': s.guardrails or {},
                    })

        # Load vault credentials for context
        vault_creds = list(await db.scalars(
            select(VaultCredential).where(VaultCredential.team_id == run.team_id)
        ))
        vault_names = [c.name for c in vault_creds]

        run.status = RunStatus.RUNNING
        run.started_at = datetime.now(UTC)
        await db.commit()

        success_count = 0
        failed_count = 0

        for item in sorted(run.items, key=lambda i: i.row_index):
            item.status = RunStatus.RUNNING
            item.started_at = datetime.now(UTC)
            await db.commit()

            # Build row data for variable substitution
            row_data = dict(item.input_payload or {})

            # Execute steps — sandbox (visible browser) or headless Playwright
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
            for result in step_results:
                vault_used = None
                if vault_names and result.get('title', '').lower().find('login') >= 0:
                    vault_used = f'Using {vault_names[0]} (secure)'

                event = RunEvent(
                    run_item_id=item.id,
                    step_sequence=result['sequence'],
                    step_title=result['title'],
                    status=result['status'],
                    expected_state=result.get('expected_state', ''),
                    actual_state=result.get('actual_state', ''),
                    vault_credential_used=vault_used,
                    # screenshot_url could be set after uploading to MinIO
                )
                db.add(event)

                if result['status'] == 'failed':
                    item_failed = True

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


@router.get('/runs/{run_id}')
async def get_run_detail(run_id: str, db: AsyncSession = Depends(get_db)) -> RunDetailOut:
    run = await db.scalar(
        select(Run)
        .where(Run.id == run_id)
        .options(selectinload(Run.items).selectinload(RunItem.events))
    )
    if not run:
        raise HTTPException(status_code=404, detail='Run not found.')

    playbook = await db.get(Playbook, run.playbook_id)
    playbook_name = playbook.name if playbook else 'Unknown'

    items_out = []
    events_map: dict[str, list[RunEventOut]] = {}

    for item in sorted(run.items, key=lambda i: i.row_index):
        items_out.append(RunItemOut.model_validate(item, from_attributes=True))
        events_map[item.id] = [
            RunEventOut.model_validate(e, from_attributes=True)
            for e in sorted(item.events, key=lambda e: e.step_sequence)
        ]

    return RunDetailOut(
        run=RunOut.model_validate(run, from_attributes=True),
        items=items_out,
        events_by_item=events_map,
        playbook_name=playbook_name,
    )


# ── Vault ────────────────────────────────────────────────────────────────────

@router.get('/teams/{team_id}/vault', response_model=list[VaultCredentialOut])
async def list_vault(team_id: str, db: AsyncSession = Depends(get_db)) -> list[VaultCredentialOut]:
    rows = await db.scalars(
        select(VaultCredential)
        .where(VaultCredential.team_id == team_id)
        .order_by(VaultCredential.created_at)
    )
    return [VaultCredentialOut.model_validate(c, from_attributes=True) for c in rows]


@router.post('/teams/{team_id}/vault', response_model=VaultCredentialOut)
async def create_vault_credential(
    team_id: str, payload: VaultCredentialCreate, db: AsyncSession = Depends(get_db)
) -> VaultCredentialOut:
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail='Team not found.')

    # Mask value for storage (mock encryption)
    masked = '••••' + payload.value[-4:] if len(payload.value) >= 4 else '••••••••'

    cred = VaultCredential(
        team_id=team_id,
        name=payload.name,
        service=payload.service,
        credential_type=payload.credential_type,
        masked_value=masked,
    )
    db.add(cred)
    await db.commit()
    await db.refresh(cred)
    return VaultCredentialOut.model_validate(cred, from_attributes=True)


@router.delete('/vault/{credential_id}')
async def delete_vault_credential(credential_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    cred = await db.get(VaultCredential, credential_id)
    if not cred:
        raise HTTPException(status_code=404, detail='Credential not found.')
    await db.delete(cred)
    await db.commit()
    return {'deleted': True}


# ── Invites ──────────────────────────────────────────────────────────────────

@router.post('/teams/{team_id}/invites')
async def create_invite(
    team_id: str,
    payload: InviteCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    team = await db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail='Team not found.')

    token = uuid4().hex
    invite = Invite(
        team_id=team_id,
        email=payload.email.lower(),
        role=MembershipRole(payload.role),
        token=token,
        status='pending',
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    db.add(invite)
    await db.commit()

    return {'invite_id': invite.id, 'token': invite.token, 'status': invite.status}
