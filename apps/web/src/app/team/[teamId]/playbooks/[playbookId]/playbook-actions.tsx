'use client';

import { CircleNotch, FloppyDisk, Pencil, X } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/toast-provider';
import { apiGet, apiPatch } from '@/lib/api';
import { getFolderColorToken } from '@/lib/playbook-folders';
import type { Playbook, PlaybookFolder } from '@/lib/types';

type Props = {
  playbook: Playbook;
  teamId: string;
};

export function PlaybookActions({ playbook: initial, teamId }: Props) {
  const [playbook, setPlaybook] = useState(initial);
  const [folders, setFolders] = useState<PlaybookFolder[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    folderId: initial.folder_id ?? '',
    name: initial.name,
    description: initial.description ?? '',
    status: initial.status,
    tags: initial.tags.join(', '),
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const selectedFolder = folders.find(folder => folder.id === form.folderId) ?? null;
  const selectedFolderToken = getFolderColorToken(selectedFolder?.color);

  useEffect(() => {
    apiGet<PlaybookFolder[]>(`/teams/${teamId}/playbook-folders`)
      .then(setFolders)
      .catch(() => {});
  }, [teamId]);

  async function save() {
    setSaving(true);
    try {
      const updated = await apiPatch<Playbook>(`/playbooks/${playbook.id}`, {
        folder_id: form.folderId || null,
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: form.status,
        tags: form.tags
          .split(',')
          .map(t => t.trim())
          .filter(Boolean),
      });
      setPlaybook(updated);
      setEditing(false);
      toast('Playbook updated.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save changes.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="panel mt-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold tracking-tight">Edit playbook</h2>
          <button
            onClick={() => {
              setEditing(false);
              setForm({
                folderId: playbook.folder_id ?? '',
                name: playbook.name,
                description: playbook.description ?? '',
                status: playbook.status,
                tags: playbook.tags.join(', '),
              });
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--app-line)] text-[var(--app-muted)] hover:bg-[var(--app-surface-2)]"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
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
              {selectedFolder ? 'This playbook will stay grouped with the selected folder.' : 'No folder means the playbook returns to Inbox.'}
            </span>
          </label>
          <label className="grid gap-2 text-sm font-medium md:col-span-2">
            Name
            <input className="input" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
          </label>
          <label className="grid gap-2 text-sm font-medium md:col-span-2">
            Description
            <textarea
              className="input min-h-[80px] resize-y"
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What does this playbook do?"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Status
            <select
              className="input"
              value={form.status}
              onChange={e => setForm(prev => ({ ...prev, status: e.target.value as Playbook['status'] }))}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Tags
            <input
              className="input"
              value={form.tags}
              onChange={e => setForm(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="ops, automation, hr"
            />
            <span className="text-xs text-[var(--app-muted)]">Comma-separated.</span>
          </label>
        </div>
        {selectedFolder ? (
          <div
            className="mt-4 rounded-[1.4rem] border px-4 py-3"
            style={{
              borderColor: selectedFolderToken.border,
              backgroundColor: selectedFolderToken.soft,
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: selectedFolderToken.text }}>
              Current folder
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--app-text)]">{selectedFolder.name}</p>
          </div>
        ) : null}
        <div className="mt-5 flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
          >
            {saving ? <span className="animate-spin inline-flex"><CircleNotch size={14} /></span> : <FloppyDisk size={14} weight="bold" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button onClick={() => setEditing(false)} className="btn-secondary rounded-full px-4 py-2 text-sm">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={[
          'rounded-full border px-3 py-1 text-xs font-bold capitalize',
          playbook.status === 'active'
            ? 'border-[rgba(123,155,134,0.4)] bg-[rgba(123,155,134,0.18)] text-[#335443]'
            : playbook.status === 'archived'
              ? 'border-[rgba(191,155,106,0.42)] bg-[rgba(191,155,106,0.18)] text-[#7d5d31]'
              : 'border-[rgba(95,119,132,0.32)] bg-[rgba(95,119,132,0.14)] text-[#3f5e6f]',
        ].join(' ')}
      >
        {playbook.status}
      </span>
      <button
        onClick={() => setEditing(true)}
        className="btn-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
      >
        <Pencil size={12} weight="bold" /> Edit
      </button>
    </div>
  );
}
