'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Play, CircleNotch, CheckCircle, XCircle, Clock, ArrowRight } from '@phosphor-icons/react';

import { PlatformShell } from '@/components/platform-shell';
import { apiGet } from '@/lib/api';
import type { Run } from '@/lib/types';

const STATUS_MAP: Record<string, { icon: React.ReactNode; cls: string }> = {
  completed: {
    icon: <CheckCircle size={14} weight="fill" />,
    cls: 'bg-emerald-50 text-emerald-700',
  },
  running: {
    icon: <span className="animate-spin inline-flex"><CircleNotch size={14} /></span>,
    cls: 'bg-amber-50 text-amber-700',
  },
  failed: {
    icon: <XCircle size={14} weight="fill" />,
    cls: 'bg-red-50 text-red-700',
  },
  pending: {
    icon: <Clock size={14} />,
    cls: 'bg-gray-100 text-gray-600',
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
    <PlatformShell 
      teamId={teamId}
      title="Runs"
      subtitle="View all batch runs and their verification logs."
    >
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => router.push(`/team/${teamId}/runs/new`)}
          className="btn-primary inline-flex items-center gap-2 px-4 py-1.5 text-sm"
        >
          <Play size={14} weight="fill" />
          New run
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-[var(--app-muted)]">
          <div className="flex justify-center mb-2 animate-spin">
            <CircleNotch size={24} />
          </div>
          <p className="text-sm">Loading runs…</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--app-line-soft)] py-20 text-center text-[var(--app-muted)]">
          <div className="flex justify-center mb-3 opacity-20">
            <Play size={32} />
          </div>
          <p className="font-semibold text-[var(--app-text)]">No runs yet</p>
          <p className="mt-1 text-sm">Start a batch run from a compiled playbook.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--app-line-soft)] bg-white overflow-hidden divide-y divide-[var(--app-line-soft)]">
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
                className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-[rgba(27,42,74,0.01)]"
              >
                <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${s.cls}`}>
                  {s.icon}
                  {run.status}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">
                    {run.input_source || `Run #${run.id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-[var(--app-muted)]">
                    {run.total_items} items · {run.trigger_type}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">{successRate}%</p>
                  <p className="text-[10px] text-[var(--app-muted)] uppercase font-semibold">
                    {run.success_count}/{run.total_items} passed
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase">
                    {new Date(run.started_at).toLocaleDateString()}
                  </span>
                  <span className="text-[var(--app-line-strong)]"><ArrowRight size={14} /></span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </PlatformShell>
  );
}
