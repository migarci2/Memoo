from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TeamOnboardingCreate(BaseModel):
    team_name: str = Field(min_length=2, max_length=200)
    team_slug: str = Field(min_length=2, max_length=120)
    team_domain: str | None = None
    owner_name: str = Field(min_length=2, max_length=160)
    owner_email: EmailStr
    owner_title: str | None = None


class AuthLoginIn(BaseModel):
    team_slug: str = Field(min_length=2, max_length=120)
    email: EmailStr


class AuthLoginOut(BaseModel):
    team_id: str
    team_slug: str
    team_name: str
    user_id: str
    full_name: str
    role: str


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


class DashboardMetrics(BaseModel):
    team_id: str
    active_playbooks: int
    draft_playbooks: int
    runs_last_7_days: int
    success_rate: float


class PlaybookStepCreate(BaseModel):
    title: str
    step_type: str = 'action'
    target_url: str | None = None
    selector: str | None = None
    variables: dict = Field(default_factory=dict)
    guardrails: dict = Field(default_factory=dict)


class PlaybookCreate(BaseModel):
    team_id: str
    created_by: str | None = None
    name: str
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    steps: list[PlaybookStepCreate] = Field(default_factory=list)


class PlaybookOut(BaseModel):
    id: str
    team_id: str
    name: str
    description: str | None
    status: str
    tags: list[str]
    created_at: datetime


class PlaybookVersionCreate(BaseModel):
    created_by: str | None = None
    change_note: str | None = None
    steps: list[PlaybookStepCreate] = Field(default_factory=list)


class CaptureSessionStart(BaseModel):
    team_id: str
    user_id: str
    title: str | None = None


class CaptureEventIn(BaseModel):
    timestamp: datetime
    kind: str
    target: str | None = None
    value: str | None = None
    url: str | None = None
    metadata: dict = Field(default_factory=dict)


class CaptureFinalizeIn(BaseModel):
    create_playbook: bool = True
    playbook_name: str | None = None
    description: str | None = None
    created_by: str | None = None


class RunCreate(BaseModel):
    team_id: str
    playbook_version_id: str
    trigger_type: str = 'manual'
    input_source: str = 'list'
    items: list[dict] = Field(default_factory=list)


class RunOut(BaseModel):
    id: str
    team_id: str
    playbook_version_id: str
    status: str
    trigger_type: str
    input_source: str
    total_items: int
    success_count: int
    failed_count: int
    started_at: datetime
    ended_at: datetime | None


class PlaybookUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    tags: list[str] | None = None


class RunSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    team_id: str
    playbook_version_id: str
    status: str
    trigger_type: str
    input_source: str
    total_items: int
    success_count: int
    failed_count: int
    started_at: datetime
    ended_at: datetime | None
    playbook_name: str | None = None


class HealthOut(BaseModel):
    status: str
    app: str
