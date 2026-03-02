import Link from 'next/link';

import { PlatformShell } from '@/components/platform-shell';
import { apiGet } from '@/lib/api';
import type { RunSummary } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';

type Props = {
  params: Promise<{ teamId: string }>;
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'status-pill pending',
  running: 'status-pill running',
  completed: 'status-pill completed',
  failed: 'status-pill failed',
};

export default async function RunsPage({ params }: Props) {
  const { teamId } = await params;

  let runs: RunSummary[] = [];
  try {
    runs = await apiGet<RunSummary[]>(`/teams/${teamId}/runs`);
  } catch {
    runs = [];
  }

  const total = runs.length;
  const completed = runs.filter(r => r.status === 'completed').length;
  const failed = runs.filter(r => r.status === 'failed').length;
  const running = runs.filter(r => r.status === 'running' || r.status === 'pending').length;

  return (
    <PlatformShell teamId={teamId}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="landing-kicker">Execution history</p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Runs</h1>
        </div>
        <Link
          href={`/team/${teamId}/runs/new`}
          className="btn-primary rounded-full px-5 py-2.5 text-sm"
        >
          + New run
        </Link>
      </div>

      {/* KPI strip */}
      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total runs', value: total },
          { label: 'Completed', value: completed },
          { label: 'Failed', value: failed },
          { label: 'Active / pending', value: running },
        ].map(kpi => (
          <div key={kpi.label} className="panel-tight px-5 py-4">
            <dt className="text-xs uppercase tracking-[0.14em] text-[var(--app-muted)]">{kpi.label}</dt>
            <dd className="mt-1 text-3xl font-extrabold">{kpi.value}</dd>
          </div>
        ))}
      </dl>

      {/* Runs table */}
      {runs.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-xl font-bold">No runs yet</p>
          <p className="mt-2 text-[var(--app-muted)]">Start your first automation run from the dashboard or a playbook.</p>
          <Link
            href={`/team/${teamId}/runs/new`}
            className="btn-primary mt-6 inline-block rounded-full px-5 py-2.5 text-sm"
          >
            Start first run
          </Link>
        </div>
      ) : (
        <div className="panel overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--app-line)] bg-[var(--app-surface-2)]/60">
              <tr>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.14em] text-[var(--app-muted)]">Status</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.14em] text-[var(--app-muted)]">Playbook</th>
                <th className="hidden px-4 py-3 text-xs uppercase tracking-[0.14em] text-[var(--app-muted)] sm:table-cell">
                  Trigger
                </th>
                <th className="hidden px-4 py-3 text-xs uppercase tracking-[0.14em] text-[var(--app-muted)] md:table-cell">
                  Items
                </th>
                <th className="hidden px-4 py-3 text-xs uppercase tracking-[0.14em] text-[var(--app-muted)] lg:table-cell">
                  Started
                </th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.14em] text-[var(--app-muted)]"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr
                  key={run.id}
                  className="border-t border-[var(--app-line)] transition-colors first:border-t-0 hover:bg-[var(--app-chip)]/40"
                >
                  <td className="px-4 py-3">
                    <span className={STATUS_STYLES[run.status] ?? STATUS_STYLES.pending}>{run.status}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {run.playbook_name ?? 'Unknown playbook'}
                  </td>
                  <td className="hidden px-4 py-3 capitalize text-[var(--app-muted)] sm:table-cell">
                    {run.trigger_type?.replace('_', ' ') ?? '—'}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[var(--app-muted)]">{run.total_items ?? '—'}</span>
                      {run.total_items > 0 && (
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--app-chip)]">
                          <div
                            className="h-full rounded-full bg-[var(--app-sage)]"
                            style={{ width: `${Math.round((run.success_count / run.total_items) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--app-muted)] lg:table-cell">
                    {run.started_at ? formatRelativeTime(run.started_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/team/${teamId}/runs/${run.id}`}
                      className="text-xs font-semibold text-[var(--app-blue)] hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PlatformShell>
  );
}
