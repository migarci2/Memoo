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
