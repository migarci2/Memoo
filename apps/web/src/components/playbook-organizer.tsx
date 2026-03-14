'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import {
  Check,
  CircleNotch,
  DotsSixVertical,
  Folder,
  FolderOpen,
  FunnelSimple,
  PencilSimple,
  Plus,
  Sparkle,
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

type BoardColumn = {
  id: string;
  folderId: string | null;
  name: string;
  hint: string;
  system?: boolean;
  items: Playbook[];
  totalItems: number;
  readyItems: number;
  tone: string;
  accent: string;
  softAccent: string;
  accentBorder: string;
  accentText: string;
};

const STATUS_META: Record<Playbook['status'], string> = {
  active: 'border-[rgba(123,155,134,0.38)] bg-[rgba(123,155,134,0.14)] text-[#335443]',
  draft: 'border-[rgba(95,119,132,0.32)] bg-[rgba(95,119,132,0.12)] text-[#3f5e6f]',
  archived: 'border-[rgba(191,155,106,0.36)] bg-[rgba(191,155,106,0.14)] text-[#7d5d31]',
};

const STATUS_FILTERS: Array<{ id: 'all' | Playbook['status']; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'draft', label: 'Draft' },
  { id: 'archived', label: 'Archived' },
];

const BOARD_FILTERS = [
  { id: 'all', label: 'All lanes' },
  { id: 'active', label: 'With playbooks' },
  { id: 'empty', label: 'Empty lanes' },
  { id: 'inbox', label: 'Inbox only' },
] as const;

function sortPlaybooks(playbooks: Playbook[]) {
  const statusRank: Record<Playbook['status'], number> = {
    active: 0,
    draft: 1,
    archived: 2,
  };

  return [...playbooks].sort((a, b) => {
    const byStatus = statusRank[a.status] - statusRank[b.status];
    if (byStatus !== 0) return byStatus;
    return a.name.localeCompare(b.name);
  });
}

function FolderColorPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-muted)]">Folder color</p>
      <div className="flex flex-wrap gap-2">
        {PLAYBOOK_FOLDER_COLORS.map(option => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              disabled={disabled}
              className={[
                'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
                selected ? 'shadow-[0_12px_28px_-20px_rgba(15,33,52,0.45)]' : 'bg-white hover:-translate-y-[1px]',
              ].join(' ')}
              style={{
                borderColor: selected ? option.border : 'var(--app-line)',
                backgroundColor: selected ? option.soft : 'rgba(255,255,255,0.92)',
                color: option.text,
              }}
            >
              <span
                className="inline-flex h-3.5 w-3.5 rounded-full border border-white/70"
                style={{ backgroundColor: option.solid }}
              />
              {option.label}
              {selected ? <Check size={12} weight="bold" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
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
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(PLAYBOOK_FOLDER_COLORS[0].value);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Playbook['status']>('all');
  const [boardFilter, setBoardFilter] =
    useState<(typeof BOARD_FILTERS)[number]['id']>('all');
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [editingFolderColor, setEditingFolderColor] = useState(PLAYBOOK_FOLDER_COLORS[0].value);
  const [savingFolderId, setSavingFolderId] = useState<string | null>(null);
  const [movingPlaybookId, setMovingPlaybookId] = useState<string | null>(null);
  const [draggingPlaybookId, setDraggingPlaybookId] = useState<string | null>(null);
  const [hoveredColumnId, setHoveredColumnId] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const visiblePlaybooks = sortPlaybooks(
    playbooks.filter(playbook => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        playbook.name.toLowerCase().includes(normalizedQuery) ||
        (playbook.description ?? '').toLowerCase().includes(normalizedQuery) ||
        playbook.tags.some(tag => tag.toLowerCase().includes(normalizedQuery));
      const matchesStatus = statusFilter === 'all' || playbook.status === statusFilter;
      return matchesQuery && matchesStatus;
    }),
  );

  const uncategorizedCount = playbooks.filter(playbook => !playbook.folder_id).length;
  const categorizedCount = playbooks.length - uncategorizedCount;
  const activeCount = playbooks.filter(
    playbook => playbook.status === 'active',
  ).length;
  const emptyFolderCount = folders.filter(
    folder => !playbooks.some(playbook => playbook.folder_id === folder.id),
  ).length;

  const columns: BoardColumn[] = [
    {
      id: '__uncategorized__',
      folderId: null,
      name: 'Inbox',
      hint: 'Use this as the staging lane before a playbook gets a permanent owner.',
      system: true,
      items: visiblePlaybooks.filter(playbook => !playbook.folder_id),
      totalItems: playbooks.filter(playbook => !playbook.folder_id).length,
      readyItems: playbooks.filter(
        playbook =>
          !playbook.folder_id &&
          playbook.status === 'active',
      ).length,
      tone: 'from-[#eff5f7] via-white to-[#f7f4ed]',
      accent: '#4e8ca7',
      softAccent: 'rgba(78,140,167,0.16)',
      accentBorder: 'rgba(78,140,167,0.34)',
      accentText: '#24566a',
    },
    ...folders.map(folder => {
      const token = getFolderColorToken(folder.color);
      const folderItems = playbooks.filter(playbook => playbook.folder_id === folder.id);
      return {
        id: folder.id,
        folderId: folder.id,
        name: folder.name,
        hint:
          folderItems.length > 0
            ? 'Keep related playbooks together and use the quick move control when drag is inconvenient.'
            : 'Create the folder now, then drop or reassign playbooks into it later.',
        items: visiblePlaybooks.filter(playbook => playbook.folder_id === folder.id),
        totalItems: folderItems.length,
        readyItems: folderItems.filter(
          playbook => playbook.status === 'active',
        ).length,
        tone: token.tone,
        accent: token.solid,
        softAccent: token.soft,
        accentBorder: token.border,
        accentText: token.text,
      };
    }),
  ];

  const displayedColumns = columns.filter(column => {
    if (selectedColumnId && column.id !== selectedColumnId) return false;
    if (boardFilter === 'all') return true;
    if (boardFilter === 'active') return column.totalItems > 0;
    if (boardFilter === 'empty') return !column.system && column.totalItems === 0;
    if (boardFilter === 'inbox') return column.system;
    return true;
  });

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) {
      toast('Folder name is required', 'error');
      return;
    }

    setCreatingFolder(true);
    try {
      const created = await apiPost<PlaybookFolder>(`/teams/${teamId}/playbook-folders`, {
        name,
        color: newFolderColor,
      });
      setFolders(prev => sortPlaybookFolders([...prev, created], playbooks));
      setNewFolderName('');
      setNewFolderColor(PLAYBOOK_FOLDER_COLORS[0].value);
      setSelectedColumnId(created.id);
      setBoardFilter('all');
      toast('Folder created', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to create folder', 'error');
    } finally {
      setCreatingFolder(false);
    }
  }

  async function saveFolder(folderId: string) {
    const name = editingFolderName.trim();
    if (!name) {
      toast('Folder name is required', 'error');
      return;
    }

    setSavingFolderId(folderId);
    try {
      const updated = await apiPatch<PlaybookFolder>(`/playbook-folders/${folderId}`, {
        name,
        color: editingFolderColor,
      });
      setFolders(prev =>
        sortPlaybookFolders(
          prev.map(folder => (folder.id === folderId ? updated : folder)),
          playbooks,
        ),
      );
      setEditingFolderId(null);
      setEditingFolderName('');
      setEditingFolderColor(PLAYBOOK_FOLDER_COLORS[0].value);
      toast('Folder updated', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to update folder', 'error');
    } finally {
      setSavingFolderId(null);
    }
  }

  async function deleteFolder(folderId: string) {
    const folder = folders.find(item => item.id === folderId);
    const assignedCount = playbooks.filter(playbook => playbook.folder_id === folderId).length;
    const confirmed = window.confirm(
      assignedCount > 0
        ? `Delete "${folder?.name ?? 'this folder'}"? ${assignedCount} playbook(s) will move to Inbox.`
        : `Delete "${folder?.name ?? 'this folder'}"?`,
    );

    if (!confirmed) return;

    setSavingFolderId(folderId);
    try {
      await apiDelete(`/playbook-folders/${folderId}`);
      setFolders(prev =>
        sortPlaybookFolders(
          prev.filter(folderItem => folderItem.id !== folderId),
          playbooks.map(playbook =>
            playbook.folder_id === folderId ? { ...playbook, folder_id: null } : playbook,
          ),
        ),
      );
      setPlaybooks(prev =>
        sortPlaybooks(
          prev.map(playbook =>
            playbook.folder_id === folderId ? { ...playbook, folder_id: null } : playbook,
          ),
        ),
      );
      setSelectedColumnId(current => (current === folderId ? null : current));
      toast('Folder deleted. Playbooks moved to Inbox.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to delete folder', 'error');
    } finally {
      setSavingFolderId(null);
    }
  }

  async function movePlaybook(playbookId: string, nextFolderId: string | null) {
    const current = playbooks.find(playbook => playbook.id === playbookId);
    if (!current) return;

    const currentFolderId = current.folder_id ?? null;
    if (currentFolderId === nextFolderId) return;

    const optimisticPlaybooks = sortPlaybooks(
      playbooks.map(playbook =>
        playbook.id === playbookId ? { ...playbook, folder_id: nextFolderId } : playbook,
      ),
    );

    setMovingPlaybookId(playbookId);
    setPlaybooks(optimisticPlaybooks);
    setFolders(prev => sortPlaybookFolders(prev, optimisticPlaybooks));

    try {
      const updated = await apiPatch<Playbook>(`/playbooks/${playbookId}`, { folder_id: nextFolderId });
      setPlaybooks(prev => {
        const next = sortPlaybooks(
          prev.map(playbook => (playbook.id === playbookId ? updated : playbook)),
        );
        setFolders(currentFolders => sortPlaybookFolders(currentFolders, next));
        return next;
      });
      toast(nextFolderId ? 'Playbook moved' : 'Playbook moved to Inbox', 'success');
    } catch (error) {
      const revertedPlaybooks = sortPlaybooks(
        playbooks.map(playbook =>
          playbook.id === playbookId ? { ...playbook, folder_id: currentFolderId } : playbook,
        ),
      );
      setPlaybooks(revertedPlaybooks);
      setFolders(prev => sortPlaybookFolders(prev, revertedPlaybooks));
      toast(error instanceof Error ? error.message : 'Failed to move playbook', 'error');
    } finally {
      setMovingPlaybookId(null);
    }
  }

  function onDropColumn(folderId: string | null) {
    if (!draggingPlaybookId) return;
    const playbookId = draggingPlaybookId;
    setDraggingPlaybookId(null);
    setHoveredColumnId(null);
    void movePlaybook(playbookId, folderId);
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.95fr)]">
        <div className="panel overflow-hidden p-0">
          <div className="border-b border-[var(--app-line)] bg-[linear-gradient(140deg,rgba(248,252,255,0.96),rgba(236,243,247,0.9))] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-muted)]">
              Library control
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--app-text)]">
              Drag, filter, or reassign instantly
            </h2>
            <p className="mt-2 max-w-[62ch] text-sm text-[var(--app-muted)]">
              Search the library, narrow by status, then organize with either drag and drop or the move selector on each card.
            </p>
          </div>

          <div className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--app-text)]">
                Search playbooks
              </label>
              <input
                className="input h-11"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search by name, description, or tag..."
              />
            </div>

            <div className="flex flex-wrap items-end gap-2">
              {STATUS_FILTERS.map(filter => {
                const selected = statusFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setStatusFilter(filter.id)}
                    className={[
                      'rounded-full border px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
                      selected
                        ? 'border-[var(--app-blue)] bg-[var(--app-chip)] text-[var(--app-blue)] shadow-[0_10px_24px_rgba(15,103,143,0.08)]'
                        : 'border-[var(--app-line)] bg-white text-[var(--app-muted)] hover:border-[var(--app-line-strong)] hover:text-[var(--app-text)]',
                    ].join(' ')}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel overflow-hidden p-0">
          <div className="border-b border-[var(--app-line)] bg-[linear-gradient(140deg,rgba(255,250,243,0.96),rgba(248,252,255,0.92))] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-muted)]">
              Folder studio
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--app-text)]">
              {mode === 'manage' ? 'Shape the folder system' : 'Give playbooks a clear home'}
            </h2>
            <p className="mt-2 text-sm text-[var(--app-muted)]">
              Folders now carry color and live counts, so the structure reads at a glance instead of feeling like a flat list.
            </p>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="space-y-3 rounded-[1.8rem] border border-[var(--app-line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,250,252,0.92))] p-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--app-text)]">New folder</label>
                <div className="flex flex-col gap-2">
                  <input
                    className="input h-11"
                    value={newFolderName}
                    onChange={event => setNewFolderName(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void createFolder();
                      }
                    }}
                    placeholder="Operations, Revenue, Client delivery..."
                  />
                  <FolderColorPicker value={newFolderColor} onChange={setNewFolderColor} disabled={creatingFolder} />
                  <button
                    type="button"
                    onClick={() => void createFolder()}
                    disabled={creatingFolder}
                    className="btn-primary inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm disabled:opacity-60"
                  >
                    <span className="inline-flex">
                      {creatingFolder ? <CircleNotch size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
                    </span>
                    {creatingFolder ? 'Creating…' : 'Create folder'}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Folders', value: folders.length, help: 'Custom ownership lanes' },
                { label: 'Organized', value: categorizedCount, help: 'Playbooks already assigned' },
                { label: 'Empty', value: emptyFolderCount, help: 'Available lanes waiting for work' },
              ].map(item => (
                <div
                  key={item.label}
                  className="rounded-[1.6rem] border border-[var(--app-line)] bg-white/80 px-4 py-4 shadow-[0_16px_36px_-24px_rgba(15,33,52,0.3)]"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                    {item.label}
                  </p>
                  <p className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--app-text)]">
                    {item.value}
                  </p>
                  <p className="mt-1 text-xs text-[var(--app-muted)]">{item.help}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[1.8rem] border border-[var(--app-line)] bg-white/82 p-4 shadow-[0_16px_36px_-28px_rgba(15,33,52,0.28)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                    Folder map
                  </p>
                  <p className="mt-1 text-sm text-[var(--app-muted)]">
                    Focus a single lane when you want to triage one area without the rest of the board.
                  </p>
                </div>
                {(selectedColumnId || boardFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedColumnId(null);
                      setBoardFilter('all');
                    }}
                    className="rounded-full border border-[var(--app-line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--app-text)] transition-colors hover:border-[var(--app-line-strong)]"
                  >
                    Reset view
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-2">
                {columns.map(column => (
                  <button
                    key={column.id}
                    type="button"
                    onClick={() => {
                      setSelectedColumnId(current => (current === column.id ? null : column.id));
                      setBoardFilter('all');
                    }}
                    className={[
                      'flex w-full items-center justify-between gap-3 rounded-[1.25rem] border px-3 py-3 text-left transition-all active:scale-[0.99]',
                      selectedColumnId === column.id
                        ? 'shadow-[0_12px_28px_-20px_rgba(15,33,52,0.38)]'
                        : 'bg-white/70 hover:-translate-y-[1px]',
                    ].join(' ')}
                    style={{
                      borderColor:
                        selectedColumnId === column.id ? column.accentBorder : 'var(--app-line)',
                      backgroundColor:
                        selectedColumnId === column.id ? column.softAccent : 'rgba(255,255,255,0.82)',
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/70"
                        style={{ backgroundColor: column.softAccent, color: column.accentText }}
                      >
                        {column.system ? <Sparkle size={15} weight="duotone" /> : <Folder size={15} weight="duotone" />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--app-text)]">{column.name}</p>
                        <p className="text-xs text-[var(--app-muted)]">
                          {column.totalItems} total · {column.readyItems} ready
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: column.accentText }}>
                      {selectedColumnId === column.id ? 'Focused' : 'Focus'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.8fr)]">
        {[
          {
            label: 'Filtered cards',
            value: visiblePlaybooks.length,
            desc: 'Matching the current search and status filter',
          },
          {
            label: 'Ready to run',
            value: activeCount,
            desc: 'Active playbooks across the workspace',
          },
          {
            label: 'Board lanes',
            value: displayedColumns.length,
            desc: selectedColumnId ? 'Currently focused down to one lane' : 'Visible columns after board filters',
          },
          {
            label: 'Inbox',
            value: uncategorizedCount,
            desc: 'Playbooks that still need a folder owner',
          },
        ].map(card => (
          <article key={card.label} className="panel p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">{card.label}</p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight">{card.value}</p>
            <p className="mt-1 text-sm text-[var(--app-muted)]">{card.desc}</p>
          </article>
        ))}
      </section>

      {playbooks.length === 0 ? (
        <div className="panel overflow-hidden p-0">
          <div className="bg-[linear-gradient(150deg,rgba(248,252,255,0.98),rgba(245,247,243,0.94))] px-6 py-16 text-center">
            <span className="mx-auto inline-flex rounded-full border border-[var(--app-line)] bg-white/80 p-4 shadow-[0_18px_38px_-24px_rgba(15,33,52,0.4)]">
              <FolderOpen size={28} weight="duotone" />
            </span>
            <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-[var(--app-text)]">
              No playbooks to organize yet
            </h3>
            <p className="mx-auto mt-2 max-w-[46ch] text-sm text-[var(--app-muted)]">
              Teach a workflow or create one manually, then come back here to assign it into the right folder structure.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href={`/team/${teamId}/capture`} className="btn-primary rounded-full px-4 py-2 text-sm">
                Teach new
              </Link>
              <Link
                href={`/team/${teamId}/playbooks/new`}
                className="btn-secondary rounded-full border border-[var(--app-line)] px-4 py-2 text-sm font-semibold"
              >
                Create manually
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="panel overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-line)] bg-[linear-gradient(140deg,rgba(255,255,255,0.96),rgba(239,245,247,0.84))] px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                Board
              </p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--app-text)]">
                Playbook lanes
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--app-line)] bg-white/85 px-3 py-2 text-xs font-medium text-[var(--app-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                <span className="inline-flex">
                  {movingPlaybookId ? <CircleNotch size={13} weight="bold" /> : <DotsSixVertical size={13} weight="bold" />}
                </span>
                {movingPlaybookId ? 'Saving move…' : 'Drag or use quick move'}
              </div>

              <div className="flex flex-wrap gap-2">
                {BOARD_FILTERS.map(filter => {
                  const selected = boardFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => {
                        setBoardFilter(filter.id);
                        if (filter.id === 'inbox') setSelectedColumnId(null);
                      }}
                      className={[
                        'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98]',
                        selected
                          ? 'border-[var(--app-blue)] bg-[var(--app-chip)] text-[var(--app-blue)]'
                          : 'border-[var(--app-line)] bg-white text-[var(--app-muted)] hover:border-[var(--app-line-strong)] hover:text-[var(--app-text)]',
                      ].join(' ')}
                    >
                      <FunnelSimple size={12} weight="bold" />
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto px-4 py-4">
            {displayedColumns.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[1.8rem] border border-dashed border-[var(--app-line)] bg-[linear-gradient(180deg,rgba(248,251,252,0.82),rgba(255,255,255,0.98))] px-6 py-10 text-center">
                <span className="inline-flex rounded-full border border-[var(--app-line)] bg-white/90 p-3 text-[var(--app-blue)]">
                  <FunnelSimple size={18} weight="duotone" />
                </span>
                <h3 className="mt-3 text-lg font-bold tracking-tight text-[var(--app-text)]">
                  No lanes match this board view
                </h3>
                <p className="mt-1 max-w-[42ch] text-sm text-[var(--app-muted)]">
                  Change the board filter or reset the focused lane to see the rest of the playbook library again.
                </p>
              </div>
            ) : (
              <div className="flex min-w-max gap-4">
                <AnimatePresence initial={false}>
                  {displayedColumns.map(column => {
                    const isHovered = hoveredColumnId === column.id;
                    return (
                      <motion.section
                        key={column.id}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ type: 'spring', stiffness: 110, damping: 18 }}
                        className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-[2rem] border border-[var(--app-line)] bg-white shadow-[0_20px_44px_-28px_rgba(15,33,52,0.32)]"
                      >
                        <div
                          className={`bg-gradient-to-br ${column.tone} border-b border-[var(--app-line)] px-4 py-4`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              {editingFolderId === column.id && !column.system ? (
                                <div className="space-y-3">
                                  <input
                                    className="input h-10"
                                    value={editingFolderName}
                                    onChange={event => setEditingFolderName(event.target.value)}
                                    onKeyDown={event => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault();
                                        void saveFolder(column.id);
                                      }
                                    }}
                                  />
                                  <FolderColorPicker value={editingFolderColor} onChange={setEditingFolderColor} />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void saveFolder(column.id)}
                                      disabled={savingFolderId === column.id}
                                      className="rounded-full border border-[var(--app-line)] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[var(--app-text)]"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingFolderId(null);
                                        setEditingFolderName('');
                                        setEditingFolderColor(PLAYBOOK_FOLDER_COLORS[0].value);
                                      }}
                                      className="rounded-full border border-[var(--app-line)] bg-white/75 px-3 py-1.5 text-xs font-semibold text-[var(--app-muted)]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="inline-flex rounded-full border border-white/60 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
                                      style={{
                                        backgroundColor: column.softAccent,
                                        color: column.accentText,
                                      }}
                                    >
                                      {column.system ? (
                                        <Sparkle size={14} weight="duotone" />
                                      ) : (
                                        <Folder size={14} weight="duotone" />
                                      )}
                                    </span>
                                    <div className="min-w-0">
                                      <h3 className="truncate text-lg font-bold tracking-tight text-[var(--app-text)]">
                                        {column.name}
                                      </h3>
                                      <p className="text-xs text-[var(--app-muted)]">
                                        {column.totalItems} total playbook(s) · {column.readyItems} ready
                                      </p>
                                    </div>
                                  </div>
                                  <p className="mt-3 text-xs leading-relaxed text-[var(--app-muted)]">
                                    {column.hint}
                                  </p>
                                </>
                              )}
                            </div>

                            {!column.system && editingFolderId !== column.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const folder = folders.find(item => item.id === column.id);
                                    setEditingFolderId(column.id);
                                    setEditingFolderName(column.name);
                                    setEditingFolderColor(folder?.color ?? PLAYBOOK_FOLDER_COLORS[0].value);
                                  }}
                                  className="rounded-full border border-[var(--app-line)] bg-white/80 p-2 text-[var(--app-muted)] transition-colors hover:text-[var(--app-blue)]"
                                  aria-label={`Rename ${column.name}`}
                                >
                                  <PencilSimple size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteFolder(column.id)}
                                  disabled={savingFolderId === column.id}
                                  className="rounded-full border border-[rgba(191,100,100,0.35)] bg-white/80 p-2 text-[#8b3a3a] disabled:opacity-50"
                                  aria-label={`Delete ${column.name}`}
                                >
                                  {savingFolderId === column.id ? <CircleNotch size={14} /> : <Trash size={14} />}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div
                          onDragOver={event => {
                            event.preventDefault();
                            if (hoveredColumnId !== column.id) setHoveredColumnId(column.id);
                          }}
                          onDragLeave={event => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                              setHoveredColumnId(current => (current === column.id ? null : current));
                            }
                          }}
                          onDrop={event => {
                            event.preventDefault();
                            onDropColumn(column.folderId);
                          }}
                          className={[
                            'm-3 flex min-h-[320px] flex-1 flex-col rounded-[1.6rem] border border-dashed p-3 transition-all',
                            isHovered
                              ? 'bg-[rgba(231,244,251,0.72)] shadow-[inset_0_0_0_1px_rgba(15,103,143,0.08)]'
                              : 'border-[rgba(171,188,199,0.55)] bg-[linear-gradient(180deg,rgba(248,251,252,0.84),rgba(255,255,255,0.98))]',
                          ].join(' ')}
                          style={isHovered ? { borderColor: column.accent } : undefined}
                        >
                          {column.items.length === 0 ? (
                            <div className="flex flex-1 flex-col items-center justify-center rounded-[1.2rem] border border-white/60 bg-white/60 px-5 py-8 text-center">
                              <span
                                className="inline-flex rounded-full border p-3"
                                style={{
                                  borderColor: column.accentBorder,
                                  backgroundColor: column.softAccent,
                                  color: column.accentText,
                                }}
                              >
                                <DotsSixVertical size={18} weight="duotone" />
                              </span>
                              <p className="mt-3 text-sm font-semibold text-[var(--app-text)]">
                                {normalizedQuery || statusFilter !== 'all'
                                  ? 'Nothing matches this filter here'
                                  : 'Empty lane'}
                              </p>
                              <p className="mt-1 text-xs leading-relaxed text-[var(--app-muted)]">
                                {normalizedQuery || statusFilter !== 'all'
                                  ? 'Try another search or move a visible playbook into this lane.'
                                  : 'Drop a playbook here or use the move selector from another column.'}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {column.items.map(playbook => {
                                const isDragging = draggingPlaybookId === playbook.id;
                                const isSaving = movingPlaybookId === playbook.id;
                                return (
                                  <motion.article
                                    key={playbook.id}
                                    layout
                                    draggable={!isSaving}
                                    onDragStart={() => {
                                      setDraggingPlaybookId(playbook.id);
                                      setHoveredColumnId(column.id);
                                    }}
                                    onDragEnd={() => {
                                      setDraggingPlaybookId(null);
                                      setHoveredColumnId(null);
                                    }}
                                    className={[
                                      'rounded-[1.4rem] border border-[var(--app-line)] bg-white/94 p-4 shadow-[0_14px_30px_-24px_rgba(15,33,52,0.34)] transition-all',
                                      isDragging
                                        ? 'cursor-grabbing opacity-60 ring-2 ring-[rgba(15,103,143,0.12)]'
                                        : 'cursor-grab hover:-translate-y-[1px] hover:shadow-[0_18px_34px_-24px_rgba(15,33,52,0.35)]',
                                    ].join(' ')}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold tracking-tight text-[var(--app-text)]">
                                          {playbook.name}
                                        </p>
                                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--app-muted)]">
                                          {playbook.description || 'No description yet.'}
                                        </p>
                                      </div>
                                      <span
                                        className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${STATUS_META[playbook.status]}`}
                                      >
                                        {playbook.status}
                                      </span>
                                    </div>

                                    {playbook.tags.length > 0 ? (
                                      <div className="mt-3 flex flex-wrap gap-1.5">
                                        {playbook.tags.slice(0, 3).map(tag => (
                                          <span
                                            key={`${playbook.id}-${tag}`}
                                            className="rounded-full bg-[var(--app-chip)] px-2 py-1 text-[11px] font-semibold text-[var(--app-blue)]"
                                          >
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}

                                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--app-line)] pt-3">
                                      <div className="min-w-0">
                                        <p className="text-[11px] text-[var(--app-muted)]">
                                          Created {formatDate(playbook.created_at)}
                                        </p>
                                        <select
                                          value={playbook.folder_id ?? '__inbox__'}
                                          onChange={event =>
                                            void movePlaybook(
                                              playbook.id,
                                              event.target.value === '__inbox__'
                                                ? null
                                                : event.target.value,
                                            )
                                          }
                                          disabled={isSaving}
                                          className="mt-2 h-8 rounded-full border border-[var(--app-line)] bg-white px-3 text-[11px] font-semibold text-[var(--app-text)] outline-none transition-colors hover:border-[var(--app-line-strong)] disabled:opacity-60"
                                        >
                                          <option value="__inbox__">Move to Inbox</option>
                                          {folders.map(folder => (
                                            <option key={folder.id} value={folder.id}>
                                              {folder.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        {isSaving ? (
                                          <span className="inline-flex text-[var(--app-muted)]">
                                            <CircleNotch size={13} />
                                          </span>
                                        ) : null}
                                        <Link
                                          href={`/team/${teamId}/playbooks/${playbook.id}`}
                                          draggable={false}
                                          className="rounded-full border border-[var(--app-line)] px-3 py-1.5 text-[11px] font-semibold text-[var(--app-text)] transition-colors hover:border-[var(--app-line-strong)] hover:bg-[var(--app-surface-2)]"
                                        >
                                          Open
                                        </Link>
                                      </div>
                                    </div>
                                  </motion.article>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </motion.section>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
