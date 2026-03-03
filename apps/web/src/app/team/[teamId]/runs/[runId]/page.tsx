'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  CircleNotch,
  Desktop,
  Lock,
  XCircle,
} from '@phosphor-icons/react';

import { PlatformShell } from '@/components/platform-shell';
import { apiGet } from '@/lib/api';
import { SANDBOX_NOVNC_URL } from '@/lib/config';
import type { RunDetail, RunEvent, RunItem } from '@/lib/types';

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle size={16} weight="fill" className="text-[#4a8c61]" />,
  success: <CheckCircle size={16} weight="fill" className="text-[#4a8c61]" />,
  failed: <XCircle size={16} weight="fill" className="text-[#b04040]" />,
  pending: <CircleNotch size={16} className="text-[var(--app-muted)]" />,
  running: (
    <span className="animate-spin inline-flex text-[var(--app-blue)]">
      <CircleNotch size={16} />
    </span>
  ),
};

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
          {playbook_name || 'Run'} #{run.id.slice(0, 8)}
        </h1>
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

      {/* Sandbox live viewer */}
      {run.use_sandbox && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Desktop size={18} weight="duotone" className="text-[var(--app-blue)]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--app-muted)]">
              Live sandbox
            </h2>
            {run.status === 'running' && (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[rgba(76,175,80,0.15)] px-2.5 py-0.5 text-[11px] font-bold text-[#4a8c61]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4a8c61] animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div className="panel overflow-hidden" style={{ aspectRatio: '16/10' }}>
            <iframe
              src={SANDBOX_NOVNC_URL}
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
