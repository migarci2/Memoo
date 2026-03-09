import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PlatformShell } from '@/components/platform-shell';
import { apiGet } from '@/lib/api';
import type { PlaybookDetail, PlaybookFolder } from '@/lib/types';
import { formatDate } from '@/lib/utils';

import { PlaybookActions } from './playbook-actions';
import { StepFlowEditor } from './step-flow-editor';

type Props = {
  params: Promise<{ teamId: string; playbookId: string }>;
};

export default async function PlaybookDetailPage({ params }: Props) {
  const { teamId, playbookId } = await params;

  let detail: PlaybookDetail;
  try {
    detail = await apiGet<PlaybookDetail>(`/playbooks/${playbookId}`);
  } catch {
    notFound();
  }

  const { playbook, latest_version } = detail;
  const folders = await apiGet<PlaybookFolder[]>(`/teams/${teamId}/playbook-folders`).catch(() => []);
  const folderName = playbook.folder_id
    ? folders.find(f => f.id === playbook.folder_id)?.name ?? 'Folder'
    : null;

  return (
    <PlatformShell teamId={teamId}>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-[var(--app-muted)]">
        <Link href={`/team/${teamId}`} className="hover:text-[var(--app-text)]">
          Dashboard
        </Link>
        <span>/</span>
        <Link href={`/team/${teamId}/playbooks`} className="hover:text-[var(--app-text)]">
          Playbooks
        </Link>
        <span>/</span>
        <span className="text-[var(--app-text)] font-medium">{playbook.name}</span>
      </nav>

      {/* Header */}
      <div className="panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{playbook.name}</h1>
            {playbook.description ? (
              <p className="mt-2 max-w-[70ch] text-[var(--app-muted)]">{playbook.description}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {folderName ? (
                <span className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-2)] px-2.5 py-0.5 text-xs font-semibold text-[var(--app-muted)]">
                  {folderName}
                </span>
              ) : null}
              {playbook.tags.map(tag => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--app-chip)] px-2.5 py-0.5 text-xs font-semibold text-[var(--app-blue)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Actions (client island for edit/status toggle) */}
          <PlaybookActions playbook={playbook} teamId={teamId} />
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--app-line)] pt-5 sm:grid-cols-4">
          {[
            { label: 'Created', value: formatDate(playbook.created_at) },
            {
              label: 'Steps',
              value: latest_version ? String(latest_version.steps.length) : '—',
            },
            {
              label: 'Version',
              value: latest_version ? `v${latest_version.version_number}` : '—',
            },
            { label: 'Status', value: playbook.status },
          ].map(meta => (
            <div key={meta.label}>
              <dt className="text-xs uppercase tracking-[0.14em] text-[var(--app-muted)]">{meta.label}</dt>
              <dd className="mt-1 font-semibold capitalize">{meta.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Step Flow Editor */}
      <StepFlowEditor
        playbookId={playbookId}
        teamId={teamId}
        initialSteps={latest_version?.steps ?? []}
        versionNumber={latest_version?.version_number ?? 0}
      />
    </PlatformShell>
  );
}
