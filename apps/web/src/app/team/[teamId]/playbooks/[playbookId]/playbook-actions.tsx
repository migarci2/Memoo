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

  const STATUS_CLASSES: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    archived: 'bg-amber-50 text-amber-700 border-amber-100',
    draft: 'bg-slate-50 text-slate-700 border-slate-100',
  };

  if (editing) {
    return (
      <div className="panel mt-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit playbook</h2>
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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--app-line-soft)] text-[var(--app-muted)] hover:bg-[rgba(27,42,74,0.03)]"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-[var(--app-muted)]">Folder</label>
            <select
              className="input"
              value={form.folderId}
              onChange={e => setForm(prev => ({ ...prev, folderId: e.target.value }))}
            >
              <option value="">Uncategorized (Inbox)</option>
              {folders.map(folder => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1 md:col-span-2">
            <label className="text-xs font-medium text-[var(--app-muted)]">Name</label>
            <input className="input" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
          </div>
          <div className="grid gap-1 md:col-span-2">
            <label className="text-xs font-medium text-[var(--app-muted)]">Description</label>
            <textarea
              className="input min-h-[80px] resize-y"
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What does this playbook do?"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-[var(--app-muted)]">Status</label>
            <select
              className="input"
              value={form.status}
              onChange={e => setForm(prev => ({ ...prev, status: e.target.value as Playbook['status'] }))}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-[var(--app-muted)]">Tags</label>
            <input
              className="input"
              value={form.tags}
              onChange={e => setForm(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="ops, automation, hr"
            />
          </div>
        </div>
        
        {selectedFolder && (
          <div
            className="mt-4 rounded-xl border px-4 py-3"
            style={{
              borderColor: selectedFolderToken.border,
              backgroundColor: selectedFolderToken.soft,
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: selectedFolderToken.text }}>
              Current folder
            </p>
            <p className="mt-0.5 text-sm font-bold text-[var(--app-text)]">{selectedFolder.name}</p>
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm"
          >
            {saving ? (
              <span className="flex animate-spin">
                <CircleNotch size={14} />
              </span>
            ) : (
              <FloppyDisk size={14} weight="bold" />
            )}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button onClick={() => setEditing(false)} className="rounded-lg border border-[var(--app-line-soft)] px-4 py-1.5 text-sm font-semibold hover:bg-[rgba(27,42,74,0.03)]">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`rounded-md border px-2.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_CLASSES[playbook.status] || STATUS_CLASSES.draft}`}
      >
        {playbook.status}
      </span>
      <button
        onClick={() => setEditing(true)}
        className="rounded-lg border border-[var(--app-line-soft)] px-2.5 py-1 text-[10px] font-bold uppercase text-[var(--app-muted)] hover:bg-[rgba(27,42,74,0.03)] transition-colors inline-flex items-center gap-1.5"
      >
        <Pencil size={12} weight="bold" /> Edit Details
      </button>
    </div>
  );
}
