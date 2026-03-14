'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  CircleNotch,
  Desktop,
  FileText,
  Lock,
  Sparkle,
  XCircle,
} from '@phosphor-icons/react';

import { PlatformShell } from '@/components/platform-shell';
import { apiGet } from '@/lib/api';
import { getSandboxNovncUrl } from '@/lib/config';
import type { RunDetail, RunEvent, RunItem } from '@/lib/types';

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <span className="inline-flex text-[#4a8c61]"><CheckCircle size={16} weight="fill" /></span>,
  success: <span className="inline-flex text-[#4a8c61]"><CheckCircle size={16} weight="fill" /></span>,
  failed: <span className="inline-flex text-[#b04040]"><XCircle size={16} weight="fill" /></span>,
  pending: <span className="inline-flex text-[var(--app-muted)]"><CircleNotch size={16} /></span>,
  running: (
    <span className="animate-spin inline-flex text-[var(--app-blue)]">
      <CircleNotch size={16} />
    </span>
  ),
};

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'Not started yet';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function buildAgentSnapshot(items: RunItem[]) {
  const payload = items[0]?.input_payload ?? {};
  const agentBrief = stringValue(payload.agent_brief);
  const agentContextText = stringValue(payload.agent_context_text);
  const attachmentsManifest = stringValue(payload.agent_attachments_manifest);
  const attachmentLines = attachmentsManifest
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 3);

  return {
    agentBrief,
    agentContextText,
    attachmentsManifest,
    attachmentLines,
    attachmentCount: numberValue(payload.agent_attachment_count),
    textAttachmentCount: numberValue(payload.agent_text_attachment_count),
    imageAttachmentCount: numberValue(payload.agent_image_attachment_count),
  };
}

function latestRunEvent(eventsByItem: Record<string, RunEvent[]>): RunEvent | null {
  let latest: RunEvent | null = null;

  for (const events of Object.values(eventsByItem)) {
    for (const event of events) {
      if (!latest || new Date(event.created_at).getTime() > new Date(latest.created_at).getTime()) {
        latest = event;
      }
    }
  }

  return latest;
}

export default function RunDetailPage() {
  const { teamId, runId } = useParams<{ teamId: string; runId: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    apiGet<RunDetail>(`/runs/${runId}`)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [runId]);

  // Poll while running
  useEffect(() => {
    if (!detail || detail.run.status !== 'running') return;
    const timer = setInterval(() => {
      apiGet<RunDetail>(`/runs/${runId}`).then(setDetail).catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [detail, runId]);

  if (loading) {
    return (
      <PlatformShell teamId={teamId}>
        <div className="py-20 text-center text-[var(--app-muted)]">
          <span className="animate-spin inline-flex mb-2"><CircleNotch size={24} /></span>
          <p className="text-sm">Loading run details…</p>
        </div>
      </PlatformShell>
    );
  }

  if (!detail) {
    return (
      <PlatformShell teamId={teamId}>
        <p className="py-20 text-center text-[var(--app-muted)]">Run not found.</p>
      </PlatformShell>
    );
  }

  const { run, items, events_by_item, playbook_name } = detail;
  const successRate =
    run.total_items > 0
      ? Math.round((run.success_count / run.total_items) * 100)
      : 0;
  const sandboxNovncUrl = getSandboxNovncUrl();
  const agentSnapshot = buildAgentSnapshot(items);
  const lastEvent = latestRunEvent(events_by_item);
  const agentStatusTone =
    run.status === 'failed'
      ? 'border-[rgba(176,64,64,0.18)] bg-[rgba(176,64,64,0.08)] text-[#8b3a3a]'
      : run.status === 'completed'
        ? 'border-[rgba(74,140,97,0.2)] bg-[rgba(74,140,97,0.1)] text-[#335443]'
        : 'border-[rgba(15,103,143,0.2)] bg-[rgba(15,103,143,0.08)] text-[var(--app-blue)]';
  const agentStatusLabel =
    run.status === 'failed'
      ? 'Run needs attention'
      : run.status === 'completed'
        ? 'Run finished'
        : 'Playbook is running live';
  const agentSummary =
    agentSnapshot.agentBrief
    || agentSnapshot.agentContextText
    || 'No extra note was provided. This run is using the playbook plus any secure credentials selected for it.';

  return (
    <PlatformShell teamId={teamId}>
      <button
        onClick={() => router.push(`/team/${teamId}/runs`)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--app-blue)] hover:underline"
      >
        <ArrowLeft size={14} />
        All runs
      </button>

      <div className="mb-6">
        <p className="landing-kicker">Run detail</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          {playbook_name || 'Playbook run'} #{run.id.slice(0, 8)}
        </h1>
        {run.use_sandbox && (
          <p className="mt-2 max-w-[72ch] text-sm text-[var(--app-muted)]">
            This run stays attached to the live sandbox so you can watch the playbook repeat its actions in the same browser session.
          </p>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        {[
          { label: 'Status', value: run.status, capitalize: true },
          { label: 'Total items', value: run.total_items },
          { label: 'Passed', value: run.success_count },
          { label: 'Success rate', value: `${successRate}%` },
        ].map(kpi => (
          <div key={kpi.label} className="panel-tight p-4">
            <p className="text-xs font-medium text-[var(--app-muted)]">{kpi.label}</p>
            <p className={`mt-0.5 text-xl font-extrabold ${kpi.capitalize ? 'capitalize' : ''}`}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {run.use_sandbox && (
        <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
          <section className="overflow-hidden rounded-[28px] border border-[var(--app-line)] bg-[linear-gradient(135deg,rgba(10,20,35,0.03),rgba(15,103,143,0.09))] p-5 shadow-[0_18px_40px_-24px_rgba(7,37,62,0.22)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="inline-flex rounded-2xl bg-[rgba(15,103,143,0.12)] p-2 text-[var(--app-blue)]">
                    <Sparkle size={18} weight="duotone" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--app-muted)]">
                      Playbook session
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
                      The preview is the run
                    </h2>
                  </div>
                </div>
                <p className="mt-4 max-w-[68ch] text-sm leading-6 text-[var(--app-muted)]">
                  Every listed playbook step runs against the exact browser session you see below.
                  You can watch the navigation, clicks, form input, and verification happen live.
                </p>
              </div>

              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${agentStatusTone}`}>
                <span className={`h-2 w-2 rounded-full ${
                  run.status === 'running' ? 'animate-pulse bg-current' : 'bg-current'
                }`} />
                {agentStatusLabel}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/60 bg-white/75 p-4 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  Session type
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--app-text)]">
                  Visible sandbox browser
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">
                  The playbook and your preview stay on the same browser tab.
                </p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/75 p-4 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  Started
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--app-text)]">
                  {formatDateTime(run.started_at)}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">
                  Status updates refresh automatically while the run is active.
                </p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/75 p-4 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  Last verification
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--app-text)]">
                  {lastEvent ? lastEvent.step_title : 'No verification yet'}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">
                  {lastEvent ? formatDateTime(lastEvent.created_at) : 'The run has not produced step logs yet.'}
                </p>
              </div>
            </div>
          </section>

          <section className="panel-tight p-5">
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-2xl bg-[rgba(15,103,143,0.08)] p-2 text-[var(--app-blue)]">
                <FileText size={18} weight="duotone" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
                  Agent context
                </p>
                <h2 className="mt-1 text-lg font-extrabold tracking-tight">
                  Run context
                </h2>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-2)] p-4">
              <p className="text-sm leading-6 text-[var(--app-text)]">
                {agentSummary}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-bg)] p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                  Files
                </p>
                <p className="mt-1 text-xl font-extrabold">{agentSnapshot.attachmentCount}</p>
              </div>
              <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-bg)] p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                  Text
                </p>
                <p className="mt-1 text-xl font-extrabold">{agentSnapshot.textAttachmentCount}</p>
              </div>
              <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-bg)] p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                  Images
                </p>
                <p className="mt-1 text-xl font-extrabold">{agentSnapshot.imageAttachmentCount}</p>
              </div>
            </div>

            {agentSnapshot.attachmentLines.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  Attached material
                </p>
                <div className="space-y-2">
                  {agentSnapshot.attachmentLines.map(line => (
                    <div
                      key={line}
                      className="rounded-xl border border-[var(--app-line)] bg-[var(--app-bg)] px-3 py-2 text-xs text-[var(--app-muted)]"
                    >
                      {line.replace(/^- /, '')}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Sandbox live viewer */}
      {run.use_sandbox && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex text-[var(--app-blue)]">
              <Desktop size={18} weight="regular" />
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--app-muted)]">
              Live sandbox
            </h2>
            <span className="rounded-full bg-[rgba(15,103,143,0.08)] px-2.5 py-1 text-[11px] font-bold text-[var(--app-blue)]">
              Playbook attached
            </span>
            {run.status === 'running' && (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[rgba(76,175,80,0.15)] px-2.5 py-0.5 text-[11px] font-bold text-[#4a8c61]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4a8c61] animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div
            className="panel overflow-hidden rounded-[28px] border border-[rgba(15,23,42,0.08)] bg-[#0f1720] shadow-[0_28px_80px_-36px_rgba(15,23,42,0.65)]"
            style={{ height: 'clamp(32rem, 72vh, 58rem)' }}
          >
            <iframe
              src={sandboxNovncUrl}
              className="h-full w-full border-0"
              allow="clipboard-read; clipboard-write"
              title="Sandbox browser — live view"
            />
          </div>
          <p className="mt-2 text-xs text-[var(--app-muted)]">
            You can interact with the browser above. The automation runs in the same session.
          </p>
        </div>
      )}

      {/* Items + events */}
      <div className="space-y-3">
        {items.map((item: RunItem, idx: number) => {
          const isExpanded = expandedItem === item.id;
          const itemEvents: RunEvent[] = events_by_item[item.id] || [];

          return (
            <div key={item.id} className="panel overflow-hidden">
              <button
                onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                {STATUS_ICON[item.status] ?? STATUS_ICON.pending}
                <span className="font-mono text-xs text-[var(--app-muted)] w-8 shrink-0">
                  Row {item.row_index + 1}
                </span>
                <span className="flex-1 text-sm font-semibold truncate">
                  {item.input_payload
                    ? Object.values(item.input_payload).join(' · ')
                    : `Item ${idx + 1}`}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${
                  item.status === 'completed'
                    ? 'bg-[rgba(123,155,134,0.18)] text-[#335443]'
                    : item.status === 'failed'
                    ? 'bg-[rgba(191,100,100,0.18)] text-[#8b3a3a]'
                    : 'bg-[var(--app-chip)] text-[var(--app-muted)]'
                }`}>
                  {item.status}
                </span>
              </button>

              {isExpanded && itemEvents.length > 0 && (
                <div className="border-t border-[var(--app-line)] bg-[var(--app-surface-2)] px-4 py-3">
                  <p className="mb-2 text-xs font-bold text-[var(--app-muted)] uppercase tracking-wider">
                    Verification log
                  </p>
                  <div className="space-y-2">
                    {itemEvents.map((ev: RunEvent) => (
                      <div
                        key={ev.id}
                        className="flex items-start gap-3 rounded-lg border border-[var(--app-line)] bg-[var(--app-bg)] px-3 py-2"
                      >
                        {STATUS_ICON[ev.status] ?? STATUS_ICON.pending}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{ev.step_title}</p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--app-muted)]">
                            {ev.expected_state && (
                              <span>Expected: <span className="font-mono">{ev.expected_state}</span></span>
                            )}
                            {ev.actual_state && (
                              <span>Actual: <span className="font-mono">{ev.actual_state}</span></span>
                            )}
                            {ev.vault_credential_used && (
                              <span className="inline-flex items-center gap-1 text-[var(--app-blue)]">
                                <Lock size={11} weight="fill" />
                                Using {ev.vault_credential_used} (secure)
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] text-[var(--app-muted)]">
                          Step {ev.step_sequence}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PlatformShell>
  );
}
