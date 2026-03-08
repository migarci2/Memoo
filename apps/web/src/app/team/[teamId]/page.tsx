import { notFound } from 'next/navigation';

import { PlatformShell } from '@/components/platform-shell';
import { apiGet } from '@/lib/api';
import type { Playbook, Run, TeamOverview } from '@/lib/types';

import { DashboardClient } from './dashboard-client';

type PageProps = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamDashboardPage({ params }: PageProps) {
  const { teamId } = await params;
  let overview: TeamOverview;
  let playbooks: Playbook[];
  let runs: Run[];

  try {
    [overview, playbooks, runs] = await Promise.all([
      apiGet<TeamOverview>(`/teams/${teamId}/dashboard`),
      apiGet<Playbook[]>(`/teams/${teamId}/playbooks`),
      apiGet<Run[]>(`/teams/${teamId}/runs`),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      return notFound();
    }

    return (
      <PlatformShell teamId={teamId}>
        <div className="py-20 text-center text-red-500">
          <h2 className="text-xl font-bold mb-2">Failed to load dashboard</h2>
          <p className="text-sm opacity-80">{error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </PlatformShell>
    );
  }

  return <DashboardClient teamId={teamId} overview={overview} playbooks={playbooks} runs={runs} />;
}
