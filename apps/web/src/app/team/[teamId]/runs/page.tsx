'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Play, CircleNotch, CheckCircle, XCircle, Clock } from '@phosphor-icons/react';

import { PlatformShell } from '@/components/platform-shell';
import { apiGet } from '@/lib/api';
import type { Run } from '@/lib/types';

const STATUS_MAP: Record<string, { icon: React.ReactNode; cls: string }> = {
  completed: {
    icon: <CheckCircle size={16} weight="fill" />,
    cls: 'bg-[rgba(123,155,134,0.18)] text-[#335443]',
  },
  running: {
    icon: <span className="animate-spin inline-flex"><CircleNotch size={16} /></span>,
    cls: 'bg-[rgba(95,119,132,0.18)] text-[#3f5e6f]',
  },
  failed: {
    icon: <XCircle size={16} weight="fill" />,
    cls: 'bg-[rgba(191,100,100,0.18)] text-[#8b3a3a]',
  },
  pending: {
    icon: <Clock size={16} />,
    cls: 'bg-[var(--app-chip)] text-[var(--app-muted)]',
  },
};

export default function RunsListPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Run[]>(`/teams/${teamId}/runs`)
      .then(setRuns)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teamId]);

  return (
    <PlatformShell teamId={teamId}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="landing-kicker">Automation</p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Runs</h1>
          <p className="mt-1 text-[var(--app-muted)]">
            View all batch runs and their verification logs.
          </p>
        </div>
        <button
          onClick={() => router.push(`/team/${teamId}/runs/new`)}
          className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          <Play size={15} weight="fill" />
          New run
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-[var(--app-muted)]">
          <span className="animate-spin inline-flex mb-2"><CircleNotch size={24} /></span>
          <p className="text-sm">Loading runs…</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="py-20 text-center text-[var(--app-muted)]">
          <Play size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No runs yet</p>
          <p className="mt-1 text-sm">Start a batch run from a compiled playbook.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map(run => {
            const s = STATUS_MAP[run.status] ?? STATUS_MAP.pending;
            const successRate =
              run.total_items > 0
                ? Math.round((run.success_count / run.total_items) * 100)
                : 0;

            return (
              <button
                key={run.id}
                onClick={() => router.push(`/team/${teamId}/runs/${run.id}`)}
                className="panel-tight flex w-full items-center gap-4 p-4 text-left transition-shadow hover:shadow-md"
              >
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${s.cls}`}>
                  {s.icon}
                  {run.status}
                </span>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">
                    Run #{run.id.slice(0, 8)} — {run.input_source || 'manual'}
                  </h3>
                  <p className="text-xs text-[var(--app-muted)] mt-0.5">
                    {run.total_items} items · {run.trigger_type}
                  </p>
                </div>

                {run.status === 'completed' && (
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm">{successRate}%</p>
                    <p className="text-xs text-[var(--app-muted)]">
                      {run.success_count}/{run.total_items} passed
                    </p>
                  </div>
                )}

                <span className="text-xs text-[var(--app-muted)] shrink-0">
                  {new Date(run.created_at).toLocaleDateString()}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </PlatformShell>
  );
}
