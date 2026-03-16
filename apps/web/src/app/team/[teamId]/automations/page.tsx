'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lightning, Play, Trash, CircleNotch , Clock, Link, CaretDown, CaretRight, Code} from '@phosphor-icons/react';

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
  const [showInputJson, setShowInputJson] = useState(false);
  const [showForm, setShowForm] = useState(false);

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
      setShowForm(false);
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
    <PlatformShell 
      teamId={teamId}
      title="Automations"
      subtitle="Schedule playbooks or trigger them via webhooks."
    >

      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setShowForm(v => !v)}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--app-blue)] focus:ring-offset-2 ${
            showForm
              ? 'bg-[var(--app-bg-muted)] text-[var(--app-text)] hover:bg-[var(--app-line-soft)]'
              : 'btn-primary'
          }`}
        >
          {showForm ? 'Cancel' : (
            <>
              <Lightning size={16} weight="fill" />
              Create Automation
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="panel mb-8 p-6 animate-in fade-in slide-in-from-top-4 duration-300 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 w-full bg-[var(--app-brand-sand)] opacity-40" />
          <h2 className="mb-6 flex items-center gap-2 text-lg font-bold">
            <span className="text-[var(--app-brand-sand)]"><Lightning size={20} weight="fill" /></span>
            New Automation
          </h2>
          
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Name</label>
                <input
                  className="input w-full bg-white"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Daily Onboarding Sync"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">Playbook</label>
                <select className="input w-full bg-white" value={playbookId} onChange={e => setPlaybookId(e.target.value)}>
                  <option value="">Select a playbook…</option>
                  {playbooks.map(pb => (
                    <option key={pb.id} value={pb.id}>{pb.name}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-[var(--app-line)] bg-[var(--app-bg-muted)] p-4">
                <label className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <span className="text-[var(--app-muted)]"><Clock size={16}/></span> 
                  Trigger Configuration
                </label>
                <div className="flex gap-2 p-1 bg-[rgba(27,42,74,0.04)] rounded-lg mb-4">
                  {(['interval', 'webhook'] as const).map(kind => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setTriggerType(kind)}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                        triggerType === kind
                          ? 'bg-white text-[var(--app-text)] shadow-sm'
                          : 'text-[var(--app-muted)] hover:bg-[rgba(27,42,74,0.06)]'
                      }`}
                    >
                      {kind === 'interval' ? 'Interval Schedule' : 'Webhook Endpoint'}
                    </button>
                  ))}
                </div>

                {triggerType === 'interval' && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--app-muted)]">Run every (minutes)</label>
                    <input
                      className="input w-full bg-white text-sm"
                      type="number"
                      min={1}
                      max={10080}
                      value={intervalMinutes}
                      onChange={e => setIntervalMinutes(Number(e.target.value || 60))}
                    />
                  </div>
                )}
                {triggerType === 'webhook' && (
                  <p className="text-xs text-[var(--app-muted)] leading-relaxed">
                    A unique secure webhook URL will be generated after creation. Send a POST request to this URL to immediately trigger the playbook.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <span className="text-[var(--app-muted)]"><Code size={16}/></span> 
                    Input Data (JSON Array)
                  </label>
                </div>
                <textarea
                  className="input w-full bg-[rgba(10,21,38,0.02)] border-[var(--app-line)] min-h-[140px] font-mono text-xs focus:bg-white"
                  value={inputRowsJson}
                  onChange={e => setInputRowsJson(e.target.value)}
                  placeholder="[{}]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">Vault Credentials</label>
                {vaultCredentials.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--app-line-soft)] p-4 text-center">
                    <p className="text-xs text-[var(--app-muted)]">No credentials in vault.</p>
                  </div>
                ) : (
                  <div className="max-h-[160px] overflow-y-auto rounded-xl border border-[var(--app-line)] bg-white divide-y divide-[var(--app-line-soft)]">
                    {vaultCredentials.map(cred => {
                      const selected = selectedVaultIds.includes(cred.id);
                      return (
                        <label
                          key={cred.id}
                          className={`flex items-start gap-3 p-3 transition-colors hover:bg-[var(--app-bg-muted)] cursor-pointer ${
                            selected ? 'bg-[rgba(59,130,246,0.04)]' : ''
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
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <span className="block text-sm font-semibold">{cred.name}</span>
                            <span className="block text-xs text-[var(--app-muted)] font-mono truncate">
                              {'{{'}{cred.template_key ?? 'vault_credential'}{'}'}{'}'}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-[var(--app-muted)] leading-relaxed">
                  Selected credentials inject as {'{{'}vault_*{'}'}{'}'} variables.
                </p>
              </div>

              <div className="pt-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--app-line)] bg-[var(--app-bg-muted)] p-3 transition-colors hover:bg-[rgba(27,42,74,0.03)]">
                  <input
                    type="checkbox"
                    checked={useSandbox}
                    onChange={e => setUseSandbox(e.target.checked)}
                  />
                  <span className="text-sm font-semibold text-[var(--app-text)]">
                    Use visible sandbox browser
                    <span className="mt-0.5 block text-xs font-normal text-[var(--app-muted)]">Watch the automation run securely in Real-Time</span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-[var(--app-line-soft)] pt-4">
             <button
                onClick={() => setShowForm(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--app-muted)] transition-colors hover:bg-[rgba(27,42,74,0.05)]"
              >
                Cancel
              </button>
              <button
                onClick={createAutomation}
                disabled={saving}
                className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-2 text-sm font-bold shadow-sm disabled:opacity-60 md:w-auto"
              >
                {saving ? <span className="inline-flex animate-spin"><CircleNotch size={16} /></span> : <Lightning size={16} weight="fill" />}
                {saving ? 'Creating…' : 'Create Automation'}
              </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[var(--app-line-soft)] py-20 text-center text-[var(--app-muted)]">
            <span className="mx-auto mb-2 inline-flex animate-spin"><CircleNotch size={24} /></span>
            <p className="text-sm">Loading automations…</p>
          </div>
        ) : automations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--app-line)] bg-[var(--app-bg-muted)] px-6 py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--app-bg)] shadow-sm">
              <span className="text-[var(--app-muted)] opacity-50"><Lightning size={28} /></span>
            </div>
            <p className="mb-1 text-lg font-bold text-[var(--app-text)]">No automations yet</p>
            <p className="max-w-sm text-sm text-[var(--app-muted)]">
              Create an automation to schedule playbooks or trigger them via API webhooks.
            </p>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-6 rounded-lg border border-[var(--app-line)] bg-white px-4 py-2 text-sm font-bold shadow-sm transition-colors hover:bg-[var(--app-bg-hover)]"
              >
                Create your first automation
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {automations.map(auto => (
              <div key={auto.id} className="group flex flex-col rounded-2xl border border-[var(--app-line)] bg-white p-5 shadow-sm transition-all hover:border-[var(--app-blue)] hover:shadow-md">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-[15px] font-bold leading-tight">{auto.name || 'Untitled Automation'}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-[var(--app-muted)]">
                      <span className="inline-flex items-center gap-1 rounded bg-[var(--app-bg-muted)] px-2 py-0.5 font-medium text-[var(--app-brand-sand)]">
                         {auto.trigger_type === 'interval' ? <span className="shrink-0"><Clock size={12}/></span> : <span className="shrink-0"><Link size={12} /></span>}
                         {auto.trigger_type === 'interval' ? `Every ${auto.interval_minutes ?? 60}m` : 'Webhook'}
                      </span>
                      <span>&middot;</span>
                      <span className="font-medium capitalize">{auto.use_sandbox ? 'Sandbox' : 'Headless'}</span>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                    auto.enabled
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-[var(--app-line)] bg-[var(--app-bg-muted)] text-[var(--app-muted)]'
                  }`}>
                    {auto.enabled ? 'Enabled' : 'Paused'}
                  </span>
                </div>

                <div className="mt-2 flex-grow space-y-1.5 rounded-xl border border-[rgba(10,21,38,0.06)] bg-[rgba(10,21,38,0.02)] p-3 text-[11px] text-[var(--app-muted)]">
                  {auto.next_run_at && <p className="flex justify-between"><span>Next run:</span> <span className="font-medium text-[var(--app-text)]">{new Date(auto.next_run_at).toLocaleString()}</span></p>}
                  {auto.last_run_at && <p className="flex justify-between"><span>Last run:</span> <span>{new Date(auto.last_run_at).toLocaleString()}</span></p>}
                  {auto.last_error && <p className="mt-1 line-clamp-2 font-medium text-red-500" title={auto.last_error}>Error: {auto.last_error}</p>}
                  {auto.trigger_type === 'webhook' && auto.webhook_token && (
                    <div className="mt-2 border-t border-[rgba(10,21,38,0.06)] pt-2">
                       <span className="mb-1 block text-[10px] font-semibold tracking-wider uppercase text-[var(--app-brand-sand)]">Webhook URL</span>
                       <code className="block w-full truncate rounded border border-[var(--app-line)] bg-white p-1.5 text-[10px] text-[var(--app-text)]" title={`${webhookBase}/api/automations/webhook/${auto.webhook_token}`}>
                         {webhookBase}/api/automations/webhook/{auto.webhook_token}
                       </code>
                    </div>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[var(--app-line-soft)] pt-4">
                  <button
                    onClick={() => toggleAutomation(auto)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border border-[var(--app-line)] px-2 py-1.5 text-[11px] font-bold transition-colors ${
                       auto.enabled ? 'hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700' : 'hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    {auto.enabled ? 'Pause' : 'Enable'}
                  </button>
                  <button
                    onClick={() => runNow(auto)}
                    disabled={runningId === auto.id}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--app-line)] px-2 py-1.5 text-[11px] font-bold text-[var(--app-brand-blue)] transition-colors hover:bg-[rgba(59,130,246,0.05)] disabled:opacity-50"
                  >
                    {runningId === auto.id ? (
                      <>
                        <span className="inline-flex animate-spin"><CircleNotch size={12} /></span>
                        Running
                      </>
                    ) : (
                      <>
                         <Play size={12} weight="fill" /> 
                         Run Now
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => removeAutomation(auto)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2 py-1.5 text-[11px] font-bold text-red-600 transition-colors hover:bg-red-100"
                  >
                    <Trash size={12} weight="bold"/>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PlatformShell>
  );
}
