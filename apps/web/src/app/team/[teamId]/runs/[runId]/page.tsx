import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PlatformShell } from '@/components/platform-shell';
import { apiGet } from '@/lib/api';
import type { RunDetail } from '@/lib/types';
import { formatDate, formatRelativeTime } from '@/lib/utils';

type Props = {
  params: Promise<{ teamId: string; runId: string }>;
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'status-pill pending',
  running: 'status-pill running',
  completed: 'status-pill completed',
  failed: 'status-pill failed',
  success: 'status-pill completed',
};

const EVENT_STATUS: Record<string, string> = {
  success: 'text-[var(--app-sage)]',
  failed: 'text-red-400',
  error: 'text-red-400',
  running: 'text-[var(--app-blue)]',
};

export default async function RunDetailPage({ params }: Props) {
  const { teamId, runId } = await params;

  let detail: RunDetail;
  try {
    detail = await apiGet<RunDetail>(`/runs/${runId}`);
  } catch {
    notFound();
  }

  const { run, items } = detail;
  const successPct =
    run.total_items > 0 ? Math.round((run.success_count / run.total_items) * 100) : 0;

  return (
    <PlatformShell teamId={teamId}>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-[var(--app-muted)]">
        <Link href={`/team/${teamId}`} className="hover:text-[var(--app-text)]">Dashboard</Link>
        <span>/</span>
        <Link href={`/team/${teamId}/runs`} className="hover:text-[var(--app-text)]">Runs</Link>
        <span>/</span>
        <span className="font-mono text-[var(--app-text)]">{runId.slice(0, 8)}…</span>
      </nav>

      {/* Summary header */}
      <div className="panel mb-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className={STATUS_STYLES[run.status] ?? STATUS_STYLES.pending}>{run.status}</span>
              <span className="font-mono text-xs text-[var(--app-muted)]">{runId}</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Run detail</h1>
          </div>
          <Link
            href={`/team/${teamId}/runs/new?playbookId=${run.playbook_version_id}`}
            className="btn-secondary rounded-full px-4 py-2 text-sm"
          >
            Run again
          </Link>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--app-line)] pt-5 sm:grid-cols-4">
          {[
            { label: 'Trigger', value: run.trigger_type?.replace('_', ' ') ?? '—' },
            { label: 'Started', value: run.started_at ? formatRelativeTime(run.started_at) : '—' },
            { label: 'Ended', value: run.ended_at ? formatDate(run.ended_at) : '—' },
            { label: 'Total items', value: run.total_items },
          ].map(m => (
            <div key={m.label}>
              <dt className="text-xs uppercase tracking-[0.14em] text-[var(--app-muted)]">{m.label}</dt>
              <dd className="mt-1 font-semibold capitalize">{String(m.value)}</dd>
            </div>
          ))}
        </dl>

        {/* Progress bar */}
        {run.total_items > 0 && (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--app-muted)]">
              <span>{run.success_count} succeeded · {run.failed_count} failed</span>
              <span className="font-semibold">{successPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--app-chip)]">
              <div
                className="h-full rounded-full bg-[var(--app-sage)] transition-all"
                style={{ width: `${successPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Items */}
      <section>
        <h2 className="mb-4 text-xl font-bold">Items ({items.length})</h2>

        {items.length === 0 ? (
          <div className="panel-tight px-5 py-8 text-center">
            <p className="text-[var(--app-muted)]">No items in this run.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <details
                key={item.id}
                className="panel group overflow-hidden p-0"
              >
                {/* Row summary */}
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4 hover:bg-[var(--app-chip)]/40">
                  <span className="font-mono text-xs text-[var(--app-muted)]">
                    #{String(item.row_index + 1).padStart(2, '0')}
                  </span>
                  <span className={STATUS_STYLES[item.status] ?? STATUS_STYLES.pending}>
                    {item.status}
                  </span>
                  {Object.entries(item.input_payload ?? {}).slice(0, 3).map(([k, v]) => (
                    <span key={k} className="text-sm">
                      <span className="text-[var(--app-muted)]">{k}:</span>{' '}
                      <span className="font-medium">{String(v)}</span>
                    </span>
                  ))}
                  {item.error_message ? (
                    <span className="ml-auto text-xs text-red-400">{item.error_message}</span>
                  ) : null}
                </summary>

                {/* Expanded: events + evidence */}
                <div className="border-t border-[var(--app-line)] px-5 py-4">
                  {item.events.length > 0 && (
                    <div className="mb-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                        Event log
                      </p>
                      <ol className="space-y-1.5">
                        {item.events.map((ev, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span
                              className={`mt-0.5 font-mono text-xs font-bold ${
                                EVENT_STATUS[ev.status] ?? 'text-[var(--app-muted)]'
                              }`}
                            >
                              {ev.status.toUpperCase()}
                            </span>
                            <span className="font-medium">{ev.step_title}</span>
                            {ev.message ? (
                              <span className="text-[var(--app-muted)]">— {ev.message}</span>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {item.evidence.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                        Evidence
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {item.evidence.map((ev, i) => (
                          <a
                            key={i}
                            href={ev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-[var(--app-line)] bg-[var(--app-surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--app-blue)] hover:bg-[var(--app-chip)]"
                          >
                            {ev.evidence_type} ↗
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.events.length === 0 && item.evidence.length === 0 && (
                    <p className="text-sm text-[var(--app-muted)]">No events recorded for this item.</p>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </PlatformShell>
  );
}
