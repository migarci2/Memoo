'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CircleNotch, Folder, PencilSimple, Plus, Trash, X } from '@phosphor-icons/react';

import { PlatformShell } from '@/components/platform-shell';
import { useToast } from '@/components/toast-provider';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import type { Playbook, PlaybookFolder } from '@/lib/types';

export default function PlaybookFoldersPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { toast } = useToast();

  const [folders, setFolders] = useState<PlaybookFolder[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [movingPlaybookId, setMovingPlaybookId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [folderRows, playbookRows] = await Promise.all([
        apiGet<PlaybookFolder[]>(`/teams/${teamId}/playbook-folders`),
        apiGet<Playbook[]>(`/teams/${teamId}/playbooks`),
      ]);
      setFolders(folderRows);
      setPlaybooks(playbookRows);
    } catch {
      toast('Failed to load folders and playbooks', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, [teamId]);

  async function createFolder() {
    if (!newName.trim()) {
      toast('Folder name is required', 'error');
      return;
    }
    setCreating(true);
    try {
      const row = await apiPost<PlaybookFolder>(`/teams/${teamId}/playbook-folders`, {
        name: newName.trim(),
      });
      setFolders(prev => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      toast('Folder created', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create folder', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function saveFolder(folderId: string) {
    if (!editingName.trim()) {
      toast('Folder name is required', 'error');
      return;
    }
    setSavingId(folderId);
    try {
      const row = await apiPatch<PlaybookFolder>(`/playbook-folders/${folderId}`, {
        name: editingName.trim(),
      });
      setFolders(prev => prev.map(f => (f.id === folderId ? row : f)).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingId(null);
      setEditingName('');
      toast('Folder updated', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update folder', 'error');
    } finally {
      setSavingId(null);
    }
  }

  async function deleteFolder(folderId: string) {
    setSavingId(folderId);
    try {
      await apiDelete(`/playbook-folders/${folderId}`);
      setFolders(prev => prev.filter(f => f.id !== folderId));
      setPlaybooks(prev => prev.map(p => (p.folder_id === folderId ? { ...p, folder_id: null } : p)));
      toast('Folder deleted. Playbooks moved to uncategorized.', 'success');
    } catch {
      toast('Failed to delete folder', 'error');
    } finally {
      setSavingId(null);
    }
  }

  async function movePlaybook(playbookId: string, folderId: string) {
    const normalized = folderId || null;
    const current = playbooks.find(playbook => playbook.id === playbookId);
    if (!current || (current.folder_id ?? null) === normalized) return;

    setMovingPlaybookId(playbookId);
    try {
      const updated = await apiPatch<Playbook>(`/playbooks/${playbookId}`, { folder_id: normalized });
      setPlaybooks(prev => prev.map(playbook => (playbook.id === playbookId ? updated : playbook)));
      toast(normalized ? 'Playbook assigned to folder.' : 'Playbook moved to uncategorized.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to move playbook', 'error');
    } finally {
      setMovingPlaybookId(null);
    }
  }

  const filteredPlaybooks = playbooks
    .filter(playbook => playbook.name.toLowerCase().includes(query.toLowerCase().trim()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const folderOptions = [{ id: '', name: 'Uncategorized' }, ...folders.map(folder => ({ id: folder.id, name: folder.name }))];

  return (
    <PlatformShell teamId={teamId}>
      <div className="mb-6">
        <p className="landing-kicker">Playbooks</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Folders</h1>
        <p className="mt-2 max-w-[70ch] text-[var(--app-muted)]">
          Create and manage playbook folders. You can also assign any playbook to a folder from this screen.
        </p>
      </div>

      <div className="panel max-w-4xl p-6">
        <div className="mb-5 flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-sm font-semibold">New folder</label>
            <input
              className="input"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Operations, HR, Finance..."
            />
          </div>
          <button
            onClick={createFolder}
            disabled={creating}
            className="btn-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm disabled:opacity-60"
          >
            {creating ? <CircleNotch size={14} className="animate-spin" /> : <Plus size={14} weight="bold" />}
            {creating ? 'Creating…' : 'Create folder'}
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[var(--app-muted)]">
            <CircleNotch size={20} className="mx-auto animate-spin" />
          </div>
        ) : folders.length === 0 ? (
          <div className="py-12 text-center text-[var(--app-muted)]">
            <Folder size={36} className="mx-auto mb-3 opacity-35" />
            <p className="font-semibold">No folders yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {folders.map(folder => (
              <div key={folder.id} className="panel-tight flex items-center gap-3 p-3">
                <Folder size={16} className="text-[var(--app-blue)]" />
                {editingId === folder.id ? (
                  <>
                    <input
                      className="input h-9 flex-1"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                    />
                    <button
                      onClick={() => saveFolder(folder.id)}
                      disabled={savingId === folder.id}
                      className="rounded-full border border-[var(--app-line)] px-3 py-1 text-xs font-semibold"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditingName('');
                      }}
                      className="rounded-full border border-[var(--app-line)] p-1.5 text-[var(--app-muted)]"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold">{folder.name}</p>
                      <p className="text-xs text-[var(--app-muted)]">
                        {playbooks.filter(playbook => playbook.folder_id === folder.id).length} playbook(s)
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingId(folder.id);
                        setEditingName(folder.name);
                      }}
                      className="rounded-full border border-[var(--app-line)] p-1.5 text-[var(--app-muted)] hover:text-[var(--app-blue)]"
                    >
                      <PencilSimple size={14} />
                    </button>
                    <button
                      onClick={() => deleteFolder(folder.id)}
                      disabled={savingId === folder.id}
                      className="rounded-full border border-[rgba(191,100,100,0.35)] p-1.5 text-[#8b3a3a] disabled:opacity-50"
                    >
                      {savingId === folder.id ? <CircleNotch size={14} className="animate-spin" /> : <Trash size={14} />}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel mt-5 max-w-4xl p-6">
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-sm font-semibold">Assign playbooks</label>
            <input
              className="input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by playbook name..."
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[var(--app-muted)]">
            <CircleNotch size={20} className="mx-auto animate-spin" />
          </div>
        ) : filteredPlaybooks.length === 0 ? (
          <div className="py-12 text-center text-[var(--app-muted)]">
            <p className="font-semibold">No playbooks found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPlaybooks.map(playbook => (
              <div key={playbook.id} className="panel-tight flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-[220px] flex-1">
                  <p className="truncate text-sm font-semibold">{playbook.name}</p>
                  <p className="text-xs capitalize text-[var(--app-muted)]">{playbook.status}</p>
                </div>
                <div className="flex min-w-[220px] flex-1 flex-wrap justify-end gap-1.5 sm:max-w-[560px]">
                  {folderOptions.map(option => {
                    const isSelected = (playbook.folder_id ?? '') === option.id;
                    return (
                      <button
                        key={`${playbook.id}-${option.id || 'none'}`}
                        type="button"
                        onClick={() => movePlaybook(playbook.id, option.id)}
                        disabled={movingPlaybookId === playbook.id}
                        className={[
                          'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                          'whitespace-nowrap',
                          isSelected
                            ? 'border-[var(--app-blue)] bg-[var(--app-chip)] text-[var(--app-blue)]'
                            : 'border-[var(--app-line)] text-[var(--app-muted)] hover:border-[var(--app-line-strong)] hover:bg-[var(--app-surface-2)]',
                          movingPlaybookId === playbook.id ? 'opacity-70' : '',
                        ].join(' ')}
                      >
                        {option.name}
                      </button>
                    );
                  })}
                  {movingPlaybookId === playbook.id ? <CircleNotch size={14} className="animate-spin self-center text-[var(--app-muted)]" /> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PlatformShell>
  );
}
