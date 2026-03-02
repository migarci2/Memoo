// ---------------------------------------------------------------------------
// Core domain types — mirrors the Python Pydantic schemas
// ---------------------------------------------------------------------------

export type Team = {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  plan: string;
};

export type DashboardMetrics = {
  team_id: string;
  active_playbooks: number;
  draft_playbooks: number;
  runs_last_7_days: number;
  success_rate: number;
};

export type Playbook = {
  id: string;
  team_id: string;
  name: string;
  description?: string | null;
  status: 'draft' | 'active' | 'archived';
  tags: string[];
  created_at: string;
};

export type PlaybookStep = {
  id: string;
  playbook_version_id: string;
  sequence: number;
  title: string;
  step_type: string;
  target_url?: string | null;
  selector?: string | null;
  variables: Record<string, unknown>;
  guardrails: Record<string, unknown>;
};

export type PlaybookVersion = {
  id: string;
  version_number: number;
  change_note?: string | null;
  created_at: string;
  steps: PlaybookStep[];
};

export type PlaybookDetail = {
  playbook: Playbook;
  latest_version: PlaybookVersion;
};

export type CaptureSessionSummary = {
  id: string;
  title: string;
  status: string;
  provider: string;
  events: number;
  actions: number;
  started_at: string;
  ended_at?: string | null;
};

export type TeamMember = {
  id: string;
  email: string;
  full_name: string;
  job_title?: string | null;
  role: string;
};

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

export type Run = {
  id: string;
  team_id: string;
  playbook_version_id: string;
  status: RunStatus;
  trigger_type: string;
  input_source?: string | null;
  total_items: number;
  success_count: number;
  failed_count: number;
  started_at: string;
  ended_at?: string | null;
};

export type RunEvent = {
  id: string;
  step_title: string;
  status: string;
  message?: string | null;
  created_at?: string;
};

export type Evidence = {
  id: string;
  evidence_type: string;
  url: string;
  metadata_json?: Record<string, unknown>;
};

export type RunItemDetail = {
  id: string;
  row_index: number;
  input_payload: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'failed';
  error_message?: string | null;
  events: RunEvent[];
  evidence: Evidence[];
};

export type RunDetail = {
  run: Run;
  items: RunItemDetail[];
};

export type RunSummary = Run & {
  playbook_name?: string;
};

export type PlaybookStepCreate = {
  title: string;
  step_type: string;
  target_url?: string;
  selector?: string;
  variables?: Record<string, unknown>;
  guardrails?: Record<string, unknown>;
};
