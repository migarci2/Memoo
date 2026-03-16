import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PlatformShell } from '@/components/platform-shell';
import { apiGet } from '@/lib/api';
import { getFolderColorToken } from '@/lib/playbook-folders';
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
  const folder = playbook.folder_id ? folders.find(f => f.id === playbook.folder_id) ?? null : null;
  const folderName = folder?.name ?? null;
  const folderToken = getFolderColorToken(folder?.color);

  const stats = [
    { label: 'Version', value: latest_version ? `v${latest_version.version_number}` : '—' },
    { label: 'Steps', value: latest_version ? String(latest_version.steps.length) : '—' },
    { label: 'Created', value: formatDate(playbook.created_at) },
    { label: 'Status', value: playbook.status },
  ];

  return (
    <PlatformShell teamId={teamId}>
      {/* Header & Stats Container */}
      <div className="space-y-6">
        {/* Breadcrumb & Title Area */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <nav className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--app-muted)]/50">
              <Link href={`/team/${teamId}/playbooks`} className="hover:text-[var(--app-brand-sand)] transition-colors">
                Playbooks
              </Link>
              <span className="opacity-40">/</span>
              <span className="text-[var(--app-muted)]">{playbook.name}</span>
            </nav>
            
            <h1 className="text-3xl font-bold tracking-tight text-[var(--app-text)]">{playbook.name}</h1>
            
            {playbook.description && (
              <p className="mt-2 max-w-[70ch] text-sm text-[var(--app-muted)] leading-relaxed">
                {playbook.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {folderName && (
                <span
                  className="rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{
                    borderColor: folderToken.border,
                    backgroundColor: folderToken.soft,
                    color: folderToken.text,
                  }}
                >
                  {folderName}
                </span>
              )}
              {playbook.tags.map(tag => (
                <span
                  key={tag}
                  className="rounded-md bg-[rgba(27,42,74,0.05)] border border-[rgba(27,42,74,0.05)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--app-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <PlaybookActions playbook={playbook} teamId={teamId} />
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-xl border border-[var(--app-line-soft)] bg-[var(--app-line-soft)] shadow-sm">
          {stats.map(s => (
            <div key={s.label} className="bg-[var(--app-surface)] p-4 flex flex-col justify-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]">{s.label}</p>
              <p className="mt-1 font-bold text-[var(--app-text)] capitalize truncate">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Step Flow Editor */}
      <div className="mt-10">
        <StepFlowEditor
          playbookId={playbookId}
          teamId={teamId}
          initialSteps={latest_version?.steps ?? []}
          versionNumber={latest_version?.version_number ?? 0}
        />
      </div>
    </PlatformShell>
  );
}
