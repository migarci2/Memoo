'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  CircleNotch,
  Desktop,
  FileText,
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

  const fetchDetail = () => {
    apiGet<RunDetail>(`/runs/${runId}`)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(fetchDetail, [runId]);

  useEffect(() => {
    if (!detail || (detail.run.status !== 'running' && detail.run.status !== 'pending')) return;
    const timer = setInterval(fetchDetail, 2000);
    return () => clearInterval(timer);
  }, [detail?.run?.status, runId]);

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
  const successRate = run.total_items > 0 ? Math.round((run.success_count / run.total_items) * 100) : 0;
  const sandboxNovncUrl = getSandboxNovncUrl();
  const agentSnapshot = buildAgentSnapshot(items);
  const lastEvent = latestRunEvent(events_by_item);

  const agentStatusTone =
    run.status === 'failed'
      ? 'border-red-100 bg-red-50 text-red-700'
      : run.status === 'completed'
        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
        : 'border-amber-100 bg-amber-50 text-amber-700';

  const agentStatusLabel =
    run.status === 'failed'
      ? 'Run failed'
      : run.status === 'completed'
        ? 'Run finished'
        : 'Running…';

  return (
    <PlatformShell 
      teamId={teamId}
      title={`${playbook_name || 'Run'} #${run.id.slice(0, 8)}`}
      subtitle={run.use_sandbox ? "Live sandbox execution" : "Headless background run"}
    >
      <button
        onClick={() => router.push(`/team/${teamId}/runs`)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--app-brand-sand)] hover:underline"
      >
        <ArrowLeft size={14} />
        All runs
      </button>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        {[
          { label: 'Status', value: run.status },
          { label: 'Items', value: run.total_items },
          { label: 'Passed', value: run.success_count },
          { label: 'Success', value: `${successRate}%` },
        ].map(kpi => (
          <div key={kpi.label} className="panel p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">{kpi.label}</p>
            <p className="mt-1 text-lg font-bold capitalize">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px] mb-8">
        <div className="space-y-6">
          {run.use_sandbox && (
            <section className="panel overflow-hidden p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex rounded-xl bg-[rgba(217,138,63,0.1)] p-2.5 text-[var(--app-brand-sand)]">
                    <Desktop size={20} weight="fill" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">Live Sandbox</h2>
                    <p className="text-lg font-bold">Browser Preview</p>
                  </div>
                </div>
                <div className={`rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase ${agentStatusTone}`}>
                  {agentStatusLabel}
                </div>
              </div>
              
              <div
                className="overflow-hidden rounded-xl border border-[rgba(0,0,0,0.1)] bg-[#0f1720]"
                style={{ height: '480px' }}
              >
                <iframe
                  src={sandboxNovncUrl}
                  className="h-full w-full border-0"
                  allow="clipboard-read; clipboard-write"
                  title="Sandbox"
                />
              </div>
            </section>
          )}

          {detail.playbook_steps && detail.playbook_steps.length > 0 && (() => {
            const activeItem = expandedItem ? items.find(i => i.id === expandedItem) : (items.find(i => i.status === 'running') || items[0]);
            const activeItemEvents = activeItem ? events_by_item[activeItem.id] || [] : [];
            const completedEvents = activeItemEvents.filter(e => e.status === 'success');
            const lastSeq = completedEvents.length > 0 ? Math.max(...completedEvents.map(e => e.step_sequence)) : 0;
            const currentSeq = activeItem?.status === 'running' ? lastSeq + 1 : -1;

            return (
              <>
                <section className="panel p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <FileText size={18} className="text-[var(--app-muted)]" />
                    <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">Playbook Flow</h2>
                  </div>
                  <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-2">
                    {detail.playbook_steps.map((step, idx) => {
                      const seq = step.sequence ?? idx + 1;
                      const ev = activeItemEvents.find(e => e.step_sequence === seq);
                      const status = ev ? ev.status : (seq === currentSeq ? 'running' : (seq <= lastSeq ? 'success' : 'pending'));
                      
                      let cls = "shrink-0 w-44 p-3 rounded-xl border transition-all ";
                      if (status === 'success') cls += "border-emerald-100 bg-emerald-50/30";
                      else if (status === 'running') cls += "border-amber-200 bg-amber-50/50 ring-1 ring-amber-200";
                      else if (status === 'failed') cls += "border-red-100 bg-red-50/30";
                      else cls += "border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.01)] opacity-60";

                      return (
                        <div key={idx} className={cls}>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--app-text)] text-[10px] font-bold text-white">
                              {seq}
                            </span>
                            <span className="truncate text-[9px] font-bold uppercase tracking-wider text-[var(--app-muted)]">
                              {step.step_type}
                            </span>
                          </div>
                          <p className="truncate text-xs font-bold">{step.title || 'Step'}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="panel p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Desktop size={18} className="text-[var(--app-brand-sand)]" />
                      <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">Execution Evidence</h2>
                    </div>
                    {activeItem ? (
                      <span className="rounded-full border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.03)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                        Row {activeItem.row_index + 1}
                      </span>
                    ) : null}
                  </div>

                  {activeItemEvents.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--app-line-soft)] px-4 py-6 text-center text-sm text-[var(--app-muted)]">
                      Waiting for the first step event.
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {activeItemEvents.map(event => (
                        <div key={event.id} className="overflow-hidden rounded-2xl border border-[var(--app-line-soft)] bg-white">
                          {event.screenshot_url ? (
                            <img
                              src={event.screenshot_url}
                              alt={`Evidence for ${event.step_title}`}
                              className="h-56 w-full bg-[rgba(27,42,74,0.04)] object-cover"
                            />
                          ) : (
                            <div className="flex h-24 items-center justify-center bg-[rgba(27,42,74,0.03)] text-xs font-semibold text-[var(--app-muted)]">
                              Screenshot not available for this step
                            </div>
                          )}
                          <div className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                                  Step {event.step_sequence}
                                </p>
                                <p className="mt-1 text-sm font-semibold">{event.step_title}</p>
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                                event.status === 'success'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : event.status === 'failed'
                                    ? 'bg-red-50 text-red-700'
                                    : 'bg-amber-50 text-amber-700'
                              }`}>
                                {event.status}
                              </span>
                            </div>

                            {event.actual_state && (
                              <p className="text-sm leading-relaxed text-[var(--app-text)]">
                                {event.actual_state}
                              </p>
                            )}

                            <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.12em]">
                              {event.expected_state && (
                                <span className="rounded-full border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.03)] px-2.5 py-1 text-[var(--app-muted)]">
                                  Expected: {event.expected_state}
                                </span>
                              )}
                              {event.vault_credential_used && (
                                <span className="rounded-full border border-[rgba(217,138,63,0.18)] bg-[rgba(217,138,63,0.08)] px-2.5 py-1 text-[var(--app-brand-sand)]">
                                  Vault: {event.vault_credential_used}
                                </span>
                              )}
                              <span className="rounded-full border border-[var(--app-line-soft)] bg-white px-2.5 py-1 text-[var(--app-muted)]">
                                {formatDateTime(event.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            );
          })()}
        </div>

        <aside className="space-y-6">
          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkle size={18} className="text-[var(--app-brand-sand)]" />
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">Run Context</h2>
            </div>
            <p className="text-sm leading-relaxed text-[var(--app-text)] bg-[rgba(27,42,74,0.02)] p-3 rounded-lg border border-[var(--app-line-soft)] mb-4">
              {agentSnapshot.agentBrief || agentSnapshot.agentContextText || 'No custom context.'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[rgba(27,42,74,0.02)] p-2.5 rounded-lg border border-[var(--app-line-soft)] text-center">
                <p className="text-[10px] font-bold uppercase text-[var(--app-muted)]">Files</p>
                <p className="text-lg font-bold">{agentSnapshot.attachmentCount}</p>
              </div>
              <div className="bg-[rgba(27,42,74,0.02)] p-2.5 rounded-lg border border-[var(--app-line-soft)] text-center">
                <p className="text-[10px] font-bold uppercase text-[var(--app-muted)]">Text</p>
                <p className="text-lg font-bold">{agentSnapshot.textAttachmentCount}</p>
              </div>
            </div>

            {lastEvent && (
              <div className="mt-4 rounded-xl border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.02)] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                  Latest agent note
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--app-text)]">
                  {lastEvent.actual_state || lastEvent.step_title}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)] px-1">Run Items</h2>
            {items.map(item => {
              const expanded = expandedItem === item.id;
              const evs = events_by_item[item.id] || [];
              return (
                <div key={item.id} className="panel overflow-hidden">
                  <button
                    onClick={() => setExpandedItem(expanded ? null : item.id)}
                    className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-[rgba(27,42,74,0.01)]"
                  >
                    {STATUS_ICON[item.status] || STATUS_ICON.pending}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">Row {item.row_index + 1}</p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase ${item.status === 'completed' ? 'text-emerald-600' : item.status === 'failed' ? 'text-red-600' : 'text-[var(--app-muted)]'}`}>
                      {item.status}
                    </span>
                  </button>
                  {expanded && evs.length > 0 && (
                    <div className="border-t border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.01)] p-3 space-y-2">
                      {evs.map(ev => (
                        <div key={ev.id} className="flex items-start gap-2 text-[11px]">
                          <span className="mt-0.5">{STATUS_ICON[ev.status]}</span>
                          <p className="flex-1 font-medium">{ev.step_title}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </PlatformShell>
  );
}
