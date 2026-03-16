import Link from 'next/link';

import { PlaybookOrganizer } from '@/components/playbook-organizer';
import { PlatformShell } from '@/components/platform-shell';
import { apiGet } from '@/lib/api';
import type { Playbook, PlaybookFolder } from '@/lib/types';

type Props = {
  params: Promise<{ teamId: string }>;
};

export default async function PlaybookFoldersPage({ params }: Props) {
  const { teamId } = await params;

  const [folders, playbooks] = await Promise.all([
    apiGet<PlaybookFolder[]>(`/teams/${teamId}/playbook-folders`),
    apiGet<Playbook[]>(`/teams/${teamId}/playbooks`),
  ]);

  return (
    <PlatformShell
      teamId={teamId}
      title="Folders"
      subtitle="Create and manage folders for your playbook library."
    >
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <Link
          href={`/team/${teamId}/playbooks`}
          className="btn-secondary rounded-lg border border-[var(--app-line)] px-3 py-1.5 text-sm font-semibold"
        >
          Back to library
        </Link>
        <Link href={`/team/${teamId}/playbooks/new`} className="btn-primary rounded-lg px-3 py-1.5 text-sm">
          + New playbook
        </Link>
      </div>

      <PlaybookOrganizer
        teamId={teamId}
        initialFolders={folders}
        initialPlaybooks={playbooks}
        mode="manage"
      />
    </PlatformShell>
  );
}
