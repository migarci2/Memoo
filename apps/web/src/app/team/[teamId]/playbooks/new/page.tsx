'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CircleNotch } from '@phosphor-icons/react';

import { PlatformShell } from '@/components/platform-shell';
import { useToast } from '@/components/toast-provider';
import { apiGet, apiPost } from '@/lib/api';
import { getFolderColorToken } from '@/lib/playbook-folders';
import type { Playbook, PlaybookFolder } from '@/lib/types';

export default function NewPlaybookPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState({
    folderId: '',
    name: '',
    description: '',
    tags: '',
  });
  const [folders, setFolders] = useState<PlaybookFolder[]>([]);
  const [saving, setSaving] = useState(false);
  const selectedFolder = folders.find(folder => folder.id === form.folderId) ?? null;
  const selectedFolderToken = getFolderColorToken(selectedFolder?.color);

  useEffect(() => {
    apiGet<PlaybookFolder[]>(`/teams/${teamId}/playbook-folders`)
      .then(setFolders)
      .catch(() => {});
  }, [teamId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast('Name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const playbook = await apiPost<Playbook>(`/teams/${teamId}/playbooks`, {
        folder_id: form.folderId || null,
        name: form.name.trim(),
        description: form.description.trim() || null,
        tags: form.tags
          .split(',')
          .map(t => t.trim())
          .filter(Boolean),
      });
      toast('Playbook created!', 'success');
      router.push(`/team/${teamId}/playbooks/${playbook.id}`);
    } catch {
      toast('Failed to create playbook', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformShell teamId={teamId}>
      <div className="mb-6">
        <p className="landing-kicker">Playbooks</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">New playbook</h1>
        <p className="mt-2 text-[var(--app-muted)]">
          Create a playbook manually, or{' '}
          <a href={`/team/${teamId}/capture`} className="text-[var(--app-blue)] font-semibold hover:underline">
            teach a workflow
          </a>{' '}
          to auto-generate one with Gemini. Manage folders{' '}
          <a href={`/team/${teamId}/playbooks/folders`} className="text-[var(--app-blue)] font-semibold hover:underline">
            here
          </a>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="panel max-w-2xl space-y-5 p-6">
        <label className="grid gap-2 text-sm font-semibold">
          Folder
          <select
            className="input"
            value={form.folderId}
            onChange={e => setForm(prev => ({ ...prev, folderId: e.target.value }))}
          >
            <option value="">Uncategorized</option>
            {folders.map(folder => (
              <option key={folder.id} value={folder.id}>{folder.name}</option>
            ))}
          </select>
          <span className="text-xs font-normal text-[var(--app-muted)]">
            {selectedFolder ? 'New playbook will be created directly inside this folder.' : 'Leave empty to send it to Inbox first.'}
          </span>
        </label>

        {selectedFolder ? (
          <div
            className="rounded-[1.4rem] border px-4 py-3"
            style={{
              borderColor: selectedFolderToken.border,
              backgroundColor: selectedFolderToken.soft,
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: selectedFolderToken.text }}>
              Selected folder
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--app-text)]">{selectedFolder.name}</p>
          </div>
        ) : null}

        <label className="grid gap-2 text-sm font-semibold">
          Name
          <input
            className="input"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Employee onboarding checklist"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Description
          <textarea
            className="input min-h-[100px] resize-y"
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="What does this playbook automate?"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Tags
          <input
            className="input"
            value={form.tags}
            onChange={e => setForm(prev => ({ ...prev, tags: e.target.value }))}
            placeholder="onboarding, hr, automation"
          />
          <span className="text-xs font-normal text-[var(--app-muted)]">Comma-separated.</span>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving && (
              <span className="animate-spin inline-flex">
                <CircleNotch size={15} />
              </span>
            )}
            {saving ? 'Creating…' : 'Create playbook'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary rounded-full px-5 py-2.5 text-sm font-semibold"
          >
            Cancel
          </button>
        </div>
      </form>
    </PlatformShell>
  );
}
