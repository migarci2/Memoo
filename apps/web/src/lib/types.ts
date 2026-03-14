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

export type TeamOverview = {
  team_id: string;
  members_count: number;
  playbooks_count: number;
  active_playbooks: number;
  total_runs: number;
  successful_runs: number;
  vault_credentials: number;
};

export type Playbook = {
  id: string;
  team_id: string;
  folder_id?: string | null;
  name: string;
  description?: string | null;
  status: 'draft' | 'active' | 'archived';
  tags: string[];
  created_at: string;
};

export type PlaybookFolder = {
  id: string;
  team_id: string;
  name: string;
  color?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
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

export type TeamMember = {
  id: string;
  email: string;
  full_name: string;
  job_title?: string | null;
  role: string;
};

export type TeamMemberCreateInput = {
  email: string;
  full_name: string;
  job_title?: string | null;
  role: 'member' | 'admin';
  password?: string | null;
};

export type TeamMemberProfileUpdate = {
  full_name?: string;
  job_title?: string | null;
};

export type PlaybookStepCreate = {
  title: string;
  step_type: string;
  target_url?: string;
  selector?: string;
  variables?: Record<string, unknown>;
  guardrails?: Record<string, unknown>;
};

// ── Capture (Teach mode) ─────────────────────────────────────────────────

export type CaptureSession = {
  id: string;
  team_id: string;
  user_id?: string | null;
  title: string;
  status: 'recording' | 'completed' | 'compiled';
  raw_events: Record<string, unknown>[];
  playbook_id?: string | null;
  started_at: string;
  ended_at?: string | null;
};

export type CaptureEventInput = {
  kind: string;
  url?: string;
  selector?: string;
  value?: string;
  text?: string;
  timestamp?: string;
};

export type CompileResult = {
  playbook_id: string;
  version_id: string;
  steps_count: number;
};

// ── Frame Analysis (live Gemini Vision) ──────────────────────────────────

export type FrameAnalysisEvent = {
  kind: string;
  url?: string | null;
  selector?: string | null;
  value?: string | null;
  text?: string | null;
};

export type FrameAnalysisResult = {
  detected: boolean;
  events: FrameAnalysisEvent[];
};

// ── Gemini Live (voice co-pilot) ──────────────────────────────────────────

export type LiveSessionStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export type TranscriptEntry = {
  role: 'user' | 'gemini';
  text: string;
  timestamp: string;
};

// ── Sandbox ──────────────────────────────────────────────────────────────

export type SandboxStatus = {
  healthy: boolean;
  novnc_url?: string | null;
  cdp_url?: string | null;
};

// ── Automations ──────────────────────────────────────────────────────────

export type PlaybookAutomation = {
  id: string;
  team_id: string;
  playbook_id: string;
  name: string;
  trigger_type: 'interval' | 'webhook';
  enabled: boolean;
  interval_minutes?: number | null;
  webhook_token?: string | null;
  input_rows: Record<string, unknown>[];
  input_source?: string | null;
  selected_vault_credential_ids: string[];
  use_sandbox: boolean;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_run_id?: string | null;
  last_error?: string | null;
  is_running: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type PlaybookAutomationCreateInput = {
  playbook_id: string;
  name: string;
  trigger_type: 'interval' | 'webhook';
  interval_minutes?: number;
  input_rows: Record<string, unknown>[];
  input_source?: string;
  selected_vault_credential_ids: string[];
  use_sandbox: boolean;
  enabled: boolean;
};

export type PlaybookAutomationUpdateInput = {
  name?: string;
  trigger_type?: 'interval' | 'webhook';
  interval_minutes?: number;
  input_rows?: Record<string, unknown>[];
  input_source?: string;
  selected_vault_credential_ids?: string[];
  use_sandbox?: boolean;
  enabled?: boolean;
};

// ── Runs (batch execution) ───────────────────────────────────────────────

export type Run = {
  id: string;
  team_id: string;
  playbook_id?: string | null;
  playbook_version_id?: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  trigger_type: string;
  input_source?: string | null;
  total_items: number;
  success_count: number;
  failed_count: number;
  selected_vault_credential_ids: string[];
  use_sandbox: boolean;
  started_at: string;
  ended_at?: string | null;
};

export type RunItem = {
  id: string;
  row_index: number;
  input_payload: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at?: string | null;
  ended_at?: string | null;
};

export type RunEvent = {
  id: string;
  step_sequence: number;
  step_title: string;
  status: 'success' | 'failed' | 'pending' | 'skipped';
  expected_state?: string | null;
  actual_state?: string | null;
  screenshot_url?: string | null;
  vault_credential_used?: string | null;
  created_at: string;
};

export type RunDetail = {
  run: Run;
  items: RunItem[];
  events_by_item: Record<string, RunEvent[]>;
  playbook_name: string;
};

// ── Vault ────────────────────────────────────────────────────────────────

export type VaultCredential = {
  id: string;
  team_id: string;
  name: string;
  service: string;
  credential_type: string;
  masked_value: string;
  template_key?: string | null;
  created_by?: string | null;
  created_at: string;
  last_used_at?: string | null;
};
