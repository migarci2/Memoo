'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CircleNotch,
  Desktop,
  File,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Play,
  Sparkle,
  UploadSimple,
  X,
} from '@phosphor-icons/react';

import { PlatformShell } from '@/components/platform-shell';
import { useToast } from '@/components/toast-provider';
import { apiGet, apiPost } from '@/lib/api';
import type { Playbook, Run, VaultCredential } from '@/lib/types';

type AttachmentKind = 'text' | 'image' | 'binary';
type AttachmentSource = 'files' | 'folder';
type RunMode = 'agent' | 'playbook';

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
  const [runMode, setRunMode] = useState<RunMode>('agent');
  const [playbookId, setPlaybookId] = useState('');
  const [agentBrief, setAgentBrief] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [csvText, setCsvText] = useState('');
  const [showBatchTools, setShowBatchTools] = useState(false);
  const [useSandbox, setUseSandbox] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    apiGet<Playbook[]>(`/teams/${teamId}/playbooks`)
      .then(list => {
        const visible = list.filter(playbook => !playbook.tags.includes('system_agent'));
        const ready = visible.filter(playbook => playbook.status === 'active');
        setPlaybooks(ready.length > 0 ? ready : visible);
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
    if (runMode === 'agent' && !agentBrief.trim()) {
      toast('Tell the browser agent what to do', 'error');
      return;
    }

    if (runMode === 'playbook' && !playbookId) {
      toast('Select a playbook', 'error');
      return;
    }

    const inputRows = runMode === 'playbook' && showBatchTools && parsedCsvRows.length > 0
      ? parsedCsvRows
      : [buildSingleInputRow()];

    setSubmitting(true);
    try {
      const run = await apiPost<Run>(`/teams/${teamId}/runs`, {
        playbook_id: runMode === 'playbook' ? playbookId || undefined : undefined,
        input_rows: inputRows,
        input_source:
          runMode === 'playbook' && showBatchTools && parsedCsvRows.length > 0
            ? 'csv_paste'
            : runMode === 'agent'
              ? 'browser_agent'
              : 'agent_context',
        selected_vault_credential_ids: selectedVaultIds,
        use_sandbox: useSandbox,
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
    <PlatformShell teamId={teamId}>
      <div className="mb-7 max-w-4xl">
        <p className="landing-kicker">New run</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">
          {runMode === 'agent' ? 'Launch a browser agent' : 'Run a playbook'}
        </h1>
        <p className="mt-2 max-w-[70ch] text-[var(--app-muted)]">
          {runMode === 'agent'
            ? 'Give Gemini a goal and it will take over the live browser session directly. Attach any files or folders it should use as context.'
            : 'Pick a playbook, pass run-specific context, and optionally batch rows with CSV.'}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <section className="panel overflow-hidden">
          <div className="border-b border-[var(--app-line)] bg-[linear-gradient(135deg,rgba(12,23,39,0.02),rgba(37,99,235,0.06))] px-6 py-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex rounded-2xl bg-[rgba(37,99,235,0.12)] p-2 text-[var(--app-blue)]">
                <Sparkle size={18} weight="duotone" />
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight">What should your agent know?</h2>
                <p className="mt-1 text-sm text-[var(--app-muted)]">
                  Text you write here is injected directly into autonomous agent steps, even if
                  the playbook has no explicit variables for it.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6">
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setRunMode('agent')}
                className={`rounded-[1.75rem] border px-5 py-5 text-left transition-all ${
                  runMode === 'agent'
                    ? 'border-[var(--app-blue)] bg-[linear-gradient(135deg,rgba(15,103,143,0.1),rgba(15,103,143,0.04))] shadow-[0_16px_35px_-24px_rgba(15,103,143,0.38)]'
                    : 'border-[var(--app-line)] bg-[var(--app-surface-2)] hover:border-[var(--app-blue)]/35'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex rounded-2xl bg-[rgba(15,103,143,0.1)] p-2 text-[var(--app-blue)]">
                    <Sparkle size={18} weight="duotone" />
                  </span>
                  <div>
                    <p className="text-sm font-bold tracking-tight">Browser agent</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">
                      Gemini controls the browser directly from your prompt. No playbook required.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRunMode('playbook')}
                className={`rounded-[1.75rem] border px-5 py-5 text-left transition-all ${
                  runMode === 'playbook'
                    ? 'border-[var(--app-blue)] bg-[linear-gradient(135deg,rgba(15,103,143,0.1),rgba(15,103,143,0.04))] shadow-[0_16px_35px_-24px_rgba(15,103,143,0.38)]'
                    : 'border-[var(--app-line)] bg-[var(--app-surface-2)] hover:border-[var(--app-blue)]/35'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex rounded-2xl bg-[rgba(37,99,235,0.1)] p-2 text-[var(--app-blue)]">
                    <FileText size={18} weight="duotone" />
                  </span>
                  <div>
                    <p className="text-sm font-bold tracking-tight">Playbook run</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">
                      Execute a predefined workflow and only add extra context when needed.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                {runMode === 'playbook' ? (
                  <>
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
                      Use this mode when the workflow is already structured and repeatable.
                    </p>
                  </>
                ) : (
                  <div className="rounded-[1.5rem] border border-[var(--app-line)] bg-[var(--app-surface-2)] px-4 py-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                      Direct control
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      Gemini will decide the steps live inside the browser.
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">
                      Best for open-ended tasks like research, navigation, form filling, or one-off browser work.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">Run mode</label>
                <button
                  type="button"
                  onClick={() => setUseSandbox(prev => !prev)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-all ${
                    useSandbox
                      ? 'border-[var(--app-blue)] bg-[rgba(37,99,235,0.08)] text-[var(--app-blue)]'
                      : 'border-[var(--app-line)] bg-[var(--app-surface-2)] text-[var(--app-muted)]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Desktop size={17} weight={useSandbox ? 'duotone' : 'regular'} />
                    {useSandbox ? 'Live sandbox' : 'Headless'}
                  </span>
                  <span
                    className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                      useSandbox ? 'bg-[var(--app-blue)]' : 'bg-[var(--app-chip)]'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-transform ${
                        useSandbox ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </span>
                </button>
                <p className="mt-2 text-xs text-[var(--app-muted)]">
                  {useSandbox
                    ? 'Visible browser session. Best for autonomous agent runs.'
                    : 'Background run without the live browser view.'}
                </p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                {runMode === 'agent' ? 'Goal for the browser agent' : 'Run-specific context'}
              </label>
              <textarea
                className="input min-h-[220px]"
                value={agentBrief}
                onChange={event => setAgentBrief(event.target.value)}
                placeholder={
                  runMode === 'agent'
                    ? 'Example: Open Linear, find high-priority bugs assigned to onboarding, summarize the blockers, and stop before submitting or changing anything irreversible.'
                    : 'Example: Use the onboarding spreadsheet in the attached folder. The employee to process is Marta Ruiz. Prioritize the row marked urgent and do not submit anything irreversible without double-checking the company email domain.'
                }
              />
              <p className="mt-2 text-xs text-[var(--app-muted)]">
                {runMode === 'agent'
                  ? 'Describe the outcome you want, any constraints, and what the agent should avoid.'
                  : 'Use this for goals, constraints, business rules, or one-off context.'}
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
                  className="flex items-center justify-between rounded-2xl border border-dashed border-[var(--app-line)] bg-[var(--app-surface-2)] px-4 py-4 text-left transition-colors hover:border-[var(--app-blue)] hover:bg-[rgba(37,99,235,0.04)]"
                >
                  <span className="inline-flex items-center gap-3">
                    <span className="inline-flex rounded-xl bg-[rgba(37,99,235,0.1)] p-2 text-[var(--app-blue)]">
                      <UploadSimple size={16} weight="duotone" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">Add files</span>
                      <span className="block text-xs text-[var(--app-muted)]">
                        PDFs, docs, notes, screenshots, CSVs
                      </span>
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="flex items-center justify-between rounded-2xl border border-dashed border-[var(--app-line)] bg-[var(--app-surface-2)] px-4 py-4 text-left transition-colors hover:border-[var(--app-blue)] hover:bg-[rgba(37,99,235,0.04)]"
                >
                  <span className="inline-flex items-center gap-3">
                    <span className="inline-flex rounded-xl bg-[rgba(15,118,110,0.1)] p-2 text-[#0f766e]">
                      <FolderOpen size={16} weight="duotone" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">Add a folder</span>
                      <span className="block text-xs text-[var(--app-muted)]">
                        Preserve file paths for larger context packs
                      </span>
                    </span>
                  </span>
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
                <div className="mt-4 space-y-3">
                  {attachments.map(attachment => (
                    <div
                      key={attachment.id}
                      className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-2)] px-4 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex text-[var(--app-blue)]">
                          {attachmentIcon(attachment.kind)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">{attachment.name}</p>
                            <span className="rounded-full bg-[var(--app-chip)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
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
                          className="inline-flex rounded-full p-1 text-[var(--app-muted)] transition-colors hover:bg-[var(--app-chip)] hover:text-[var(--app-fg)]"
                          aria-label={`Remove ${attachment.name}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-2)] px-4 py-5 text-sm text-[var(--app-muted)]">
                  No attachments yet. Add files only if the agent needs extra context.
                </div>
              )}
            </div>

            {runMode === 'playbook' && (
              <div className="rounded-[1.75rem] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-4">
              <button
                type="button"
                onClick={() => setShowBatchTools(prev => !prev)}
                className="flex w-full items-center justify-between text-left"
              >
                <span>
                  <span className="block text-sm font-semibold">Advanced: batch CSV</span>
                  <span className="mt-1 block text-xs text-[var(--app-muted)]">
                    Use this only when you want one run item per row.
                  </span>
                </span>
                <span className="rounded-full bg-[var(--app-chip)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
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
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
              Run payload
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl bg-[var(--app-surface-2)] px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                  Mode
                </p>
                <p className="mt-1 text-xl font-extrabold">
                  {runMode === 'agent' ? 'Browser agent' : 'Playbook run'}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--app-surface-2)] px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                  Items
                </p>
                <p className="mt-1 text-2xl font-extrabold">
                  {runMode === 'playbook' && showBatchTools && parsedCsvRows.length > 0 ? parsedCsvRows.length : 1}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--app-surface-2)] px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                  Attachments
                </p>
                <p className="mt-1 text-2xl font-extrabold">{attachments.length}</p>
              </div>
              <div className="rounded-2xl bg-[var(--app-surface-2)] px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                  Vault credentials
                </p>
                <p className="mt-1 text-2xl font-extrabold">{selectedVaultIds.length}</p>
              </div>
              <div className="rounded-2xl bg-[var(--app-surface-2)] px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                  Browser
                </p>
                <p className="mt-1 text-xl font-extrabold">
                  {useSandbox ? 'Live sandbox' : 'Headless'}
                </p>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--app-muted)]">
              Vault credentials
            </h2>
            {vaultCredentials.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--app-muted)]">
                No vault credentials available. Add one in Vault if the agent or playbook needs secrets.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {vaultCredentials.map(credential => {
                  const selected = selectedVaultIds.includes(credential.id);
                  return (
                    <label
                      key={credential.id}
                      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors ${
                        selected
                          ? 'border-[var(--app-blue)] bg-[rgba(37,99,235,0.08)]'
                          : 'border-[var(--app-line)] bg-[var(--app-surface-2)]'
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
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? (
              <span className="inline-flex animate-spin"><CircleNotch size={15} /></span>
            ) : (
              <Play size={15} weight="fill" />
            )}
            {submitting ? 'Starting...' : runMode === 'agent' ? 'Start browser agent' : 'Start playbook run'}
          </button>
        </aside>
      </div>
    </PlatformShell>
  );
}
