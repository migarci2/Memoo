'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CircleNotch,
  File,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Play,
  UploadSimple,
  X,
} from '@phosphor-icons/react';

import { PlatformShell } from '@/components/platform-shell';
import { useToast } from '@/components/toast-provider';
import { apiGet, apiPost } from '@/lib/api';
import type { Playbook, Run, VaultCredential } from '@/lib/types';

type AttachmentKind = 'text' | 'image' | 'binary';
type AttachmentSource = 'files' | 'folder';

type PendingAttachment = {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  kind: AttachmentKind;
  source: AttachmentSource;
  textPreview?: string;
};

const TEXT_FILE_EXTENSIONS = new Set([
  'txt',
  'md',
  'csv',
  'json',
  'log',
  'yaml',
  'yml',
  'xml',
  'html',
  'htm',
  'py',
  'ts',
  'tsx',
  'js',
  'jsx',
  'css',
  'sql',
]);

const MAX_TEXT_PREVIEW_CHARS = 8000;
const MAX_ATTACHMENTS = 24;
const MAX_CONTEXT_TEXT_CHARS = 24000;

function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw.trim().split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(header => header.trim());

  return lines.slice(1).map(line => {
    const values = line.split(',').map(value => value.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(name: string): string {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function classifyFile(file: File): AttachmentKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('text/')) return 'text';
  return TEXT_FILE_EXTENSIONS.has(fileExtension(file.name)) ? 'text' : 'binary';
}

async function filesToAttachments(
  files: File[],
  source: AttachmentSource,
): Promise<PendingAttachment[]> {
  const limited = files.slice(0, MAX_ATTACHMENTS);

  return await Promise.all(limited.map(async file => {
    const path = file.webkitRelativePath || file.name;
    const kind = classifyFile(file);
    let textPreview: string | undefined;

    if (kind === 'text') {
      try {
        textPreview = (await file.text()).slice(0, MAX_TEXT_PREVIEW_CHARS);
      } catch {
        textPreview = undefined;
      }
    }

    return {
      id: `${path}-${file.size}-${file.lastModified}`,
      name: file.name,
      path,
      size: file.size,
      type: file.type || 'application/octet-stream',
      kind,
      source,
      textPreview,
    };
  }));
}

function attachmentIcon(kind: AttachmentKind) {
  if (kind === 'text') return <FileText size={16} weight="duotone" />;
  if (kind === 'image') return <ImageIcon size={16} weight="duotone" />;
  return <File size={16} weight="duotone" />;
}

export default function NewRunPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [vaultCredentials, setVaultCredentials] = useState<VaultCredential[]>([]);
  const [selectedVaultIds, setSelectedVaultIds] = useState<string[]>([]);
  const [playbookId, setPlaybookId] = useState('');
  const [agentBrief, setAgentBrief] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [csvText, setCsvText] = useState('');
  const [showBatchTools, setShowBatchTools] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    apiGet<Playbook[]>(`/teams/${teamId}/playbooks`)
      .then(list => {
        const visible = list.filter(playbook => !playbook.tags.includes('system_agent'));
        const ready = visible.filter(playbook => playbook.status === 'active');
        const nextPlaybooks = ready.length > 0 ? ready : visible;
        setPlaybooks(nextPlaybooks);
        setPlaybookId(current => current || nextPlaybooks[0]?.id || '');
      })
      .catch(() => {});

    apiGet<VaultCredential[]>(`/teams/${teamId}/vault`)
      .then(setVaultCredentials)
      .catch(() => {});
  }, [teamId]);

  const parsedCsvRows = useMemo(() => parseCsv(csvText), [csvText]);

  const attachmentSummary = useMemo(() => {
    const lines = attachments.map(attachment => {
      const parts = [
        attachment.path,
        attachment.kind,
        formatBytes(attachment.size),
        attachment.source === 'folder' ? 'from folder' : 'file',
      ];
      return `- ${parts.join(' | ')}`;
    });
    return lines.join('\n');
  }, [attachments]);

  const attachmentContextText = useMemo(() => {
    const chunks: string[] = [];
    for (const attachment of attachments) {
      if (!attachment.textPreview?.trim()) continue;
      chunks.push(`[${attachment.path}]\n${attachment.textPreview.trim()}`);
    }
    return chunks.join('\n\n').slice(0, MAX_CONTEXT_TEXT_CHARS);
  }, [attachments]);

  const processSelectedFiles = async (
    event: ChangeEvent<HTMLInputElement>,
    source: AttachmentSource,
  ) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    try {
      const processed = await filesToAttachments(files, source);
      setAttachments(previous => {
        const merged = new Map(previous.map(item => [item.id, item]));
        processed.forEach(item => merged.set(item.id, item));
        const next = Array.from(merged.values()).slice(0, MAX_ATTACHMENTS);
        if (next.length < previous.length + processed.length) {
          toast(`Only the first ${MAX_ATTACHMENTS} attachments are kept`, 'error');
        }
        return next;
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to read attachments', 'error');
    } finally {
      event.target.value = '';
    }
  };

  const buildSingleInputRow = (): Record<string, unknown> => ({
    agent_brief: agentBrief.trim(),
    agent_attachments_manifest: attachmentSummary,
    agent_context_text: attachmentContextText,
    agent_attachment_count: attachments.length,
    agent_text_attachment_count: attachments.filter(item => item.kind === 'text').length,
    agent_image_attachment_count: attachments.filter(item => item.kind === 'image').length,
    agent_attachments: attachments.map(item => ({
      name: item.name,
      path: item.path,
      kind: item.kind,
      size: item.size,
      type: item.type,
      source: item.source,
    })),
  });

  const startRun = async () => {
    if (!playbookId) {
      toast('Select a playbook', 'error');
      return;
    }

    const inputRows = showBatchTools && parsedCsvRows.length > 0
      ? parsedCsvRows
      : [buildSingleInputRow()];

    setSubmitting(true);
    try {
      const run = await apiPost<Run>(`/teams/${teamId}/runs`, {
        playbook_id: playbookId,
        input_rows: inputRows,
        input_source:
          showBatchTools && parsedCsvRows.length > 0
            ? 'csv_paste'
            : 'playbook_preview',
        selected_vault_credential_ids: selectedVaultIds,
        use_sandbox: true,
      });

      toast('Run started', 'success');
      router.push(`/team/${teamId}/runs/${run.id}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to start run', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PlatformShell 
      teamId={teamId}
      title="Run a playbook"
      subtitle="Pick a playbook, add context, and watch the execution in the live sandbox."
    >

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        <section className="panel overflow-hidden">
          <div className="border-b border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.02)] px-6 py-5">
            <h2 className="text-lg font-bold tracking-tight">Run context</h2>
            <p className="mt-1 text-sm text-[var(--app-muted)]">
              Context here is available while the playbook repeats its actions in the preview.
            </p>
          </div>

          <div className="space-y-6 p-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <label className="mb-2 block text-sm font-semibold">Playbook</label>
                <select
                  className="input"
                  value={playbookId}
                  onChange={event => setPlaybookId(event.target.value)}
                >
                  <option value="">Select a playbook...</option>
                  {playbooks.map(playbook => (
                    <option key={playbook.id} value={playbook.id}>
                      {playbook.name} ({playbook.status})
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-[var(--app-muted)]">
                  Runs execute the steps exactly from the latest active playbook version.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">Preview</label>
                <div className="rounded-xl border border-[rgba(217,138,63,0.16)] bg-[rgba(217,138,63,0.08)] px-4 py-3 text-sm font-semibold text-[var(--app-brand-sand)]">
                  Live sandbox preview
                </div>
                <p className="mt-2 text-xs text-[var(--app-muted)]">
                  Watch steps happen in real-time.
                </p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Run-specific context</label>
              <textarea
                className="input min-h-[220px]"
                value={agentBrief}
                onChange={event => setAgentBrief(event.target.value)}
                placeholder="Example: Use the onboarding spreadsheet in the attached folder. The employee to process is Marta Ruiz. Prioritize the row marked urgent and do not submit anything irreversible without double-checking the company email domain."
              />
              <p className="mt-2 text-xs text-[var(--app-muted)]">
                Use this for goals, constraints, business rules, or one-off context.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-sm font-semibold">Attachments</label>
                <span className="text-xs text-[var(--app-muted)]">
                  Text files are parsed into agent context. Images and binaries are attached as references.
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--app-line-soft)] px-4 py-4 text-left transition-colors hover:border-[var(--app-brand-sand)] hover:bg-[rgba(217,138,63,0.03)]"
                >
                  <span className="inline-flex rounded-lg bg-[rgba(217,138,63,0.1)] p-2 text-[var(--app-brand-sand)]">
                    <UploadSimple size={14} weight="bold" />
                  </span>
                  <div>
                    <span className="block text-sm font-semibold">Add files</span>
                    <span className="block text-[10px] text-[var(--app-muted)] uppercase font-bold tracking-wider">
                      PDF, Image, CSV
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--app-line-soft)] px-4 py-4 text-left transition-colors hover:border-[var(--app-brand-sand)] hover:bg-[rgba(217,138,63,0.03)]"
                >
                  <span className="inline-flex rounded-lg bg-[rgba(217,138,63,0.1)] p-2 text-[var(--app-brand-sand)]">
                    <FolderOpen size={14} weight="bold" />
                  </span>
                  <div>
                    <span className="block text-sm font-semibold">Add folder</span>
                    <span className="block text-[10px] text-[var(--app-muted)] uppercase font-bold tracking-wider">
                      Batch context
                    </span>
                  </div>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={event => void processSelectedFiles(event, 'files')}
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={event => void processSelectedFiles(event, 'folder')}
                {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              />

              {attachments.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {attachments.map(attachment => (
                    <div
                      key={attachment.id}
                      className="rounded-xl border border-[var(--app-line-soft)] px-4 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex text-[var(--app-brand-sand)]">
                          {attachmentIcon(attachment.kind)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">{attachment.name}</p>
                            <span className="rounded-full bg-[rgba(213,138,53,0.12)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8b6133]">
                              {attachment.kind}
                            </span>
                            <span className="text-xs text-[var(--app-muted)]">
                              {formatBytes(attachment.size)}
                            </span>
                          </div>
                          <p className="mt-1 truncate font-mono text-[11px] text-[var(--app-muted)]">
                            {attachment.path}
                          </p>
                          {attachment.textPreview?.trim() && (
                            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--app-muted)]">
                              {attachment.textPreview}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttachments(prev => prev.filter(item => item.id !== attachment.id))}
                          className="inline-flex rounded-full p-1 text-[var(--app-muted)] transition-colors hover:bg-[rgba(217,138,63,0.08)] hover:text-[var(--app-text)]"
                          aria-label={`Remove ${attachment.name}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--app-line-soft)] px-4 py-5 text-sm text-[var(--app-muted)] text-center">
                  No attachments yet.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.015)] p-4">
              <button
                type="button"
                onClick={() => setShowBatchTools(prev => !prev)}
                className="flex w-full items-center justify-between text-left"
              >
                <span>
                  <span className="block text-sm font-semibold">Batch CSV mode</span>
                  <span className="mt-0.5 block text-xs text-[var(--app-muted)]">
                    One run item per row.
                  </span>
                </span>
                <span className="rounded-lg bg-[rgba(217,138,63,0.12)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-brand-sand)]">
                  {showBatchTools ? 'Hide' : 'Show'}
                </span>
              </button>

              {showBatchTools && (
                <div className="mt-4 space-y-3">
                  <textarea
                    className="input min-h-[160px] font-mono text-xs"
                    value={csvText}
                    onChange={event => setCsvText(event.target.value)}
                    placeholder={`first_name,last_name,email\nAda,Lovelace,ada@example.com\nGrace,Hopper,grace@example.com`}
                  />
                  <p className="text-xs text-[var(--app-muted)]">
                    If valid CSV is present, it overrides the single context form above and
                    creates {parsedCsvRows.length || 0} run item(s).
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
              Payload
            </h2>
            <div className="mt-4 space-y-1.5 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-[rgba(27,42,74,0.03)] px-3 py-2">
                <span className="text-xs font-semibold text-[var(--app-muted)]">Mode</span>
                <span className="font-bold">Playbook run</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[rgba(27,42,74,0.03)] px-3 py-2">
                <span className="text-xs font-semibold text-[var(--app-muted)]">Items</span>
                <span className="font-bold">{showBatchTools && parsedCsvRows.length > 0 ? parsedCsvRows.length : 1}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[rgba(27,42,74,0.03)] px-3 py-2">
                <span className="text-xs font-semibold text-[var(--app-muted)]">Files</span>
                <span className="font-bold">{attachments.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[rgba(27,42,74,0.03)] px-3 py-2">
                <span className="text-xs font-semibold text-[var(--app-muted)]">Vault</span>
                <span className="font-bold">{selectedVaultIds.length}</span>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
              Vault
            </h2>
            {vaultCredentials.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--app-muted)]">
                No vault credentials available. Add one in Vault if the playbook needs secrets.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {vaultCredentials.map(credential => {
                  const selected = selectedVaultIds.includes(credential.id);
                  return (
                    <label
                      key={credential.id}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                        selected
                          ? 'border-[var(--app-brand-sand)] bg-[rgba(217,138,63,0.05)] text-[var(--app-text)]'
                          : 'border-[var(--app-line-soft)] bg-white text-[var(--app-muted)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={event => {
                          setSelectedVaultIds(prev =>
                            event.target.checked
                              ? [...prev, credential.id]
                              : prev.filter(id => id !== credential.id),
                          );
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold">{credential.name}</span>
                        <span className="mt-1 block font-mono text-[11px] text-[var(--app-muted)]">
                          {`{{${credential.template_key ?? 'vault_credential'}}} -> ${credential.masked_value}`}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="mt-3 text-xs text-[var(--app-muted)]">
              Selected credentials are injected as secure template variables for the active run.
            </p>
          </div>

          <button
            onClick={startRun}
            disabled={submitting}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm disabled:opacity-60"
          >
            {submitting ? (
              <span className="inline-flex animate-spin"><CircleNotch size={15} /></span>
            ) : (
              <Play size={15} weight="fill" />
            )}
            {submitting ? 'Starting...' : 'Start playbook run'}
          </button>
        </aside>
      </div>
    </PlatformShell>
  );
}
