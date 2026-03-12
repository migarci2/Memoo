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
      subtitle="A drag-and-drop surface for structuring the playbook library."
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="landing-kicker">Playbook architecture</p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Folders and ownership</h1>
          <p className="mt-2 max-w-[70ch] text-[var(--app-muted)]">
            Create lanes for each workflow area, then drag playbooks between them to keep the library clean.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/team/${teamId}/playbooks`}
            className="btn-secondary rounded-full border border-[var(--app-line)] px-4 py-2 text-sm font-semibold"
          >
            Open library
          </Link>
          <Link href={`/team/${teamId}/playbooks/new`} className="btn-primary rounded-full px-4 py-2 text-sm">
            New playbook
          </Link>
        </div>
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
