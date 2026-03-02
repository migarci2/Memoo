import Link from 'next/link';

import { PlatformShell } from '@/components/platform-shell';
import { apiGet } from '@/lib/api';
import type { Playbook } from '@/lib/types';
import { formatDate } from '@/lib/utils';

type Props = {
  params: Promise<{ teamId: string }>;
};

const STATUS_COLORS = {
  active: 'bg-[rgba(123,155,134,0.18)] border-[rgba(123,155,134,0.4)] text-[#335443]',
  draft: 'bg-[rgba(95,119,132,0.14)] border-[rgba(95,119,132,0.32)] text-[#3f5e6f]',
  archived: 'bg-[rgba(191,155,106,0.18)] border-[rgba(191,155,106,0.42)] text-[#7d5d31]',
};

export default async function PlaybooksPage({ params }: Props) {
  const { teamId } = await params;
  const playbooks = await apiGet<Playbook[]>(`/teams/${teamId}/playbooks`);

  const active = playbooks.filter(p => p.status === 'active');
  const draft = playbooks.filter(p => p.status === 'draft');
  const archived = playbooks.filter(p => p.status === 'archived');

  return (
    <PlatformShell
      teamId={teamId}
      title="Playbooks"
      subtitle="All reusable automation workflows for this workspace."
    >
      {/* KPI Strip */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total', value: playbooks.length, desc: 'Playbooks in this workspace' },
          { label: 'Active', value: active.length, desc: 'Running in production' },
          { label: 'Draft', value: draft.length, desc: 'Under development' },
          { label: 'Archived', value: archived.length, desc: 'No longer in use' },
        ].map(kpi => (
          <article key={kpi.label} className="panel p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">{kpi.label}</p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight">{kpi.value}</p>
            <p className="mt-1 text-sm text-[var(--app-muted)]">{kpi.desc}</p>
          </article>
        ))}
      </section>

      {/* Header actions */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="landing-kicker">All playbooks</p>
        <Link
          href={`/team/${teamId}/playbooks/new`}
          className="btn-primary rounded-full px-4 py-2 text-sm"
        >
          + New playbook
        </Link>
      </div>

      {/* Playbook grid */}
      {playbooks.length === 0 ? (
        <div className="panel mt-4 flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="grid grid-cols-2 gap-1">
            <span className="h-4 w-4 rounded-full bg-[var(--app-blue)]/40" />
            <span className="h-4 w-4 rounded-full bg-[var(--app-sage)]/40" />
            <span className="col-span-2 h-4 rounded-full bg-[var(--app-sand)]/40" />
          </div>
          <p className="text-xl font-bold tracking-tight">No playbooks yet</p>
          <p className="max-w-[40ch] text-[var(--app-muted)]">
            Start by recording a workflow in the Capture Lab, or create a playbook manually.
          </p>
          <div className="flex gap-3">
            <Link href={`/team/${teamId}/capture`} className="btn-secondary rounded-full px-4 py-2 text-sm">
              Open capture lab
            </Link>
            <Link href={`/team/${teamId}/playbooks/new`} className="btn-primary rounded-full px-4 py-2 text-sm">
              Create manually
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {playbooks.map(playbook => (
            <Link
              key={playbook.id}
              href={`/team/${teamId}/playbooks/${playbook.id}`}
              className="panel-tight group block p-5 transition-shadow hover:shadow-[0_4px_20px_rgba(95,119,132,0.14)]"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold leading-tight tracking-tight group-hover:text-[var(--app-blue)] transition-colors">
                  {playbook.name}
                </h3>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold capitalize ${
                    STATUS_COLORS[playbook.status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.draft
                  }`}
                >
                  {playbook.status}
                </span>
              </div>

              {playbook.description ? (
                <p className="mt-2 line-clamp-2 text-sm text-[var(--app-muted)]">{playbook.description}</p>
              ) : (
                <p className="mt-2 text-sm italic text-[var(--app-muted)]/60">No description</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {playbook.tags.slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    className="rounded-full bg-[var(--app-chip)] px-2 py-0.5 text-xs font-semibold text-[var(--app-blue)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <p className="mt-3 border-t border-[var(--app-line)] pt-3 text-xs text-[var(--app-muted)]">
                Updated {formatDate(playbook.created_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </PlatformShell>
  );
}
