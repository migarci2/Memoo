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

export type TeamMember = {
  id: string;
  email: string;
  full_name: string;
  job_title?: string | null;
  role: string;
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

// ── Sandbox ──────────────────────────────────────────────────────────────

export type SandboxStatus = {
  healthy: boolean;
  novnc_url?: string | null;
  cdp_url?: string | null;
};

// ── Runs (batch execution) ───────────────────────────────────────────────

export type Run = {
  id: string;
  team_id: string;
  playbook_id: string;
  playbook_version_id?: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  trigger_type: string;
  input_source?: string | null;
  total_items: number;
  success_count: number;
  failed_count: number;
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
  created_by?: string | null;
  created_at: string;
  last_used_at?: string | null;
};
