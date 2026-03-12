'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lightning, Play, Trash, CircleNotch } from '@phosphor-icons/react';

import { PlatformShell } from '@/components/platform-shell';
import { useToast } from '@/components/toast-provider';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { getApiPublicBaseUrl } from '@/lib/config';
import type {
  Playbook,
  PlaybookAutomation,
  PlaybookAutomationCreateInput,
  Run,
  VaultCredential,
} from '@/lib/types';

export default function AutomationsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [vaultCredentials, setVaultCredentials] = useState<VaultCredential[]>([]);
  const [automations, setAutomations] = useState<PlaybookAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [playbookId, setPlaybookId] = useState('');
  const [triggerType, setTriggerType] = useState<'interval' | 'webhook'>('interval');
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [useSandbox, setUseSandbox] = useState(true);
  const [selectedVaultIds, setSelectedVaultIds] = useState<string[]>([]);
  const [inputRowsJson, setInputRowsJson] = useState('[{}]');

  const webhookBase = useMemo(() => getApiPublicBaseUrl().replace(/\/$/, ''), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pbList, autoList, vaultList] = await Promise.all([
        apiGet<Playbook[]>(`/teams/${teamId}/playbooks`),
        apiGet<PlaybookAutomation[]>(`/teams/${teamId}/automations`),
        apiGet<VaultCredential[]>(`/teams/${teamId}/vault`),
      ]);
      setPlaybooks(pbList);
      setAutomations(autoList);
      setVaultCredentials(vaultList);
      if (!playbookId && pbList.length > 0) {
        setPlaybookId(pbList[0].id);
      }
    } catch {
      toast('Failed to load automations', 'error');
    } finally {
      setLoading(false);
    }
  }, [playbookId, teamId, toast]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const parseInputRows = (): Record<string, unknown>[] => {
    const parsed = JSON.parse(inputRowsJson);
    if (!Array.isArray(parsed)) throw new Error('Input rows must be a JSON array.');
    if (parsed.some(row => typeof row !== 'object' || row === null || Array.isArray(row))) {
      throw new Error('Each input row must be a JSON object.');
    }
    return parsed as Record<string, unknown>[];
  };

  const createAutomation = async () => {
    if (!playbookId) {
      toast('Select a playbook first', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: PlaybookAutomationCreateInput = {
        playbook_id: playbookId,
        name: name.trim() || 'Untitled automation',
        trigger_type: triggerType,
        interval_minutes: intervalMinutes,
        input_rows: parseInputRows(),
        input_source: 'automation_ui',
        selected_vault_credential_ids: selectedVaultIds,
        use_sandbox: useSandbox,
        enabled: true,
      };
      await apiPost<PlaybookAutomation>(`/teams/${teamId}/automations`, payload);
      toast('Automation created', 'success');
      setName('');
      setSelectedVaultIds([]);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create automation', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleAutomation = async (auto: PlaybookAutomation) => {
    try {
      const updated = await apiPatch<PlaybookAutomation>(`/automations/${auto.id}`, {
        enabled: !auto.enabled,
      });
      setAutomations(prev => prev.map(item => (item.id === auto.id ? updated : item)));
      toast(updated.enabled ? 'Automation enabled' : 'Automation paused', 'success');
    } catch {
      toast('Failed to update automation', 'error');
    }
  };

  const runNow = async (auto: PlaybookAutomation) => {
    setRunningId(auto.id);
    try {
      const run = await apiPost<Run>(`/automations/${auto.id}/run`, {});
      toast('Run started', 'success');
      router.push(`/team/${teamId}/runs/${run.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to start run', 'error');
    } finally {
      setRunningId(null);
    }
  };

  const removeAutomation = async (auto: PlaybookAutomation) => {
    try {
      await apiDelete(`/automations/${auto.id}`);
      setAutomations(prev => prev.filter(item => item.id !== auto.id));
      toast('Automation deleted', 'success');
    } catch {
      toast('Failed to delete automation', 'error');
    }
  };

  return (
    <PlatformShell teamId={teamId}>
      <div className="mb-6">
        <p className="landing-kicker">Automations</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Playbook automations</h1>
        <p className="mt-2 max-w-[70ch] text-[var(--app-muted)]">
          Trigger playbooks automatically on schedule or webhook, with optional live sandbox execution.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="panel p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--app-muted)]">New automation</h2>

          <div>
            <label className="mb-1 block text-sm font-semibold">Name</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Daily onboarding sync"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Playbook</label>
            <select className="input" value={playbookId} onChange={e => setPlaybookId(e.target.value)}>
              <option value="">Select a playbook…</option>
              {playbooks.map(pb => (
                <option key={pb.id} value={pb.id}>{pb.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Trigger</label>
            <div className="flex gap-2">
              {(['interval', 'webhook'] as const).map(kind => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setTriggerType(kind)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                    triggerType === kind
                      ? 'bg-[var(--app-fg)] text-[var(--app-bg)]'
                      : 'bg-[var(--app-chip)] text-[var(--app-muted)] hover:bg-[var(--app-line)]'
                  }`}
                >
                  {kind}
                </button>
              ))}
            </div>
          </div>

          {triggerType === 'interval' && (
            <div>
              <label className="mb-1 block text-sm font-semibold">Every (minutes)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={10080}
                value={intervalMinutes}
                onChange={e => setIntervalMinutes(Number(e.target.value || 60))}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold">Input rows JSON</label>
            <textarea
              className="input min-h-[120px] font-mono text-xs"
              value={inputRowsJson}
              onChange={e => setInputRowsJson(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Vault credentials</label>
            {vaultCredentials.length === 0 ? (
              <p className="text-xs text-[var(--app-muted)]">
                No credentials in vault.
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
                            e.target.checked ? [...prev, cred.id] : prev.filter(id => id !== cred.id),
                          );
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold">{cred.name}</span>
                        <span className="block text-xs text-[var(--app-muted)] font-mono">
                          {'{{'}{cred.template_key ?? 'vault_credential'}{'}'}{'}'}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="mt-1 text-xs text-[var(--app-muted)]">
              Selected credentials are injected as {'{{'}vault_*{'}'}{'}'} variables. Runs fail if none of them are referenced by the playbook.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={useSandbox}
              onChange={e => setUseSandbox(e.target.checked)}
            />
            Use sandbox (visible browser)
          </label>

          <button
            onClick={createAutomation}
            disabled={saving}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? <span className="inline-flex animate-spin"><CircleNotch size={16} /></span> : <Lightning size={16} weight="fill" />}
            {saving ? 'Creating…' : 'Create automation'}
          </button>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="panel py-20 text-center text-[var(--app-muted)]">
              <span className="mx-auto mb-2 inline-flex animate-spin"><CircleNotch size={24} /></span>
              <p className="text-sm">Loading automations…</p>
            </div>
          ) : automations.length === 0 ? (
            <div className="panel py-20 text-center text-[var(--app-muted)]">
              <span className="mx-auto mb-3 inline-flex opacity-35"><Lightning size={34} /></span>
              <p className="font-semibold">No automations yet</p>
              <p className="mt-1 text-sm">Create one to run playbooks automatically.</p>
            </div>
          ) : (
            automations.map(auto => (
              <div key={auto.id} className="panel-tight p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">{auto.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--app-muted)]">
                      {auto.trigger_type === 'interval'
                        ? `Every ${auto.interval_minutes ?? 60} minute(s)`
                        : 'Triggered by webhook'}
                      {' · '}
                      {auto.use_sandbox ? 'sandbox' : 'headless'}
                      {' · '}
                      {auto.selected_vault_credential_ids.length} vault credential(s)
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    auto.enabled
                      ? 'bg-[rgba(123,155,134,0.18)] text-[#335443]'
                      : 'bg-[rgba(95,119,132,0.18)] text-[#3f5e6f]'
                  }`}>
                    {auto.enabled ? 'enabled' : 'paused'}
                  </span>
                </div>

                <div className="mt-2 text-xs text-[var(--app-muted)] space-y-1">
                  {auto.next_run_at && <p>Next run: {new Date(auto.next_run_at).toLocaleString()}</p>}
                  {auto.last_run_at && <p>Last run: {new Date(auto.last_run_at).toLocaleString()}</p>}
                  {auto.last_error && <p className="text-[#8b3a3a]">Last error: {auto.last_error}</p>}
                  {auto.trigger_type === 'webhook' && auto.webhook_token && (
                    <p className="font-mono break-all text-[11px]">
                      {webhookBase}/automations/webhook/{auto.webhook_token}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleAutomation(auto)}
                    className="rounded-full border border-[var(--app-line)] px-3 py-1 text-xs font-semibold hover:bg-[var(--app-chip)]"
                  >
                    {auto.enabled ? 'Pause' : 'Enable'}
                  </button>
                  <button
                    onClick={() => runNow(auto)}
                    disabled={runningId === auto.id}
                    className="rounded-full border border-[var(--app-line)] px-3 py-1 text-xs font-semibold hover:bg-[var(--app-chip)] disabled:opacity-60"
                  >
                    {runningId === auto.id ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-flex animate-spin"><CircleNotch size={12} /></span>
                        Running…
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1"><Play size={12} weight="fill" /> Run now</span>
                    )}
                  </button>
                  <button
                    onClick={() => removeAutomation(auto)}
                    className="rounded-full border border-[rgba(191,100,100,0.35)] px-3 py-1 text-xs font-semibold text-[#8b3a3a] hover:bg-[rgba(191,100,100,0.08)]"
                  >
                    <span className="inline-flex items-center gap-1"><Trash size={12} /> Delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PlatformShell>
  );
}
