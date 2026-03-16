'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CircleNotch, Lock, Plus, Trash } from '@phosphor-icons/react';

import { PlatformShell } from '@/components/platform-shell';
import { useToast } from '@/components/toast-provider';
import { apiDelete, apiGet, apiPost } from '@/lib/api';
import type { VaultCredential } from '@/lib/types';

const CREDENTIAL_TYPES = ['password', 'api_key', 'oauth_token', 'ssh_key', 'certificate'];
const SERVICE_PRESETS = ['Google Workspace', 'Microsoft 365', 'Salesforce', 'Slack', 'AWS', 'GitHub', 'Jira', 'Custom'];

export default function VaultPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { toast } = useToast();

  const [credentials, setCredentials] = useState<VaultCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [service, setService] = useState('');
  const [credType, setCredType] = useState('password');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchVault = () => {
    apiGet<VaultCredential[]>(`/teams/${teamId}/vault`)
      .then(setCredentials)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(fetchVault, [teamId]);

  const resetForm = () => {
    setName('');
    setService('');
    setCredType('password');
    setValue('');
    setShowForm(false);
  };

  const addCredential = async () => {
    if (!name.trim() || !service.trim() || !value.trim()) {
      toast('Fill in all fields', 'error');
      return;
    }
    setSaving(true);
    try {
      const cred = await apiPost<VaultCredential>(`/teams/${teamId}/vault`, {
        name: name.trim(),
        service: service.trim(),
        credential_type: credType,
        value: value.trim(),
      });
      setCredentials(prev => [cred, ...prev]);
      resetForm();
      toast('Credential stored securely', 'success');
    } catch {
      toast('Failed to store credential', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteCredential = async (id: string) => {
    setDeleting(id);
    try {
      await apiDelete(`/vault/${id}`);
      setCredentials(prev => prev.filter(c => c.id !== id));
      toast('Credential removed', 'success');
    } catch {
      toast('Failed to delete credential', 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <PlatformShell 
      teamId={teamId}
      title="Vault"
      subtitle="Store credentials securely. Use template keys in playbooks (e.g. {{vault_key}}) so runs can inject them."
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
              <Plus size={16} weight="bold" />
              Add Credential
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="mb-8 overflow-hidden relative rounded-2xl border border-[var(--app-line)] bg-[var(--app-bg-muted)] shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="absolute top-0 left-0 h-1 w-full bg-[var(--app-blue)] opacity-20" />
          <div className="p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold">
              <span className="text-[var(--app-muted)]"><Lock size={20} /></span>
              Store New Credential
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Credential Name</label>
                  <input
                    className="input w-full bg-white"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g., Production AWS Key"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Service</label>
                  <select
                    className="input w-full bg-white"
                    value={service}
                    onChange={e => setService(e.target.value)}
                  >
                    <option value="">Select service…</option>
                    {SERVICE_PRESETS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Credential Type</label>
                  <select
                    className="input w-full bg-white"
                    value={credType}
                    onChange={e => setCredType(e.target.value)}
                  >
                    {CREDENTIAL_TYPES.map(t => (
                      <option key={t} value={t}>
                        {t.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Secret Value</label>
                  <input
                    className="input w-full bg-white font-mono text-sm"
                    type="password"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder="••••••••••••••••"
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end gap-3 border-t border-[var(--app-line-soft)] pt-4">
              <button
                onClick={resetForm}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--app-muted)] transition-colors hover:bg-[rgba(27,42,74,0.05)]"
              >
                Cancel
              </button>
              <button
                onClick={addCredential}
                disabled={saving}
                className="btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2 text-sm font-bold shadow-sm disabled:opacity-60"
              >
                {saving ? (
                  <span className="inline-flex animate-spin"><CircleNotch size={16} /></span>
                ) : (
                  <Lock size={16} weight="fill" />
                )}
                {saving ? 'Encrypting…' : 'Save securely'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-[var(--app-muted)]">
          <div className="flex justify-center mb-2 animate-spin">
            <CircleNotch size={24} />
          </div>
          <p className="text-sm">Loading vault…</p>
        </div>
      ) : credentials.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--app-line)] bg-[var(--app-bg-muted)] px-6 py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--app-bg)] shadow-sm">
            <span className="text-[var(--app-muted)] opacity-50"><Lock size={28} /></span>
          </div>
          <p className="mb-1 text-lg font-bold text-[var(--app-text)]">Your vault is empty</p>
          <p className="max-w-sm text-sm text-[var(--app-muted)]">
            Store sensitive credentials here to safely reference them in your automated playbooks.
          </p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-6 rounded-lg border border-[var(--app-line)] bg-white px-4 py-2 text-sm font-bold shadow-sm transition-colors hover:bg-[var(--app-bg-hover)]"
            >
              Add your first credential
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {credentials.map(cred => (
            <div key={cred.id} className="group flex flex-col rounded-2xl border border-[var(--app-line)] bg-white p-5 shadow-sm transition-all hover:border-[var(--app-blue)] hover:shadow-md">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <h3 className="truncate text-[15px] font-bold">{cred.name}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded bg-[var(--app-bg-muted)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]">
                      {cred.service}
                    </span>
                    <span className="rounded bg-[var(--app-bg-muted)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]">
                      {cred.credential_type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => deleteCredential(cred.id)}
                  disabled={deleting === cred.id}
                  className="shrink-0 rounded-full p-1.5 text-[var(--app-muted-soft)] opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-40"
                  title="Remove credential"
                >
                  {deleting === cred.id ? (
                    <span className="inline-flex animate-spin"><CircleNotch size={14} /></span>
                  ) : (
                    <Trash size={16} />
                  )}
                </button>
              </div>
              
              <div className="mt-auto">
                <div className="mb-1.5 text-[11px] font-medium text-[var(--app-muted)]">Template Reference</div>
                <div className="flex items-center gap-2 rounded-lg border border-[rgba(10,21,38,0.06)] bg-[rgba(10,21,38,0.03)] p-2">
                  <span className="shrink-0 text-[var(--app-muted)]"><Lock size={14} weight="fill" /></span>
                  <code className="truncate font-mono text-xs font-bold text-[var(--app-brand-sand)]">
                    {`{{`}{cred.template_key || 'vault_credential'}{`}}`}
                  </code>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PlatformShell>
  );
}
