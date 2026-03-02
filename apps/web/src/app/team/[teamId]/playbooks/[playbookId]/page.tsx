import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PlatformShell } from '@/components/platform-shell';
import { apiGet } from '@/lib/api';
import type { PlaybookDetail } from '@/lib/types';
import { formatDate } from '@/lib/utils';

import { PlaybookActions } from './playbook-actions';

type Props = {
  params: Promise<{ teamId: string; playbookId: string }>;
};

const STEP_TYPE_COLORS: Record<string, string> = {
  navigate: 'bg-[var(--app-chip)] text-[var(--app-blue)]',
  click: 'bg-[rgba(123,155,134,0.18)] text-[#335443]',
  input: 'bg-[rgba(191,155,106,0.16)] text-[#7d5d31]',
  submit: 'bg-[rgba(95,119,132,0.18)] text-[#3f5e6f]',
  action: 'bg-[var(--app-chip)] text-[var(--app-muted)]',
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

      {/* Steps */}
      {latest_version ? (
        <section className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="landing-kicker">Steps</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">
                v{latest_version.version_number}{latest_version.change_note ? ` — ${latest_version.change_note}` : ''}
              </h2>
            </div>

          </div>

          {latest_version.steps.length === 0 ? (
            <div className="panel-tight px-5 py-10 text-center">
              <p className="text-[var(--app-muted)]">No steps in this version.</p>
            </div>
          ) : (
            <div className="panel overflow-hidden p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--app-line)] bg-[var(--app-surface-2)]/60">
                  <tr>
                    <th className="w-10 px-4 py-3 text-xs uppercase tracking-[0.14em] text-[var(--app-muted)]">#</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-[0.14em] text-[var(--app-muted)]">Step</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-[0.14em] text-[var(--app-muted)]">Type</th>
                    <th className="hidden px-4 py-3 text-xs uppercase tracking-[0.14em] text-[var(--app-muted)] md:table-cell">
                      Target URL
                    </th>
                    <th className="hidden px-4 py-3 text-xs uppercase tracking-[0.14em] text-[var(--app-muted)] lg:table-cell">
                      Selector
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {latest_version.steps.map((step, idx) => (
                    <tr
                      key={step.id ?? idx}
                      className="border-t border-[var(--app-line)] transition-colors first:border-t-0 hover:bg-[var(--app-chip)]/40"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[var(--app-muted)]">
                        {String(step.sequence ?? idx + 1).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-3 font-semibold">{step.title}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${
                            STEP_TYPE_COLORS[step.step_type] ?? STEP_TYPE_COLORS.action
                          }`}
                        >
                          {step.step_type}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {step.target_url ? (
                          <span className="truncate font-mono text-xs text-[var(--app-muted)]" title={step.target_url}>
                            {step.target_url.length > 40 ? `${step.target_url.slice(0, 40)}…` : step.target_url}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--app-muted)]/40">—</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        {step.selector ? (
                          <code className="truncate rounded bg-[var(--app-surface-2)] px-1.5 py-0.5 font-mono text-xs text-[var(--app-text)]">
                            {step.selector.length > 30 ? `${step.selector.slice(0, 30)}…` : step.selector}
                          </code>
                        ) : (
                          <span className="text-xs text-[var(--app-muted)]/40">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <div className="panel mt-6 px-6 py-10 text-center">
          <p className="text-[var(--app-muted)]">No versions found for this playbook.</p>
          <p className="mt-2 text-sm text-[var(--app-muted)]">Edit the playbook to add steps.</p>
        </div>
      )}
    </PlatformShell>
  );
}
