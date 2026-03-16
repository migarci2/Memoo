'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useState } from 'react';
import {
  ArrowLeft,
  ArrowSquareOut,
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
    <span className="inline-flex animate-spin text-[var(--app-blue)]">
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

function formatStatusLabel(status: string): string {
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'running') return 'running';
  return 'queued';
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
  const runStatus = detail?.run.status;

  const fetchDetail = useEffectEvent(() => {
    apiGet<RunDetail>(`/runs/${runId}`)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  });

  useEffect(() => {
    fetchDetail();
  }, [runId]);

  useEffect(() => {
    if (runStatus !== 'running' && runStatus !== 'pending') return;
    const timer = setInterval(fetchDetail, 2000);
    return () => clearInterval(timer);
  }, [runId, runStatus]);

  if (loading) {
    return (
      <PlatformShell teamId={teamId}>
        <div className="py-20 text-center text-[var(--app-muted)]">
          <span className="mb-2 inline-flex animate-spin"><CircleNotch size={24} /></span>
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

  const activeItem =
    (expandedItem ? items.find(item => item.id === expandedItem) : null)
    ?? items.find(item => item.status === 'running')
    ?? items.find(item => item.status === 'failed')
    ?? items[0]
    ?? null;
  const activeItemEvents = activeItem ? events_by_item[activeItem.id] || [] : [];
  const completedEvents = activeItemEvents.filter(event => event.status === 'success');
  const lastSeq = completedEvents.length > 0 ? Math.max(...completedEvents.map(event => event.step_sequence)) : 0;
  const currentSeq = activeItem?.status === 'running' ? lastSeq + 1 : -1;
  const selectedRowLabel = activeItem ? `Row ${activeItem.row_index + 1}` : 'No row selected';

  const sandboxHost = (() => {
    try {
      return new URL(sandboxNovncUrl).host;
    } catch {
      return 'Sandbox connection';
    }
  })();

  return (
    <PlatformShell
      teamId={teamId}
      title={`${playbook_name || 'Run'} #${run.id.slice(0, 8)}`}
      subtitle={run.use_sandbox ? 'Live sandbox execution' : 'Headless background run'}
    >
      <button
        onClick={() => router.push(`/team/${teamId}/runs`)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--app-brand-sand)] hover:underline"
      >
        <ArrowLeft size={14} />
        All runs
      </button>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Status',
            value: formatStatusLabel(run.status),
            note: run.use_sandbox ? 'Live browser session' : 'Headless background mode',
          },
          {
            label: 'Items',
            value: run.total_items,
            note: `${run.failed_count} failed rows`,
          },
          {
            label: 'Passed',
            value: run.success_count,
            note: `${Math.max(run.total_items - run.success_count, 0)} rows still pending or failed`,
          },
          {
            label: 'Success',
            value: `${successRate}%`,
            note: `Started ${formatDateTime(run.started_at)}`,
          },
        ].map(kpi => (
          <div key={kpi.label} className="panel overflow-hidden p-0">
            <div className="h-1.5 bg-[linear-gradient(90deg,rgba(31,92,132,0.88),rgba(27,139,130,0.55),rgba(217,138,63,0.72))]" />
            <div className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">{kpi.label}</p>
              <p className="mt-1 text-xl font-bold capitalize">{kpi.value}</p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--app-muted)]">{kpi.note}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className="space-y-6">
          <section className="panel overflow-hidden p-0">
            <div className={`grid gap-0 ${run.use_sandbox ? '2xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]' : ''}`}>
              <div className={`${run.use_sandbox ? 'border-b border-[var(--app-line-soft)] 2xl:border-b-0 2xl:border-r' : ''} p-5 md:p-6`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">Run overview</p>
                    <h2 className="mt-2 text-2xl font-extrabold tracking-tight md:text-[2rem]">
                      {playbook_name || 'Untitled run'}
                    </h2>
                    <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-[var(--app-muted)]">
                      {run.use_sandbox
                        ? 'The preview stays visible, but evidence and row-level context now lead the page so the browser no longer eats the whole composition.'
                        : 'This run executed in the background. Use the row list and evidence feed to inspect what happened without a live browser preview.'}
                    </p>
                  </div>
                  <div className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${agentStatusTone}`}>
                    {agentStatusLabel}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[18px] border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.02)] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">Started</p>
                    <p className="mt-1 text-sm font-semibold">{formatDateTime(run.started_at)}</p>
                  </div>
                  <div className="rounded-[18px] border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.02)] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">Finished</p>
                    <p className="mt-1 text-sm font-semibold">{formatDateTime(run.ended_at)}</p>
                  </div>
                  <div className="rounded-[18px] border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.02)] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">Trigger</p>
                    <p className="mt-1 text-sm font-semibold capitalize">{run.trigger_type || 'manual'}</p>
                  </div>
                  <div className="rounded-[18px] border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.02)] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">Vault access</p>
                    <p className="mt-1 text-sm font-semibold">{run.selected_vault_credential_ids.length} linked credentials</p>
                  </div>
                </div>

                <div className="mt-5 rounded-[22px] border border-[var(--app-line-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,237,231,0.92))] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">Selected row</p>
                      <p className="mt-1 text-sm font-semibold">{selectedRowLabel}</p>
                    </div>
                    {activeItem ? (
                      <span className="rounded-full border border-[var(--app-line-soft)] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                        {formatStatusLabel(activeItem.status)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--app-muted)]">
                    {lastEvent?.actual_state
                      || lastEvent?.step_title
                      || 'No agent note yet. The timeline will populate once the first interaction lands.'}
                  </p>
                </div>
              </div>

              {run.use_sandbox ? (
                <div className="bg-[linear-gradient(180deg,rgba(15,23,32,0.03),rgba(15,23,32,0.07))] p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex rounded-xl bg-[rgba(217,138,63,0.12)] p-2.5 text-[var(--app-brand-sand)]">
                        <Desktop size={20} weight="fill" />
                      </span>
                      <div>
                        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">Live sandbox</h2>
                        <p className="text-lg font-bold">Browser preview</p>
                      </div>
                    </div>
                    <a
                      href={sandboxNovncUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-line-soft)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-soft)]"
                    >
                      Open full view
                      <ArrowSquareOut size={14} weight="bold" />
                    </a>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-[24px] border border-[rgba(15,23,32,0.12)] bg-[#0f1720] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <div className="border-b border-white/8 px-4 py-3 text-[11px] font-semibold tracking-[0.08em] text-white/55">
                      {sandboxHost}
                    </div>
                    <div className="aspect-[16/10] max-h-[34rem] w-full">
                      <iframe
                        src={sandboxNovncUrl}
                        className="h-full w-full border-0"
                        allow="clipboard-read; clipboard-write"
                        title="Sandbox"
                      />
                    </div>
                  </div>

                  <p className="mt-3 max-w-[46ch] text-xs leading-relaxed text-[var(--app-muted)]">
                    The browser stays available here, but the rest of the page can breathe around it.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          {detail.playbook_steps && detail.playbook_steps.length > 0 ? (
            <section className="panel p-5">
              <div className="mb-4 flex items-center gap-2">
                <FileText size={18} className="text-[var(--app-muted)]" />
                <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">Playbook flow</h2>
              </div>
              <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-2">
                {detail.playbook_steps.map((step, idx) => {
                  const seq = step.sequence ?? idx + 1;
                  const ev = activeItemEvents.find(event => event.step_sequence === seq);
                  const status = ev ? ev.status : (seq === currentSeq ? 'running' : (seq <= lastSeq ? 'success' : 'pending'));

                  let cls = 'shrink-0 w-48 rounded-[18px] border p-3.5 transition-all ';
                  if (status === 'success') cls += 'border-emerald-100 bg-emerald-50/30';
                  else if (status === 'running') cls += 'border-amber-200 bg-amber-50/50 ring-1 ring-amber-200';
                  else if (status === 'failed') cls += 'border-red-100 bg-red-50/30';
                  else cls += 'border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.01)] opacity-60';

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
          ) : null}

          <section className="panel p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Desktop size={18} className="text-[var(--app-brand-sand)]" />
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">Execution evidence</h2>
                  <p className="mt-1 text-sm text-[var(--app-muted)]">Captured output for the currently selected row.</p>
                </div>
              </div>
              {activeItem ? (
                <span className="rounded-full border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.03)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                  {selectedRowLabel}
                </span>
              ) : null}
            </div>

            {activeItemEvents.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-[var(--app-line-soft)] px-4 py-8 text-center text-sm text-[var(--app-muted)]">
                Waiting for the first step event.
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {activeItemEvents.map(event => (
                  <div key={event.id} className="overflow-hidden rounded-[22px] border border-[var(--app-line-soft)] bg-white shadow-[var(--app-shadow-soft)]">
                    {event.screenshot_url ? (
                      <img
                        src={event.screenshot_url}
                        alt={`Evidence for ${event.step_title}`}
                        className="aspect-[16/10] w-full bg-[rgba(27,42,74,0.04)] object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[16/10] items-center justify-center bg-[rgba(27,42,74,0.03)] px-6 text-center text-xs font-semibold text-[var(--app-muted)]">
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

                      {event.actual_state ? (
                        <p className="text-sm leading-relaxed text-[var(--app-text)]">{event.actual_state}</p>
                      ) : null}

                      <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.12em]">
                        {event.expected_state ? (
                          <span className="rounded-full border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.03)] px-2.5 py-1 text-[var(--app-muted)]">
                            Expected: {event.expected_state}
                          </span>
                        ) : null}
                        {event.vault_credential_used ? (
                          <span className="rounded-full border border-[rgba(217,138,63,0.18)] bg-[rgba(217,138,63,0.08)] px-2.5 py-1 text-[var(--app-brand-sand)]">
                            Vault: {event.vault_credential_used}
                          </span>
                        ) : null}
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
        </div>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <div className="panel p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkle size={18} className="text-[var(--app-brand-sand)]" />
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">Run context</h2>
            </div>
            <p className="mb-4 rounded-lg border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.02)] p-3 text-sm leading-relaxed text-[var(--app-text)]">
              {agentSnapshot.agentBrief || agentSnapshot.agentContextText || 'No custom context.'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.02)] p-2.5 text-center">
                <p className="text-[10px] font-bold uppercase text-[var(--app-muted)]">Files</p>
                <p className="text-lg font-bold">{agentSnapshot.attachmentCount}</p>
              </div>
              <div className="rounded-lg border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.02)] p-2.5 text-center">
                <p className="text-[10px] font-bold uppercase text-[var(--app-muted)]">Text</p>
                <p className="text-lg font-bold">{agentSnapshot.textAttachmentCount}</p>
              </div>
            </div>

            {lastEvent ? (
              <div className="mt-4 rounded-xl border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.02)] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                  Latest agent note
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--app-text)]">
                  {lastEvent.actual_state || lastEvent.step_title}
                </p>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <h2 className="px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Run items</h2>
            {items.map(item => {
              const expanded = expandedItem === item.id;
              const evs = events_by_item[item.id] || [];

              return (
                <div
                  key={item.id}
                  className={`panel overflow-hidden transition-all ${expanded ? 'border-[var(--app-line-strong)] shadow-[var(--app-shadow-panel)]' : ''}`}
                >
                  <button
                    onClick={() => setExpandedItem(expanded ? null : item.id)}
                    className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-[rgba(27,42,74,0.01)]"
                  >
                    {STATUS_ICON[item.status] || STATUS_ICON.pending}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">Row {item.row_index + 1}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--app-muted)]">
                        {evs.length} event{evs.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase ${item.status === 'completed' ? 'text-emerald-600' : item.status === 'failed' ? 'text-red-600' : 'text-[var(--app-muted)]'}`}>
                      {formatStatusLabel(item.status)}
                    </span>
                  </button>
                  {expanded && evs.length > 0 ? (
                    <div className="space-y-2 border-t border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.01)] p-3">
                      {evs.map(ev => (
                        <div key={ev.id} className="flex items-start gap-2 text-[11px]">
                          <span className="mt-0.5">{STATUS_ICON[ev.status]}</span>
                          <p className="flex-1 font-medium">{ev.step_title}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </PlatformShell>
  );
}
