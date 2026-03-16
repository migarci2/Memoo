import Link from 'next/link';

import { PlaybookOrganizer } from '@/components/playbook-organizer';
import { PlatformShell } from '@/components/platform-shell';
import { apiGet } from '@/lib/api';
import type { Playbook, PlaybookFolder } from '@/lib/types';

type Props = {
  params: Promise<{ teamId: string }>;
};

export default async function PlaybooksPage({ params }: Props) {
  const { teamId } = await params;

  const [playbooks, folders] = await Promise.all([
    apiGet<Playbook[]>(`/teams/${teamId}/playbooks`),
    apiGet<PlaybookFolder[]>(`/teams/${teamId}/playbook-folders`),
  ]);

  return (
    <PlatformShell
      teamId={teamId}
      title="Playbooks"
      subtitle="Browse, search, and organize your workflow library."
    >
      <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
        <Link
          href={`/team/${teamId}/capture`}
          className="btn-secondary rounded-lg border border-[var(--app-line)] px-3 py-1.5 text-sm font-semibold"
        >
          Teach new
        </Link>
        <Link href={`/team/${teamId}/playbooks/new`} className="btn-primary rounded-lg px-3 py-1.5 text-sm">
          + Create
        </Link>
      </div>

      <PlaybookOrganizer
        teamId={teamId}
        initialFolders={folders}
        initialPlaybooks={playbooks}
        mode="library"
      />
    </PlatformShell>
  );
}
