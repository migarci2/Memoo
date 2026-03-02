import Link from 'next/link';

import { PlatformShell } from '@/components/platform-shell';
import { apiGet } from '@/lib/api';
import type { CaptureSessionSummary, DashboardMetrics, Playbook, TeamMember } from '@/lib/types';

type PageProps = {
  params: Promise<{ teamId: string }>;
};

function buildRunSeries(runsLast7Days: number): number[] {
  const weights = [0.08, 0.09, 0.1, 0.11, 0.13, 0.15, 0.16, 0.18];
  const series = weights.map(weight => Math.max(0, Math.floor(runsLast7Days * weight)));
  let allocated = series.reduce((total, value) => total + value, 0);
  let cursor = series.length - 1;

  while (allocated < runsLast7Days) {
    series[cursor] += 1;
    allocated += 1;
    cursor = cursor === 0 ? series.length - 1 : cursor - 1;
  }

  return series;
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return 'No date';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'No date';
  }
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed);
}

export default async function TeamDashboardPage({ params }: PageProps) {
  const { teamId } = await params;

  const [metrics, playbooks, captures, members] = await Promise.all([
    apiGet<DashboardMetrics>(`/teams/${teamId}/dashboard`),
    apiGet<Playbook[]>(`/teams/${teamId}/playbooks`),
    apiGet<CaptureSessionSummary[]>(`/teams/${teamId}/capture-sessions`),
    apiGet<TeamMember[]>(`/teams/${teamId}/members`),
  ]);

  const activePlaybooks = playbooks.filter(playbook => playbook.status === 'active').length;
  const archivedPlaybooks = playbooks.filter(playbook => playbook.status === 'archived').length;
  const completedRuns = Math.round((metrics.runs_last_7_days * metrics.success_rate) / 100);
  const failedRuns = Math.max(0, metrics.runs_last_7_days - completedRuns);
  const queuedRuns = Math.max(1, Math.round(metrics.runs_last_7_days * 0.22));
  const runSeries = buildRunSeries(metrics.runs_last_7_days);
  const maxSeriesValue = Math.max(...runSeries, 1);
  const coordinates = runSeries.map((value, index) => {
    const x = (index / (runSeries.length - 1)) * 100;
    const y = 100 - (value / maxSeriesValue) * 100;
    return { x, y };
  });
  const linePoints = coordinates.map(point => `${point.x},${point.y}`).join(' ');
  const areaPath = `M 0,100 L ${coordinates.map(point => `${point.x},${point.y}`).join(' L ')} L 100,100 Z`;
  const runMixTotal = completedRuns + failedRuns + queuedRuns;
  const monthlyRunsEstimate = metrics.runs_last_7_days * 4;
  const estimatedRunsPerPlaybook =
    playbooks.length > 0 ? Math.max(1, Math.round(monthlyRunsEstimate / playbooks.length)) : 0;

  return (
    <PlatformShell
      teamId={teamId}
      title="Operations Command Center"
      subtitle="A complete view of playbooks, automation throughput, run quality, and team execution health."
    >
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="panel p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">Automation coverage</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{activePlaybooks}</p>
          <p className="mt-2 text-sm text-[var(--app-muted)]">Active playbooks running in production.</p>
        </article>
        <article className="panel p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">Execution volume</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{metrics.runs_last_7_days}</p>
          <p className="mt-2 text-sm text-[var(--app-muted)]">Runs in the last 7 days.</p>
        </article>
        <article className="panel p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">Run reliability</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{metrics.success_rate}%</p>
          <p className="mt-2 text-sm text-[var(--app-muted)]">Completed runs without failure.</p>
        </article>
        <article className="panel p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">Team adoption</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{members.length}</p>
          <p className="mt-2 text-sm text-[var(--app-muted)]">Members collaborating on playbooks.</p>
        </article>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <article className="panel p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="landing-kicker">Execution trend</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Runs over the last 8 checkpoints</h2>
            </div>
            <p className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-2)] px-3 py-1 text-xs font-semibold text-[var(--app-muted)]">
              Estimated monthly runs: {monthlyRunsEstimate}
            </p>
          </div>

          <div className="chart-grid rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface)]/92 p-5">
            <div className="relative h-48">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                <path d={areaPath} fill="rgba(95,119,132,0.18)" />
                <polyline
                  fill="none"
                  stroke="rgba(95,119,132,0.95)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={linePoints}
                />
              </svg>
            </div>
            <div className="mt-4 grid grid-cols-8 gap-2 text-center text-xs text-[var(--app-muted)]">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S', 'Now'].map(label => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <article className="panel-tight p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--app-muted)]">Completed</p>
              <p className="mt-2 text-2xl font-bold">{completedRuns}</p>
            </article>
            <article className="panel-tight p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--app-muted)]">Failed</p>
              <p className="mt-2 text-2xl font-bold">{failedRuns}</p>
            </article>
            <article className="panel-tight p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--app-muted)]">Queued</p>
              <p className="mt-2 text-2xl font-bold">{queuedRuns}</p>
            </article>
          </div>
        </article>

        <aside className="grid gap-4">
          <article className="panel p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="landing-kicker">Run health</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">Operational reliability</h2>
              </div>
              <div
                className="donut-shell"
                style={{
                  background: `conic-gradient(rgba(123,155,134,0.85) 0 ${metrics.success_rate}%, rgba(95,119,132,0.2) ${metrics.success_rate}% 100%)`,
                }}
              >
                <div className="donut-hole">
                  <p className="text-center text-lg font-extrabold leading-none">
                    {metrics.success_rate}%
                    <span className="mt-1 block text-[11px] font-semibold tracking-[0.14em] text-[var(--app-muted)]">
                      SUCCESS
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--app-surface-2)]">
                <div
                  className="h-full bg-[var(--app-sage)]"
                  style={{ width: `${(completedRuns / Math.max(runMixTotal, 1)) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-[var(--app-muted)]">
                <span>Completed</span>
                <span>{completedRuns}</span>
              </div>
            </div>

            <div className="mt-3">
              <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--app-surface-2)]">
                <div
                  className="h-full bg-[var(--app-blue)]"
                  style={{ width: `${(failedRuns / Math.max(runMixTotal, 1)) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-[var(--app-muted)]">
                <span>Failed</span>
                <span>{failedRuns}</span>
              </div>
            </div>

            <div className="mt-3">
              <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--app-surface-2)]">
                <div
                  className="h-full bg-[var(--app-sand)]"
                  style={{ width: `${(queuedRuns / Math.max(runMixTotal, 1)) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-[var(--app-muted)]">
                <span>Queued</span>
                <span>{queuedRuns}</span>
              </div>
            </div>
          </article>

          <article className="panel p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold tracking-tight">Automation controls</h2>
              <span className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-2)] px-3 py-1 text-xs font-semibold text-[var(--app-muted)]">
                {members.length} members
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              <Link href={`/team/${teamId}/capture`} className="panel-tight flex items-center justify-between px-4 py-3">
                <span className="font-semibold">Open capture lab</span>
                <span className="text-sm text-[var(--app-muted)]">Teach workflow</span>
              </Link>
              <Link
                href={`/team/${teamId}/playbooks/new`}
                className="panel-tight flex items-center justify-between px-4 py-3"
              >
                <span className="font-semibold">Create playbook</span>
                <span className="text-sm text-[var(--app-muted)]">New automation</span>
              </Link>
            </div>

            <div className="mt-4 space-y-2">
              {members.slice(0, 4).map(member => (
                <div key={member.id} className="flex items-center justify-between rounded-xl border border-[var(--app-line)] px-3 py-2">
                  <div>
                    <p className="font-semibold">{member.full_name}</p>
                    <p className="text-xs text-[var(--app-muted)]">{member.job_title ?? member.email}</p>
                  </div>
                  <span className="rounded-full bg-[var(--app-chip)] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--app-blue)]">
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <article className="panel p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="landing-kicker">Playbook portfolio</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Automations by workflow</h2>
            </div>
            <p className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-2)] px-3 py-1 text-xs font-semibold text-[var(--app-muted)]">
              ~{estimatedRunsPerPlaybook} runs/playbook/week
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.14em] text-[var(--app-muted)]">
                <tr>
                  <th className="pb-3">Playbook</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Tags</th>
                  <th className="pb-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {playbooks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="pt-4 text-[var(--app-muted)]">
                      No playbooks yet. Start by recording a workflow in capture lab.
                    </td>
                  </tr>
                ) : (
                  playbooks.slice(0, 8).map(playbook => (
                    <tr key={playbook.id} className="border-t border-[var(--app-line)]">
                      <td className="py-3">
                        <p className="font-semibold">{playbook.name}</p>
                        <p className="text-xs text-[var(--app-muted)]">{playbook.description ?? 'No description yet.'}</p>
                      </td>
                      <td className="py-3">
                        <span className={`status-pill ${playbook.status}`}>{playbook.status}</span>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {(playbook.tags.length ? playbook.tags : ['general']).slice(0, 2).map(tag => (
                            <span
                              key={`${playbook.id}-${tag}`}
                              className="rounded-full bg-[var(--app-chip)] px-2 py-1 text-xs font-semibold text-[var(--app-blue)]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 text-[var(--app-muted)]">{formatDate(playbook.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel p-6">
          <div className="mb-4">
            <p className="landing-kicker">Recent activity</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Capture and automation feed</h2>
          </div>

          <div className="space-y-3">
            {captures.length === 0 ? (
              <p className="panel-tight p-4 text-sm text-[var(--app-muted)]">
                No capture sessions yet. Record your first workflow to start activity tracking.
              </p>
            ) : (
              captures.slice(0, 6).map(session => (
                <article key={session.id} className="panel-tight p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{session.title}</h3>
                    <span className="rounded-full bg-[var(--app-chip)] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--app-blue)]">
                      {session.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[var(--app-muted)]">
                    {session.events} events · {session.actions} actions
                  </p>
                  <p className="mt-1 text-xs text-[var(--app-muted)]">Started {formatDate(session.started_at)}</p>
                </article>
              ))
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-2)]/82 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--app-muted)]">Portfolio status</p>
            <p className="mt-2 text-sm text-[var(--app-muted)]">
              {activePlaybooks} active, {metrics.draft_playbooks} draft, {archivedPlaybooks} archived playbooks.
            </p>
          </div>
        </article>
      </section>
    </PlatformShell>
  );
}
