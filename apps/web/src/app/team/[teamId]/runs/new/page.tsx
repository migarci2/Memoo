'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CircleNotch, Desktop, Play } from '@phosphor-icons/react';

import { PlatformShell } from '@/components/platform-shell';
import { useToast } from '@/components/toast-provider';
import { apiGet, apiPost } from '@/lib/api';
import type { Playbook, Run, VaultCredential } from '@/lib/types';

export default function NewRunPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [vaultCredentials, setVaultCredentials] = useState<VaultCredential[]>([]);
  const [selectedVaultIds, setSelectedVaultIds] = useState<string[]>([]);
  const [playbookId, setPlaybookId] = useState('');
  const [inputSource, setInputSource] = useState('manual');
  const [csvText, setCsvText] = useState('');
  const [useSandbox, setUseSandbox] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGet<Playbook[]>(`/teams/${teamId}/playbooks`)
      .then(list => {
        // only show published playbooks
        const published = list.filter(p => (p.status as string) === 'published');
        setPlaybooks(published.length > 0 ? published : list);
      })
      .catch(() => {});
    apiGet<VaultCredential[]>(`/teams/${teamId}/vault`)
      .then(setVaultCredentials)
      .catch(() => {});
  }, [teamId]);

  const parseCsv = (raw: string): Record<string, string>[] => {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => (row[h] = vals[i] ?? ''));
      return row;
    });
  };

  const startRun = async () => {
    if (!playbookId) {
      toast('Select a playbook', 'error');
      return;
    }

    const inputRows = parseCsv(csvText);
    if (inputRows.length === 0) {
      toast('Paste at least one data row (with headers)', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const run = await apiPost<Run>(`/teams/${teamId}/runs`, {
        playbook_id: playbookId,
        input_rows: inputRows,
        input_source: inputSource || 'csv_paste',
        selected_vault_credential_ids: selectedVaultIds,
        use_sandbox: useSandbox,
      });
      toast('Run started! Watching execution…', 'success');
      router.push(`/team/${teamId}/runs/${run.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to start run', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PlatformShell teamId={teamId}>
      <div className="mb-6">
        <p className="landing-kicker">New run</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Start a batch run</h1>
        <p className="mt-2 max-w-[70ch] text-[var(--app-muted)]">
          Select a compiled playbook and paste CSV data. Each row becomes an item
          processed through every playbook step with full verification.
        </p>
      </div>

      <div className="panel max-w-2xl p-6 space-y-5">
        {/* Playbook select */}
        <div>
          <label className="mb-1 block text-sm font-semibold">Playbook</label>
          <select
            className="input"
            value={playbookId}
            onChange={e => setPlaybookId(e.target.value)}
          >
            <option value="">Select a playbook…</option>
            {playbooks.map(pb => (
              <option key={pb.id} value={pb.id}>
                {pb.name} ({pb.status})
              </option>
            ))}
          </select>
        </div>

        {/* Input source */}
        <div>
          <label className="mb-1 block text-sm font-semibold">Input source</label>
          <div className="flex gap-2">
            {['csv_paste', 'manual'].map(opt => (
              <button
                key={opt}
                onClick={() => setInputSource(opt)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize transition-colors ${
                  inputSource === opt
                    ? 'bg-[var(--app-fg)] text-[var(--app-bg)]'
                    : 'bg-[var(--app-chip)] text-[var(--app-muted)] hover:bg-[var(--app-line)]'
                }`}
              >
                {opt === 'csv_paste' ? 'CSV Paste' : 'Manual'}
              </button>
            ))}
          </div>
        </div>

        {/* CSV textarea */}
        <div>
          <label className="mb-1 block text-sm font-semibold">
            Input data (CSV with headers)
          </label>
          <textarea
            className="input min-h-[140px] font-mono text-xs"
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder={`first_name,last_name,email,role\nAlice,Strand,alice@northline.io,Analyst\nBjorn,Moen,bjorn@northline.io,Engineer`}
          />
          <p className="mt-1 text-xs text-[var(--app-muted)]">
            First row = headers (used as variable names). Each subsequent row = one run item.
            {csvText.trim() && ` Parsed: ${parseCsv(csvText).length} row(s).`}
          </p>
        </div>

        {/* Sandbox toggle */}
        <div>
          <label className="mb-1 block text-sm font-semibold">Execution mode</label>
          <button
            type="button"
            onClick={() => setUseSandbox(prev => !prev)}
            className={`inline-flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
              useSandbox
                ? 'border-[var(--app-blue)] bg-[rgba(59,130,246,0.08)] text-[var(--app-blue)]'
                : 'border-[var(--app-line)] bg-transparent text-[var(--app-muted)] hover:bg-[var(--app-chip)]'
            }`}
          >
            <Desktop size={18} weight={useSandbox ? 'duotone' : 'regular'} />
            <span>
              {useSandbox ? 'Sandbox — live browser' : 'Headless — background execution'}
            </span>
            <span
              className={`ml-1 h-4 w-8 rounded-full transition-colors ${
                useSandbox ? 'bg-[var(--app-blue)]' : 'bg-[var(--app-chip)]'
              } relative inline-flex items-center`}
            >
              <span
                className={`absolute h-3 w-3 rounded-full bg-white transition-transform ${
                  useSandbox ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>
          <p className="mt-1 text-xs text-[var(--app-muted)]">
            {useSandbox
              ? 'Runs in a visible browser you can watch and interact with — like ChatGPT agent mode.'
              : 'Runs in the background with headless Playwright. Faster but not visible.'}
          </p>
        </div>

        {/* Vault credentials */}
        <div>
          <label className="mb-1 block text-sm font-semibold">Vault credentials</label>
          {vaultCredentials.length === 0 ? (
            <p className="text-xs text-[var(--app-muted)]">
              No credentials in vault. Add one in Vault if your playbook needs secrets.
            </p>
          ) : (
            <div className="space-y-2">
              {vaultCredentials.map(cred => {
                const selected = selectedVaultIds.includes(cred.id);
                return (
                  <label
                    key={cred.id}
                    className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                      selected
                        ? 'border-[var(--app-blue)] bg-[rgba(59,130,246,0.08)]'
                        : 'border-[var(--app-line)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={e => {
                        setSelectedVaultIds(prev =>
                          e.target.checked
                            ? [...prev, cred.id]
                            : prev.filter(id => id !== cred.id),
                        );
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold">{cred.name}</span>
                      <span className="block text-xs text-[var(--app-muted)] font-mono">
                        {`{{${cred.template_key ?? 'vault_credential'}}} -> ${cred.masked_value}`}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <p className="mt-1 text-xs text-[var(--app-muted)]">
            Selected credentials are injected as variables (e.g. {'{{'}vault_google_admin{'}'}{'}'}). Runs fail if selected credentials are not referenced by the playbook.
          </p>
        </div>

        {/* Start */}
        <div className="flex justify-end">
          <button
            onClick={startRun}
            disabled={submitting}
            className="btn-primary inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? (
              <span className="animate-spin inline-flex"><CircleNotch size={15} /></span>
            ) : (
              <Play size={15} weight="fill" />
            )}
            {submitting ? 'Starting…' : 'Start run'}
          </button>
        </div>
      </div>
    </PlatformShell>
  );
}
