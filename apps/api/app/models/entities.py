from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from uuid import uuid4

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def now_utc() -> datetime:
    return datetime.now(UTC)


# ── Enums ────────────────────────────────────────────────────────────────────

class MembershipRole(StrEnum):
    OWNER = 'owner'
    ADMIN = 'admin'
    MEMBER = 'member'


class PlaybookStatus(StrEnum):
    DRAFT = 'draft'
    ACTIVE = 'active'
    PUBLISHED = 'published'
    ARCHIVED = 'archived'


class CaptureStatus(StrEnum):
    RECORDING = 'recording'
    COMPLETED = 'completed'
    COMPILED = 'compiled'


class RunStatus(StrEnum):
    PENDING = 'pending'
    RUNNING = 'running'
    COMPLETED = 'completed'
    FAILED = 'failed'


# ── Core entities ────────────────────────────────────────────────────────────

class Team(Base):
    __tablename__ = 'teams'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    domain: Mapped[str | None] = mapped_column(String(180), nullable=True)
    plan: Mapped[str] = mapped_column(String(40), default='pro')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class User(Base):
    __tablename__ = 'users'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    job_title: Mapped[str | None] = mapped_column(String(160), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Membership(Base):
    __tablename__ = 'memberships'
    __table_args__ = (UniqueConstraint('team_id', 'user_id', name='uq_team_user_membership'),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    team_id: Mapped[str] = mapped_column(ForeignKey('teams.id', ondelete='CASCADE'), nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    role: Mapped[MembershipRole] = mapped_column(Enum(MembershipRole), default=MembershipRole.MEMBER)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class OnboardingProgress(Base):
    __tablename__ = 'onboarding_progress'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    team_id: Mapped[str] = mapped_column(ForeignKey('teams.id', ondelete='CASCADE'), unique=True)
    owner_user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    current_step: Mapped[str] = mapped_column(String(80), default='workspace')
    completed_steps: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Invite(Base):
    __tablename__ = 'invites'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    team_id: Mapped[str] = mapped_column(ForeignKey('teams.id', ondelete='CASCADE'), nullable=False)
    email: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[MembershipRole] = mapped_column(Enum(MembershipRole), default=MembershipRole.MEMBER)
    token: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default='pending')
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


# ── Playbooks ────────────────────────────────────────────────────────────────

class Playbook(Base):
    __tablename__ = 'playbooks'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    team_id: Mapped[str] = mapped_column(ForeignKey('teams.id', ondelete='CASCADE'), nullable=False)
    created_by: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[PlaybookStatus] = mapped_column(Enum(PlaybookStatus), default=PlaybookStatus.DRAFT)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    versions: Mapped[list['PlaybookVersion']] = relationship(back_populates='playbook', cascade='all, delete-orphan')


class PlaybookVersion(Base):
    __tablename__ = 'playbook_versions'
    __table_args__ = (UniqueConstraint('playbook_id', 'version_number', name='uq_playbook_version_number'),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    playbook_id: Mapped[str] = mapped_column(ForeignKey('playbooks.id', ondelete='CASCADE'), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[str | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    change_note: Mapped[str | None] = mapped_column(String(240), nullable=True)
    graph: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    playbook: Mapped[Playbook] = relationship(back_populates='versions')
    steps: Mapped[list['PlaybookStep']] = relationship(back_populates='version', cascade='all, delete-orphan')


class PlaybookStep(Base):
    __tablename__ = 'playbook_steps'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    playbook_version_id: Mapped[str] = mapped_column(ForeignKey('playbook_versions.id', ondelete='CASCADE'))
    sequence: Mapped[int] = mapped_column(Integer, default=1)
    title: Mapped[str] = mapped_column(String(220), nullable=False)
    step_type: Mapped[str] = mapped_column(String(60), default='action')
    target_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    selector: Mapped[str | None] = mapped_column(String(500), nullable=True)
    variables: Mapped[dict] = mapped_column(JSON, default=dict)
    guardrails: Mapped[dict] = mapped_column(JSON, default=dict)

    version: Mapped[PlaybookVersion] = relationship(back_populates='steps')


# ── Capture sessions (Teach mode) ───────────────────────────────────────────

class CaptureSession(Base):
    __tablename__ = 'capture_sessions'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    team_id: Mapped[str] = mapped_column(ForeignKey('teams.id', ondelete='CASCADE'), nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[CaptureStatus] = mapped_column(Enum(CaptureStatus), default=CaptureStatus.RECORDING)
    raw_events: Mapped[list[dict]] = mapped_column(JSON, default=list)
    playbook_id: Mapped[str | None] = mapped_column(ForeignKey('playbooks.id', ondelete='SET NULL'), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


# ── Runs (batch execution) ──────────────────────────────────────────────────

class Run(Base):
    __tablename__ = 'runs'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    team_id: Mapped[str] = mapped_column(ForeignKey('teams.id', ondelete='CASCADE'), nullable=False)
    playbook_id: Mapped[str] = mapped_column(ForeignKey('playbooks.id', ondelete='CASCADE'), nullable=False)
    playbook_version_id: Mapped[str | None] = mapped_column(ForeignKey('playbook_versions.id', ondelete='SET NULL'), nullable=True)
    status: Mapped[RunStatus] = mapped_column(Enum(RunStatus), default=RunStatus.PENDING)
    trigger_type: Mapped[str] = mapped_column(String(30), default='csv_batch')
    input_source: Mapped[str | None] = mapped_column(String(200), nullable=True)
    total_items: Mapped[int] = mapped_column(Integer, default=0)
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    items: Mapped[list['RunItem']] = relationship(back_populates='run', cascade='all, delete-orphan')


class RunItem(Base):
    __tablename__ = 'run_items'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(ForeignKey('runs.id', ondelete='CASCADE'), nullable=False)
    row_index: Mapped[int] = mapped_column(Integer, default=0)
    input_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[RunStatus] = mapped_column(Enum(RunStatus), default=RunStatus.PENDING)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    run: Mapped[Run] = relationship(back_populates='items')
    events: Mapped[list['RunEvent']] = relationship(back_populates='item', cascade='all, delete-orphan')


class RunEvent(Base):
    __tablename__ = 'run_events'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_item_id: Mapped[str] = mapped_column(ForeignKey('run_items.id', ondelete='CASCADE'), nullable=False)
    step_sequence: Mapped[int] = mapped_column(Integer, default=0)
    step_title: Mapped[str] = mapped_column(String(220), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default='pending')
    expected_state: Mapped[str | None] = mapped_column(Text, nullable=True)
    actual_state: Mapped[str | None] = mapped_column(Text, nullable=True)
    screenshot_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    vault_credential_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    item: Mapped[RunItem] = relationship(back_populates='events')


# ── Vault ────────────────────────────────────────────────────────────────────

class VaultCredential(Base):
    __tablename__ = 'vault_credentials'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    team_id: Mapped[str] = mapped_column(ForeignKey('teams.id', ondelete='CASCADE'), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    service: Mapped[str] = mapped_column(String(120), nullable=False)
    credential_type: Mapped[str] = mapped_column(String(40), default='password')
    masked_value: Mapped[str] = mapped_column(String(200), default='••••••••')
    created_by: Mapped[str | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
