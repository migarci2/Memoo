from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ── Auth ─────────────────────────────────────────────────────────────────────

class TeamOnboardingCreate(BaseModel):
    team_name: str = Field(min_length=2, max_length=200)
    team_slug: str = Field(min_length=2, max_length=120)
    team_domain: str | None = None
    owner_name: str = Field(min_length=2, max_length=160)
    owner_email: EmailStr
    owner_title: str | None = None
    password: str = Field(min_length=6, max_length=128)


class AuthLoginIn(BaseModel):
    team_slug: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=1)


class AuthLoginOut(BaseModel):
    team_id: str
    team_slug: str
    team_name: str
    user_id: str
    full_name: str
    role: str


# ── Team & User ──────────────────────────────────────────────────────────────

class TeamSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    domain: str | None
    plan: str
    created_at: datetime


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: str
    job_title: str | None


class TeamBootstrapResponse(BaseModel):
    team: TeamSummary
    owner: UserSummary
    next_step: str


# ── Dashboard ────────────────────────────────────────────────────────────────

class TeamOverview(BaseModel):
    team_id: str
    members_count: int
    playbooks_count: int
    active_playbooks: int
    total_runs: int
    successful_runs: int
    vault_credentials: int


# ── Playbook ─────────────────────────────────────────────────────────────────

class PlaybookStepCreate(BaseModel):
    title: str
    step_type: str = 'action'
    target_url: str | None = None
    selector: str | None = None
    variables: dict = Field(default_factory=dict)
    guardrails: dict = Field(default_factory=dict)


class PlaybookCreate(BaseModel):
    created_by: str | None = None
    name: str
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    steps: list[PlaybookStepCreate] = Field(default_factory=list)


class PlaybookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    team_id: str
    name: str
    description: str | None
    status: str
    tags: list[str]
    created_at: datetime


class PlaybookUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    tags: list[str] | None = None


class PlaybookVersionCreate(BaseModel):
    created_by: str | None = None
    change_note: str | None = None
    steps: list[PlaybookStepCreate] = Field(default_factory=list)


# ── Capture (Teach mode) ────────────────────────────────────────────────────

class CaptureCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    user_id: str | None = None


class CaptureEventIn(BaseModel):
    kind: str
    url: str | None = None
    selector: str | None = None
    value: str | None = None
    text: str | None = None
    timestamp: str | None = None


class CaptureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    team_id: str
    user_id: str | None
    title: str
    status: str
    raw_events: list[dict]
    playbook_id: str | None
    started_at: datetime
    ended_at: datetime | None


class CompileOut(BaseModel):
    playbook_id: str
    version_id: str
    steps_count: int


# ── Frame Analysis (live Gemini Vision) ──────────────────────────────────────

class FrameAnalysisIn(BaseModel):
    image: str  # base64-encoded JPEG/PNG
    mime_type: str = 'image/jpeg'


class FrameAnalysisEvent(BaseModel):
    kind: str
    url: str | None = None
    selector: str | None = None
    value: str | None = None
    text: str | None = None


class FrameAnalysisOut(BaseModel):
    detected: bool
    events: list[FrameAnalysisEvent]


# ── Run (batch execution) ───────────────────────────────────────────────────

class RunCreate(BaseModel):
    playbook_id: str
    input_rows: list[dict] = Field(default_factory=list)
    input_source: str | None = None


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    team_id: str
    playbook_id: str
    playbook_version_id: str | None
    status: str
    trigger_type: str
    input_source: str | None
    total_items: int
    success_count: int
    failed_count: int
    started_at: datetime
    ended_at: datetime | None


class RunItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    row_index: int
    input_payload: dict
    status: str
    started_at: datetime | None
    ended_at: datetime | None


class RunEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    step_sequence: int
    step_title: str
    status: str
    expected_state: str | None
    actual_state: str | None
    screenshot_url: str | None
    vault_credential_used: str | None
    created_at: datetime


class RunDetailOut(BaseModel):
    run: RunOut
    items: list[RunItemOut]
    events_by_item: dict[str, list[RunEventOut]]
    playbook_name: str


# ── Vault ────────────────────────────────────────────────────────────────────

class VaultCredentialCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    service: str = Field(min_length=1, max_length=120)
    credential_type: str = 'password'
    value: str = Field(min_length=1)


class VaultCredentialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    team_id: str
    name: str
    service: str
    credential_type: str
    masked_value: str
    created_by: str | None
    created_at: datetime
    last_used_at: datetime | None


# ── Health ───────────────────────────────────────────────────────────────────

class HealthOut(BaseModel):
    status: str
    app: str
