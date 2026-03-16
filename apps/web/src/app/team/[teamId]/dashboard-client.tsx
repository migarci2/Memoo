'use client';

import {
  BookBookmark,
  PlayCircle,
  CheckCircle,
  Vault,
  ArrowRight,
  Plus,
  Play,
} from '@phosphor-icons/react';
import Link from 'next/link';

import { PlatformShell } from '@/components/platform-shell';
import type { Playbook, Run, TeamOverview } from '@/lib/types';

const STATUS_DOT: Record<string, string> = {
  completed: 'bg-emerald-500',
  running: 'bg-amber-500',
  pending: 'bg-gray-400',
  failed: 'bg-red-500',
};

interface DashboardClientProps {
  teamId: string;
  overview: TeamOverview;
  playbooks: Playbook[];
  runs: Run[];
}

export function DashboardClient({ teamId, overview, playbooks, runs }: DashboardClientProps) {
  const successRate =
    overview.total_runs > 0
      ? Math.round((overview.successful_runs / overview.total_runs) * 100)
      : 0;

  const kpis = [
    { icon: BookBookmark, label: 'Playbooks', value: overview.playbooks_count, sub: `${overview.active_playbooks} active` },
    { icon: PlayCircle, label: 'Runs', value: overview.total_runs, sub: 'Total executions' },
    { icon: CheckCircle, label: 'Success', value: `${successRate}%`, sub: `${overview.successful_runs} passed` },
    { icon: Vault, label: 'Vault', value: overview.vault_credentials, sub: 'Credentials' },
  ];

  return (
    <PlatformShell
      teamId={teamId}
      title="Dashboard"
      subtitle="Your playbooks, recent runs, and team overview."
    >
      {/* ── KPI Row ── */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(kpi => (
          <div
            key={kpi.label}
            className="flex items-center gap-3 rounded-xl border border-[var(--app-line-soft)] bg-white p-4"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgba(27,42,74,0.05)] text-[var(--app-muted)]">
              <kpi.icon size={18} weight="regular" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-extrabold tracking-tight leading-none">{kpi.value}</p>
              <p className="mt-0.5 text-xs text-[var(--app-muted)]">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        {/* ── Recent Runs ── */}
        <section className="rounded-xl border border-[var(--app-line-soft)] bg-white">
          <div className="flex items-center justify-between border-b border-[var(--app-line-soft)] px-4 py-3">
            <h2 className="text-base font-bold">Recent runs</h2>
            <Link
              href={`/team/${teamId}/runs`}
              className="flex items-center gap-1 text-xs font-semibold text-[var(--app-muted)] hover:text-[var(--app-text)]"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {runs.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-[var(--app-muted)]">No runs yet. Execute a playbook to see results here.</p>
              <Link
                href={`/team/${teamId}/runs/new`}
                className="btn-primary mt-4 inline-flex items-center gap-2 text-sm"
              >
                <Play size={14} weight="fill" /> Start a run
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[var(--app-line-soft)]">
              {runs.slice(0, 5).map(run => (
                <Link
                  key={run.id}
                  href={`/team/${teamId}/runs/${run.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[rgba(27,42,74,0.02)]"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[run.status] ?? STATUS_DOT.pending}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{run.input_source ?? `Run ${run.id.slice(0, 8)}`}</p>
                    <p className="text-xs text-[var(--app-muted)]">
                      {run.total_items} items · {run.success_count} passed
                      {run.failed_count > 0 ? ` · ${run.failed_count} failed` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-[rgba(27,42,74,0.04)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--app-muted)]">
                    {run.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Right Column ── */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/team/${teamId}/capture`}
              className="flex flex-col items-center gap-2 rounded-xl border border-[var(--app-line-soft)] bg-white px-4 py-5 text-center transition-colors hover:border-[var(--app-brand-teal)] hover:bg-[rgba(27,139,130,0.03)]"
            >
              <Plus size={20} weight="bold" className="text-[var(--app-brand-teal)]" />
              <span className="text-sm font-semibold">Teach workflow</span>
            </Link>
            <Link
              href={`/team/${teamId}/runs/new`}
              className="flex flex-col items-center gap-2 rounded-xl border border-[var(--app-line-soft)] bg-white px-4 py-5 text-center transition-colors hover:border-[var(--app-brand-sand)] hover:bg-[rgba(217,138,63,0.03)]"
            >
              <Play size={20} weight="fill" className="text-[var(--app-brand-sand)]" />
              <span className="text-sm font-semibold">Run batch</span>
            </Link>
          </div>

          {/* Playbooks list */}
          <section className="rounded-xl border border-[var(--app-line-soft)] bg-white">
            <div className="flex items-center justify-between border-b border-[var(--app-line-soft)] px-4 py-3">
              <h2 className="text-base font-bold">Playbooks</h2>
              <Link
                href={`/team/${teamId}/playbooks`}
                className="flex items-center gap-1 text-xs font-semibold text-[var(--app-muted)] hover:text-[var(--app-text)]"
              >
                View all <ArrowRight size={12} />
              </Link>
            </div>

            {playbooks.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-[var(--app-muted)]">No playbooks yet. Teach a workflow to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--app-line-soft)]">
                {playbooks.slice(0, 4).map(playbook => (
                  <Link
                    key={playbook.id}
                    href={`/team/${teamId}/playbooks/${playbook.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[rgba(27,42,74,0.02)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{playbook.name}</p>
                      {playbook.tags.length > 0 && (
                        <div className="mt-1 flex gap-1.5">
                          {playbook.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="rounded bg-[rgba(27,42,74,0.04)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--app-muted)]">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                      playbook.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : playbook.status === 'draft'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-amber-50 text-amber-700'
                    }`}>
                      {playbook.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </PlatformShell>
  );
}
