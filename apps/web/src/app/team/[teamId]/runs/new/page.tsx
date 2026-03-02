'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CircleNotch, Trash } from '@phosphor-icons/react';

import { PlatformShell } from '@/components/platform-shell';
import { useToast } from '@/components/toast-provider';
import { apiGet, apiPost } from '@/lib/api';
import type { Playbook, PlaybookVersion } from '@/lib/types';

type Props = { params: Promise<{ teamId: string }> };

// ─── Inner form (needs useSearchParams inside Suspense) ─────────────────────

function NewRunForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>('');
  const [latestVersion, setLatestVersion] = useState<PlaybookVersion | null>(null);
  const [items, setItems] = useState<Record<string, string>[]>([{}]);
  const [loading, setLoading] = useState(false);
  const [loadingPlaybooks, setLoadingPlaybooks] = useState(true);
  const [loadingVersion, setLoadingVersion] = useState(false);

  // Fetch active playbooks
  useEffect(() => {
    apiGet<Playbook[]>(`/teams/${teamId}/playbooks`)
      .then(data => {
        const active = data.filter(p => p.status === 'active');
        setPlaybooks(active);

        // Pre-select if ?playbookId= is in the URL
        const preselect = searchParams.get('playbookId');
        if (preselect && active.find(p => p.id === preselect)) {
          setSelectedPlaybookId(preselect);
        } else if (active.length > 0) {
          setSelectedPlaybookId(active[0].id);
        }
      })
      .catch(() => toast('Failed to load playbooks', 'error'))
      .finally(() => setLoadingPlaybooks(false));
  }, [teamId, searchParams, toast]);

  // Fetch latest version when playbook changes
  useEffect(() => {
    if (!selectedPlaybookId) return;
    setLoadingVersion(true);
    setLatestVersion(null);
    apiGet<{ playbook: Playbook; latest_version: PlaybookVersion | null }>(
      `/playbooks/${selectedPlaybookId}`
    )
      .then(d => setLatestVersion(d.latest_version))
      .catch(() => toast('Failed to load playbook version', 'error'))
      .finally(() => setLoadingVersion(false));
  }, [selectedPlaybookId, toast]);

  const variables = latestVersion?.steps
    .flatMap(s => Object.keys(s.variables ?? {}))
    .filter((v, i, arr) => arr.indexOf(v) === i) ?? [];

  // ── Item row helpers ───────────────────────────────────────────────────────
  const addItem = () => setItems(prev => [...prev, {}]);
  const removeItem = (idx: number) =>
    setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  const updateItem = (idx: number, key: string, value: string) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [key]: value } : item));

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!latestVersion) return;

    setLoading(true);
    try {
      const run = await apiPost<{ id: string }>(`/teams/${teamId}/runs`, {
        playbook_version_id: latestVersion.id,
        items: items.map((item, i) => ({ row_index: i, input_payload: item })),
        trigger_type: 'manual',
      });
      toast('Run started!', 'success');
      router.push(`/team/${teamId}/runs/${run.id}`);
    } catch {
      toast('Failed to start run', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PlatformShell teamId={teamId}>
      <div className="mb-6">
        <p className="landing-kicker">Automation</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">New run</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {/* Playbook selector */}
        <div className="panel p-6">
          <label className="mb-2 block text-sm font-semibold">
            Playbook <span className="text-red-500">*</span>
          </label>
          {loadingPlaybooks ? (
            <div className="input flex items-center gap-2 text-[var(--app-muted)]">
            <span className="animate-spin inline-flex text-[var(--app-muted)]"><CircleNotch size={16} /></span> Loading…
            </div>
          ) : (
            <select
              className="input"
              value={selectedPlaybookId}
              onChange={e => setSelectedPlaybookId(e.target.value)}
              required
            >
              {playbooks.length === 0 ? (
                <option value="" disabled>
                  No active playbooks available
                </option>
              ) : (
                playbooks.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
              )}
            </select>
          )}
          {loadingVersion && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--app-muted)]">
            <span className="animate-spin inline-flex text-[var(--app-muted)] text-xs"><CircleNotch size={12} /></span> Loading version…
            </p>
          )}
          {latestVersion && (
            <p className="mt-2 text-xs text-[var(--app-muted)]">
              v{latestVersion.version_number} — {latestVersion.steps.length} steps
              {latestVersion.change_note ? ` · ${latestVersion.change_note}` : ''}
            </p>
          )}
        </div>

        {/* Items */}
        <div className="panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Input items</p>
              <p className="text-xs text-[var(--app-muted)]">
                Each row is processed against the playbook independently.
              </p>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="btn-secondary rounded-full px-3 py-1.5 text-xs"
            >
              + Add row
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="relative rounded-xl border border-[var(--app-line)] bg-[var(--app-surface-2)]/40 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">
                    Row {idx + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-[var(--app-muted)] transition-colors hover:text-red-500"
                      aria-label="Remove row"
                    >
                      <Trash size={14} />
                    </button>
                  )}
                </div>

                {variables.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {variables.map(v => (
                      <div key={v}>
                        <label className="mb-1 block text-xs font-medium text-[var(--app-muted)]">
                          {v}
                        </label>
                        <input
                          type="text"
                          className="input text-sm"
                          placeholder={v}
                          value={item[v] ?? ''}
                          onChange={e => updateItem(idx, v, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--app-muted)]">
                    This playbook has no declared variables. The run will execute with no input data.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !latestVersion}
            className="btn-primary flex items-center gap-2 rounded-full px-6 py-2.5 font-semibold disabled:opacity-60"
          >
            {loading && <span className="animate-spin inline-flex"><CircleNotch size={16} /></span>}
            Start run
          </button>
          <a href={`/team/${teamId}/runs`} className="btn-secondary rounded-full px-5 py-2.5 text-sm">
            Cancel
          </a>
        </div>
      </form>
    </PlatformShell>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function NewRunPage({ params }: Props) {
  const { teamId } = await params;
  return (
    <Suspense fallback={null}>
      <NewRunForm teamId={teamId} />
    </Suspense>
  );
}
