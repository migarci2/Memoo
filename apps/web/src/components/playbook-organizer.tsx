'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Check,
  CircleNotch,
  Folder,
  FolderOpen,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
} from '@phosphor-icons/react';

import { useToast } from '@/components/toast-provider';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import {
  getFolderColorToken,
  PLAYBOOK_FOLDER_COLORS,
  sortPlaybookFolders,
} from '@/lib/playbook-folders';
import type { Playbook, PlaybookFolder } from '@/lib/types';
import { formatDate } from '@/lib/utils';

type PlaybookOrganizerProps = {
  teamId: string;
  initialFolders: PlaybookFolder[];
  initialPlaybooks: Playbook[];
  mode?: 'library' | 'manage';
};

const STATUS_STYLE: Record<Playbook['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700',
  draft: 'bg-gray-100 text-gray-600',
  archived: 'bg-amber-50 text-amber-700',
};

function sortPlaybooks(playbooks: Playbook[]) {
  const rank: Record<Playbook['status'], number> = { active: 0, draft: 1, archived: 2 };
  return [...playbooks].sort((a, b) => {
    const s = rank[a.status] - rank[b.status];
    return s !== 0 ? s : a.name.localeCompare(b.name);
  });
}

export function PlaybookOrganizer({
  teamId,
  initialFolders,
  initialPlaybooks,
  mode = 'library',
}: PlaybookOrganizerProps) {
  const { toast } = useToast();

  const [folders, setFolders] = useState<PlaybookFolder[]>(() =>
    sortPlaybookFolders(initialFolders, initialPlaybooks),
  );
  const [playbooks, setPlaybooks] = useState<Playbook[]>(() => sortPlaybooks(initialPlaybooks));

  // Filters
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Playbook['status']>('all');
  const [folderFilter, setFolderFilter] = useState<string | null>(null); // null = all, '__inbox__' = uncategorized

  // Folder management
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [savingFolderId, setSavingFolderId] = useState<string | null>(null);
  const [movingPlaybookId, setMovingPlaybookId] = useState<string | null>(null);

  // Filtered playbooks
  const nq = query.trim().toLowerCase();
  const visible = sortPlaybooks(
    playbooks.filter(pb => {
      const matchQ = !nq || pb.name.toLowerCase().includes(nq) || (pb.description ?? '').toLowerCase().includes(nq) || pb.tags.some(t => t.toLowerCase().includes(nq));
      const matchS = statusFilter === 'all' || pb.status === statusFilter;
      const matchF = folderFilter === null || (folderFilter === '__inbox__' ? !pb.folder_id : pb.folder_id === folderFilter);
      return matchQ && matchS && matchF;
    }),
  );

  // Counts
  const inboxCount = playbooks.filter(pb => !pb.folder_id).length;

  // ── API helpers ──

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) { toast('Folder name is required', 'error'); return; }
    setCreatingFolder(true);
    try {
      const created = await apiPost<PlaybookFolder>(`/teams/${teamId}/playbook-folders`, { name, color: PLAYBOOK_FOLDER_COLORS[0].value });
      setFolders(prev => sortPlaybookFolders([...prev, created], playbooks));
      setNewFolderName('');
      toast('Folder created', 'success');
    } catch (e) { toast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setCreatingFolder(false); }
  }

  async function saveFolder(folderId: string) {
    const name = editingFolderName.trim();
    if (!name) { toast('Name required', 'error'); return; }
    setSavingFolderId(folderId);
    try {
      const updated = await apiPatch<PlaybookFolder>(`/playbook-folders/${folderId}`, { name });
      setFolders(prev => sortPlaybookFolders(prev.map(f => f.id === folderId ? updated : f), playbooks));
      setEditingFolderId(null);
      toast('Folder updated', 'success');
    } catch (e) { toast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setSavingFolderId(null); }
  }

  async function deleteFolder(folderId: string) {
    const folder = folders.find(f => f.id === folderId);
    const count = playbooks.filter(pb => pb.folder_id === folderId).length;
    if (!window.confirm(count > 0 ? `Delete "${folder?.name}"? ${count} playbook(s) will move to Inbox.` : `Delete "${folder?.name}"?`)) return;
    setSavingFolderId(folderId);
    try {
      await apiDelete(`/playbook-folders/${folderId}`);
      const nextPbs = playbooks.map(pb => pb.folder_id === folderId ? { ...pb, folder_id: null } : pb);
      setFolders(prev => sortPlaybookFolders(prev.filter(f => f.id !== folderId), nextPbs));
      setPlaybooks(sortPlaybooks(nextPbs));
      if (folderFilter === folderId) setFolderFilter(null);
      toast('Folder deleted', 'success');
    } catch (e) { toast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setSavingFolderId(null); }
  }

  async function movePlaybook(playbookId: string, nextFolderId: string | null) {
    const current = playbooks.find(pb => pb.id === playbookId);
    if (!current || (current.folder_id ?? null) === nextFolderId) return;
    setMovingPlaybookId(playbookId);
    const optimistic = sortPlaybooks(playbooks.map(pb => pb.id === playbookId ? { ...pb, folder_id: nextFolderId } : pb));
    setPlaybooks(optimistic);
    setFolders(prev => sortPlaybookFolders(prev, optimistic));
    try {
      const updated = await apiPatch<Playbook>(`/playbooks/${playbookId}`, { folder_id: nextFolderId });
      setPlaybooks(prev => { const next = sortPlaybooks(prev.map(pb => pb.id === playbookId ? updated : pb)); setFolders(f => sortPlaybookFolders(f, next)); return next; });
      toast(nextFolderId ? 'Moved to folder' : 'Moved to Inbox', 'success');
    } catch (e) {
      setPlaybooks(sortPlaybooks(playbooks));
      setFolders(prev => sortPlaybookFolders(prev, playbooks));
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally { setMovingPlaybookId(null); }
  }

  function getFolderName(folderId: string | null) {
    if (!folderId) return 'Inbox';
    return folders.find(f => f.id === folderId)?.name ?? 'Unknown';
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">

      {/* ── Folder Sidebar ── */}
      <aside className="space-y-1">
        <button
          onClick={() => setFolderFilter(null)}
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            folderFilter === null ? 'bg-[rgba(27,42,74,0.06)] text-[var(--app-text)]' : 'text-[var(--app-muted)] hover:bg-[rgba(27,42,74,0.03)]'
          }`}
        >
          <FolderOpen size={15} /> All playbooks
          <span className="ml-auto text-xs tabular-nums">{playbooks.length}</span>
        </button>
        <button
          onClick={() => setFolderFilter('__inbox__')}
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            folderFilter === '__inbox__' ? 'bg-[rgba(27,42,74,0.06)] text-[var(--app-text)]' : 'text-[var(--app-muted)] hover:bg-[rgba(27,42,74,0.03)]'
          }`}
        >
          <Folder size={15} /> Inbox
          <span className="ml-auto text-xs tabular-nums">{inboxCount}</span>
        </button>

        <hr className="my-2 border-[var(--app-line-soft)]" />

        {folders.map(folder => {
          const count = playbooks.filter(pb => pb.folder_id === folder.id).length;
          const token = getFolderColorToken(folder.color);
          const isEditing = editingFolderId === folder.id;

          return (
            <div key={folder.id} className="group relative">
              {isEditing ? (
                <div className="space-y-1 rounded-lg border border-[var(--app-line-soft)] bg-white p-2">
                  <input
                    className="input h-8 text-sm"
                    value={editingFolderName}
                    onChange={e => setEditingFolderName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void saveFolder(folder.id); } }}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button onClick={() => void saveFolder(folder.id)} disabled={savingFolderId === folder.id} className="rounded-md bg-[var(--app-text)] px-2 py-1 text-xs font-semibold text-white">Save</button>
                    <button onClick={() => setEditingFolderId(null)} className="rounded-md px-2 py-1 text-xs text-[var(--app-muted)]">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setFolderFilter(folder.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    folderFilter === folder.id ? 'bg-[rgba(27,42,74,0.06)] text-[var(--app-text)]' : 'text-[var(--app-muted)] hover:bg-[rgba(27,42,74,0.03)]'
                  }`}
                >
                  <span className="inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: token.solid }} />
                  <span className="truncate">{folder.name}</span>
                  <span className="ml-auto text-xs tabular-nums">{count}</span>
                </button>
              )}
              {!isEditing && (
                <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name); }}
                    className="rounded p-1 text-[var(--app-muted)] hover:text-[var(--app-text)]"
                  >
                    <PencilSimple size={12} />
                  </button>
                  <button
                    onClick={() => void deleteFolder(folder.id)}
                    disabled={savingFolderId === folder.id}
                    className="rounded p-1 text-[var(--app-muted)] hover:text-red-600"
                  >
                    <Trash size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <hr className="my-2 border-[var(--app-line-soft)]" />

        {/* New folder */}
        <div className="flex gap-1">
          <input
            className="input h-8 flex-1 text-xs"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void createFolder(); } }}
            placeholder="New folder…"
          />
          <button
            onClick={() => void createFolder()}
            disabled={creatingFolder}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--app-line-soft)] text-[var(--app-muted)] hover:text-[var(--app-text)] disabled:opacity-40"
          >
            {creatingFolder ? <CircleNotch size={13} /> : <Plus size={13} weight="bold" />}
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="space-y-3">
        {/* Search + status filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)]"><MagnifyingGlass size={14} /></span>
            <input
              className="input h-9 pl-8 text-sm"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search playbooks…"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'active', 'draft', 'archived'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-[var(--app-text)] text-white'
                    : 'text-[var(--app-muted)] hover:bg-[rgba(27,42,74,0.05)]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--app-line-soft)] px-6 py-12 text-center">
            <span className="mx-auto block text-[var(--app-muted)] w-fit mb-2"><FolderOpen size={24} /></span>
            <p className="mt-2 text-sm font-semibold text-[var(--app-text)]">No playbooks found</p>
            <p className="mt-1 text-xs text-[var(--app-muted)]">Try adjusting your search or filter.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--app-line-soft)] bg-white">
            {/* Header */}
            <div className="grid grid-cols-[minmax(0,1fr)_100px_140px_140px_100px] gap-3 border-b border-[var(--app-line-soft)] bg-[rgba(27,42,74,0.02)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--app-muted)]">
              <span>Name</span>
              <span>Status</span>
              <span>Folder</span>
              <span>Updated</span>
              <span>Move</span>
            </div>
            {/* Rows */}
            <div className="divide-y divide-[var(--app-line-soft)]">
              {visible.map(pb => (
                <div
                  key={pb.id}
                  className="grid grid-cols-[minmax(0,1fr)_100px_140px_140px_100px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[rgba(27,42,74,0.015)]"
                >
                  <Link href={`/team/${teamId}/playbooks/${pb.id}`} className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--app-text)] hover:text-[var(--app-brand-teal)]">{pb.name}</p>
                    {pb.tags.length > 0 && (
                      <div className="mt-0.5 flex gap-1">
                        {pb.tags.slice(0, 2).map(t => (
                          <span key={t} className="rounded bg-[rgba(27,42,74,0.04)] px-1 py-0.5 text-[9px] font-semibold uppercase text-[var(--app-muted)]">{t}</span>
                        ))}
                      </div>
                    )}
                  </Link>
                  <span className={`inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[pb.status]}`}>
                    {pb.status}
                  </span>
                  <span className="truncate text-xs text-[var(--app-muted)]">{getFolderName(pb.folder_id ?? null)}</span>
                  <span className="text-xs text-[var(--app-muted)]">{formatDate(pb.created_at)}</span>
                  <select
                    value={pb.folder_id ?? ''}
                    onChange={e => void movePlaybook(pb.id, e.target.value || null)}
                    disabled={movingPlaybookId === pb.id}
                    className="h-7 w-full rounded-md border border-[var(--app-line-soft)] bg-white px-1 text-[10px] font-medium text-[var(--app-muted)] disabled:opacity-40"
                  >
                    <option value="">Inbox</option>
                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
