'use client';

import { motion } from 'framer-motion';
import {
  BookBookmark,
  PlayCircle,
  CheckCircle,
  Vault,
  ArrowRight,
  Plus,
  Play,
  Clock
} from '@phosphor-icons/react';
import Link from 'next/link';

import { PlatformShell } from '@/components/platform-shell';
import type { Playbook, Run, TeamOverview } from '@/lib/types';

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-[rgba(80,139,130,0.15)] text-[#3b665f]',
  running: 'bg-[rgba(79,117,139,0.15)] text-[#405e6f]',
  pending: 'bg-[rgba(173,131,92,0.12)] text-[#7a5c41]',
  failed: 'bg-[rgba(175,91,91,0.12)] text-[#8a4848]',
};

const containerVariant = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariant = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } }
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

  return (
    <PlatformShell
      teamId={teamId}
      title="Dashboard"
      subtitle="Automation overview — your playbooks, recent runs, and vault."
    >
      <motion.div variants={containerVariant} initial="hidden" animate="show">
        {/* KPI Strip */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <motion.article
            variants={itemVariant}
            className="group relative overflow-hidden rounded-3xl border border-[var(--app-line)] bg-gradient-to-b from-[var(--app-surface)] to-[var(--app-surface)] p-6 transition-all hover:shadow-lg hover:-translate-y-1"
          >
            <div className="absolute -right-4 -top-4 rounded-full bg-[var(--app-chip)]/50 p-6 mix-blend-multiply opacity-50 transition-transform duration-500 group-hover:scale-110 text-[var(--app-blue)]">
              <BookBookmark size={60} weight="regular" />
            </div>
            <div className="relative z-10 flex items-center gap-3">
              <div className="rounded-xl bg-[var(--app-chip)] p-2 text-[var(--app-blue)]">
                <BookBookmark size={20} weight="bold" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Playbooks</p>
            </div>
            <div className="relative z-10 mt-4">
              <p className="text-4xl font-extrabold tracking-tight text-[var(--app-text)]">{overview.playbooks_count}</p>
              <p className="mt-1 text-sm font-medium text-[var(--app-muted)]">{overview.active_playbooks} active</p>
            </div>
          </motion.article>

          <motion.article
            variants={itemVariant}
            className="group relative overflow-hidden rounded-3xl border border-[var(--app-line)] bg-gradient-to-b from-[var(--app-surface)] to-[var(--app-surface)] p-6 transition-all hover:shadow-lg hover:-translate-y-1"
          >
            <div className="absolute -right-4 -top-4 rounded-full bg-[var(--app-chip)]/50 p-6 mix-blend-multiply opacity-50 transition-transform duration-500 group-hover:scale-110 text-[var(--app-blue)]">
              <PlayCircle size={60} weight="regular" />
            </div>
            <div className="relative z-10 flex items-center gap-3">
              <div className="rounded-xl bg-[var(--app-chip)] p-2 text-[var(--app-blue)]">
                <PlayCircle size={20} weight="bold" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Total Runs</p>
            </div>
            <div className="relative z-10 mt-4">
              <p className="text-4xl font-extrabold tracking-tight text-[var(--app-text)]">{overview.total_runs}</p>
              <p className="mt-1 text-sm font-medium text-[var(--app-muted)]">Batch executions</p>
            </div>
          </motion.article>

          <motion.article
            variants={itemVariant}
            className="group relative overflow-hidden rounded-3xl border border-[var(--app-line)] bg-gradient-to-b from-[var(--app-surface)] to-[var(--app-surface)] p-6 transition-all hover:shadow-lg hover:-translate-y-1"
          >
            <div className="absolute -right-4 -top-4 rounded-full bg-[var(--app-chip)]/50 p-6 mix-blend-multiply opacity-50 transition-transform duration-500 group-hover:scale-110 text-[var(--app-blue)]">
              <CheckCircle size={60} weight="regular" />
            </div>
            <div className="relative z-10 flex items-center gap-3">
              <div className="rounded-xl bg-[var(--app-chip)] p-2 text-[var(--app-blue)]">
                <CheckCircle size={20} weight="bold" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Success Rate</p>
            </div>
            <div className="relative z-10 mt-4">
              <p className="text-4xl font-extrabold tracking-tight text-[var(--app-text)]">{successRate}%</p>
              <p className="mt-1 text-sm font-medium text-[var(--app-muted)]">{overview.successful_runs} successful</p>
            </div>
          </motion.article>

          <motion.article
            variants={itemVariant}
            className="group relative overflow-hidden rounded-3xl border border-[var(--app-line)] bg-gradient-to-b from-[var(--app-surface)] to-[var(--app-surface)] p-6 transition-all hover:shadow-lg hover:-translate-y-1"
          >
            <div className="absolute -right-4 -top-4 rounded-full bg-[var(--app-chip)]/50 p-6 mix-blend-multiply opacity-50 transition-transform duration-500 group-hover:scale-110 text-[var(--app-blue)]">
              <Vault size={60} weight="regular" />
            </div>
            <div className="relative z-10 flex items-center gap-3">
              <div className="rounded-xl bg-[var(--app-chip)] p-2 text-[var(--app-blue)]">
                <Vault size={20} weight="bold" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">Vault</p>
            </div>
            <div className="relative z-10 mt-4">
              <p className="text-4xl font-extrabold tracking-tight text-[var(--app-text)]">{overview.vault_credentials}</p>
              <p className="mt-1 text-sm font-medium text-[var(--app-muted)]">Secure credentials</p>
            </div>
          </motion.article>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          {/* Recent Runs */}
          <motion.article variants={itemVariant} className="panel rounded-3xl p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[var(--app-chip)] p-2.5 text-[var(--app-blue)]">
                  <Clock size={22} weight="bold" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Recent runs</h2>
                </div>
              </div>
              <Link
                href={`/team/${teamId}/runs`}
                className="group flex items-center gap-1.5 rounded-full border border-[var(--app-line)] bg-white px-4 py-1.5 text-xs font-bold text-[var(--app-blue)] transition-all hover:bg-[var(--app-blue)] hover:text-white"
              >
                View all
                <span className="transition-transform group-hover:translate-x-0.5">
                  <ArrowRight size={12} weight="bold" />
                </span>
              </Link>
            </div>

            {runs.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-[var(--app-line)] px-6 py-12 text-center transition-colors hover:border-[var(--app-blue)]/30 hover:bg-[var(--app-blue)]/5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--app-blue)]/10 text-[var(--app-blue)] transition-transform group-hover:scale-110 group-hover:bg-[var(--app-blue)] group-hover:text-white">
                  <PlayCircle size={24} weight="regular" />
                </div>
                <p className="mt-4 text-lg font-bold">No runs yet</p>
                <p className="mt-1 text-sm font-medium text-[var(--app-muted)]">
                  Execute a playbook with batch data to see results here.
                </p>
                <Link
                  href={`/team/${teamId}/runs/new`}
                  className="btn-primary mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-transform active:scale-95"
                >
                  <Play size={16} weight="fill" />
                  Start a run
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {runs.slice(0, 5).map((run) => (
                  <Link
                    key={run.id}
                    href={`/team/${teamId}/runs/${run.id}`}
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-[var(--app-line)] bg-white/50 px-5 py-4 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-[var(--app-text)] transition-colors group-hover:text-[var(--app-blue)]">
                        {run.input_source ?? `Run ${run.id.slice(0, 8)}`}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs font-semibold text-[var(--app-muted)]">
                          {run.total_items} items
                        </span>
                        <span className="h-1 w-1 rounded-full bg-[var(--app-line-strong)]"></span>
                        <span className="text-xs font-semibold text-[#3b665f]">
                          {run.success_count} passed
                        </span>
                        {run.failed_count > 0 && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-[var(--app-line-strong)]"></span>
                            <span className="text-xs font-semibold text-red-600">
                              {run.failed_count} failed
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold capitalize shadow-sm ${STATUS_COLORS[run.status] ?? STATUS_COLORS.pending
                          }`}
                      >
                        {run.status}
                      </span>
                      <span className="text-[var(--app-line-strong)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--app-blue)]">
                        <ArrowRight size={16} weight="bold" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </motion.article>

          {/* Quick Actions + Recent Playbooks */}
          <div className="space-y-6">
            {/* Quick actions */}
            <motion.article variants={itemVariant} className="panel rounded-3xl p-6 shadow-sm">
              <h2 className="text-xl font-bold tracking-tight">Quick actions</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link
                  href={`/team/${teamId}/capture`}
                  className="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-[rgba(30,96,128,0.18)] bg-[rgba(30,96,128,0.07)] px-4 py-5 font-bold text-[#1e6080] transition-all hover:-translate-y-1 hover:border-[rgba(30,96,128,0.32)] hover:bg-[rgba(30,96,128,0.12)] hover:shadow-md active:scale-95"
                >
                  <span className="transition-transform group-hover:rotate-90 group-hover:scale-110">
                    <Plus size={24} weight="bold" />
                  </span>
                  <span className="text-sm tracking-wide">Teach workflow</span>
                </Link>
                <Link
                  href={`/team/${teamId}/runs/new`}
                  className="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-[var(--app-line)] bg-white px-4 py-5 font-bold text-[#1e6080] transition-all hover:-translate-y-1 hover:border-[rgba(30,96,128,0.4)] hover:shadow-md active:scale-95"
                >
                  <span className="text-[var(--app-sage)] transition-transform group-hover:scale-110">
                    <Play size={24} weight="fill" />
                  </span>
                  <span className="text-sm tracking-wide">Run batch</span>
                </Link>
              </div>
            </motion.article>

            {/* Recent playbooks */}
            <motion.article variants={itemVariant} className="panel rounded-3xl p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold tracking-tight">Playbooks</h2>
                <Link
                  href={`/team/${teamId}/playbooks`}
                  className="group flex items-center gap-1.5 rounded-full border border-[var(--app-line)] bg-white px-3 py-1 text-xs font-bold text-[var(--app-blue)] transition-all hover:bg-[var(--app-blue)] hover:text-white"
                >
                  View all
                </Link>
              </div>

              {playbooks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--app-line)] bg-white/40 p-4 text-center">
                  <p className="text-sm font-medium text-[var(--app-muted)]">No playbooks yet. Teach a workflow to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {playbooks.slice(0, 4).map(playbook => (
                    <Link
                      key={playbook.id}
                      href={`/team/${teamId}/playbooks/${playbook.id}`}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-[var(--app-line)] bg-white/50 px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--app-text)] transition-colors group-hover:text-[var(--app-blue)]">{playbook.name}</p>
                        <div className="mt-1.5 flex gap-2">
                          {playbook.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="rounded-md bg-[var(--app-chip)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]">{tag}</span>
                          ))}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--app-chip)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)] shadow-sm">
                        {playbook.status}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </motion.article>
          </div>
        </section>
      </motion.div>
    </PlatformShell>
  );
}
