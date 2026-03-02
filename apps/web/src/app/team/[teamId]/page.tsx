import Link from 'next/link';

import { PlatformShell } from '@/components/platform-shell';
import { apiGet } from '@/lib/api';
import type { Playbook, Run, TeamOverview } from '@/lib/types';

type PageProps = {
  params: Promise<{ teamId: string }>;
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-[rgba(123,155,134,0.18)] text-[#335443]',
  running: 'bg-[rgba(95,119,132,0.18)] text-[#3f5e6f]',
  pending: 'bg-[rgba(191,155,106,0.18)] text-[#7d5d31]',
  failed: 'bg-red-100 text-red-700',
};

export default async function TeamDashboardPage({ params }: PageProps) {
  const { teamId } = await params;

  const [overview, playbooks, runs] = await Promise.all([
    apiGet<TeamOverview>(`/teams/${teamId}/dashboard`),
    apiGet<Playbook[]>(`/teams/${teamId}/playbooks`),
    apiGet<Run[]>(`/teams/${teamId}/runs`),
  ]);

  const successRate =
    overview.total_runs > 0
      ? Math.round((overview.successful_runs / overview.total_runs) * 100)
      : 0;

  return (
    <PlatformShell
      teamId={teamId}
      title="Dashboard"
      subtitle="Automation overview — playbooks, runs, and secure credentials."
    >
      {/* KPI Strip */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Playbooks', value: overview.playbooks_count, desc: `${overview.active_playbooks} active` },
          { label: 'Total runs', value: overview.total_runs, desc: 'Batch executions' },
          { label: 'Success rate', value: `${successRate}%`, desc: `${overview.successful_runs} successful` },
          { label: 'Vault', value: overview.vault_credentials, desc: 'Secure credentials' },
        ].map(kpi => (
          <article key={kpi.label} className="panel p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">{kpi.label}</p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight">{kpi.value}</p>
            <p className="mt-1 text-sm text-[var(--app-muted)]">{kpi.desc}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        {/* Recent Runs */}
        <article className="panel p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="landing-kicker">Execution log</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Recent runs</h2>
            </div>
            <Link
              href={`/team/${teamId}/runs`}
              className="rounded-full border border-[var(--app-line)] bg-[var(--app-chip)] px-3 py-1 text-xs font-semibold text-[var(--app-blue)]"
            >
              View all
            </Link>
          </div>

          {runs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--app-line)] px-6 py-10 text-center">
              <p className="font-semibold">No runs yet</p>
              <p className="mt-1 text-sm text-[var(--app-muted)]">
                Execute a playbook with batch data to see results here.
              </p>
              <Link
                href={`/team/${teamId}/runs/new`}
                className="btn-primary mt-4 inline-block rounded-full px-4 py-2 text-sm"
              >
                Start a run
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.slice(0, 5).map(run => (
                <Link
                  key={run.id}
                  href={`/team/${teamId}/runs/${run.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--app-line)] px-4 py-3 transition-colors hover:bg-[var(--app-chip)]/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {run.input_source ?? `Run ${run.id.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-[var(--app-muted)]">
                      {run.total_items} items · {run.success_count} passed · {run.failed_count} failed
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${
                      STATUS_COLORS[run.status] ?? STATUS_COLORS.pending
                    }`}
                  >
                    {run.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </article>

        {/* Quick Actions + Recent Playbooks */}
        <div className="space-y-4">
          {/* Quick actions */}
          <article className="panel p-6">
            <p className="landing-kicker">Automation</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Quick actions</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link
                href={`/team/${teamId}/capture`}
                className="btn-primary flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
              >
                Teach a workflow
              </Link>
              <Link
                href={`/team/${teamId}/runs/new`}
                className="btn-secondary flex items-center justify-center gap-2 rounded-xl border border-[var(--app-line)] px-4 py-3 text-sm font-semibold"
              >
                Run batch
              </Link>
            </div>
          </article>

          {/* Recent playbooks */}
          <article className="panel p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="landing-kicker">Library</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight">Playbooks</h2>
              </div>
              <Link
                href={`/team/${teamId}/playbooks`}
                className="rounded-full border border-[var(--app-line)] bg-[var(--app-chip)] px-3 py-1 text-xs font-semibold text-[var(--app-blue)]"
              >
                View all
              </Link>
            </div>

            {playbooks.length === 0 ? (
              <p className="text-sm text-[var(--app-muted)]">No playbooks yet. Teach a workflow to get started.</p>
            ) : (
              <div className="space-y-2">
                {playbooks.slice(0, 4).map(playbook => (
                  <Link
                    key={playbook.id}
                    href={`/team/${teamId}/playbooks/${playbook.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--app-line)] px-3 py-2.5 transition-colors hover:bg-[var(--app-chip)]/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{playbook.name}</p>
                      <div className="flex gap-1.5 mt-0.5">
                        {playbook.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[11px] text-[var(--app-muted)]">{tag}</span>
                        ))}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--app-chip)] px-2 py-0.5 text-[11px] font-bold capitalize text-[var(--app-muted)]">
                      {playbook.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>
    </PlatformShell>
  );
}
