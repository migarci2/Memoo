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

  const active = playbooks.filter(playbook => playbook.status === 'active').length;
  const inbox = playbooks.filter(playbook => !playbook.folder_id).length;

  return (
    <PlatformShell
      teamId={teamId}
      title="Playbooks"
      subtitle="Organize the automation library visually and move work between folders in one surface."
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Playbooks', value: playbooks.length, desc: 'Workflows in this workspace' },
          { label: 'Folders', value: folders.length, desc: 'Custom lanes for organization' },
          { label: 'Ready', value: active, desc: 'Playbooks ready to run' },
          { label: 'Inbox', value: inbox, desc: 'Playbooks still uncategorized' },
        ].map(kpi => (
          <article key={kpi.label} className="panel p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">{kpi.label}</p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight">{kpi.value}</p>
            <p className="mt-1 text-sm text-[var(--app-muted)]">{kpi.desc}</p>
          </article>
        ))}
      </section>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="landing-kicker">Playbook library</p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Drag, sort, and open workflows</h1>
          <p className="mt-2 max-w-[72ch] text-[var(--app-muted)]">
            The board below turns folders into active lanes, so you can reorganize the library without bouncing between edit forms.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/team/${teamId}/playbooks/folders`}
            className="btn-secondary rounded-full border border-[var(--app-line)] px-4 py-2 text-sm font-semibold"
          >
            Folder studio
          </Link>
          <Link
            href={`/team/${teamId}/capture`}
            className="btn-secondary rounded-full border border-[var(--app-line)] px-4 py-2 text-sm font-semibold"
          >
            Teach new
          </Link>
          <Link href={`/team/${teamId}/playbooks/new`} className="btn-primary rounded-full px-4 py-2 text-sm">
            + Manual
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <PlaybookOrganizer
          teamId={teamId}
          initialFolders={folders}
          initialPlaybooks={playbooks}
          mode="library"
        />
      </div>
    </PlatformShell>
  );
}
