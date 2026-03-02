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

  // Form fields
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
    <PlatformShell teamId={teamId}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="landing-kicker">Security</p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Vault</h1>
          <p className="mt-1 max-w-[60ch] text-[var(--app-muted)]">
            Store credentials securely. Playbook runs reference them as
            &ldquo;Using X (secure)&rdquo; — values are never logged or exposed.
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          <Plus size={15} weight="bold" />
          Add credential
        </button>
      </div>

      {/* Add credential form */}
      {showForm && (
        <div className="panel max-w-2xl p-6 mb-6 space-y-4">
          <h2 className="text-lg font-bold">New credential</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--app-muted)]">Name</label>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Google Admin Service Account"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--app-muted)]">Service</label>
              <select
                className="input"
                value={service}
                onChange={e => setService(e.target.value)}
              >
                <option value="">Select service…</option>
                {SERVICE_PRESETS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--app-muted)]">Type</label>
              <select
                className="input"
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
              <label className="mb-1 block text-xs font-medium text-[var(--app-muted)]">Value</label>
              <input
                className="input"
                type="password"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={resetForm}
              className="rounded-full border border-[var(--app-line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--app-chip)]"
            >
              Cancel
            </button>
            <button
              onClick={addCredential}
              disabled={saving}
              className="btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? (
                <span className="animate-spin inline-flex"><CircleNotch size={14} /></span>
              ) : (
                <Lock size={14} weight="fill" />
              )}
              {saving ? 'Storing…' : 'Store securely'}
            </button>
          </div>
        </div>
      )}

      {/* Credentials list */}
      {loading ? (
        <div className="py-20 text-center text-[var(--app-muted)]">
          <span className="animate-spin inline-flex mb-2"><CircleNotch size={24} /></span>
          <p className="text-sm">Loading vault…</p>
        </div>
      ) : credentials.length === 0 ? (
        <div className="py-20 text-center text-[var(--app-muted)]">
          <Lock size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Vault is empty</p>
          <p className="mt-1 text-sm">Add credentials that playbook runs can reference securely.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {credentials.map(cred => (
            <div key={cred.id} className="panel-tight p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Lock size={16} weight="fill" className="text-[var(--app-blue)] shrink-0" />
                  <h3 className="font-semibold text-sm">{cred.name}</h3>
                </div>
                <button
                  onClick={() => deleteCredential(cred.id)}
                  disabled={deleting === cred.id}
                  className="shrink-0 text-[var(--app-muted)] hover:text-red-500 transition-colors disabled:opacity-40"
                >
                  {deleting === cred.id ? (
                    <span className="animate-spin inline-flex"><CircleNotch size={14} /></span>
                  ) : (
                    <Trash size={14} />
                  )}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-[var(--app-chip)] px-2 py-0.5 text-[11px] font-bold text-[var(--app-muted)]">
                  {cred.service}
                </span>
                <span className="rounded-full bg-[var(--app-chip)] px-2 py-0.5 text-[11px] font-bold text-[var(--app-muted)] capitalize">
                  {cred.credential_type.replace('_', ' ')}
                </span>
              </div>
              <p className="mt-2 font-mono text-xs text-[var(--app-muted)]">
                {cred.masked_value}
              </p>
              <p className="mt-1 text-[10px] text-[var(--app-muted)]">
                Added {new Date(cred.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </PlatformShell>
  );
}
