'use client';

import { CircleNotch } from '@phosphor-icons/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiPost } from '@/lib/api';
import { setSession } from '@/lib/auth';
import { slugify } from '@/lib/utils';

type BootstrapResponse = {
  team: { id: string; name: string; slug: string };
  owner: { id: string; full_name: string; email: string };
  next_step: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    team_name: '',
    team_slug: '',
    team_domain: '',
    owner_name: '',
    owner_email: '',
    owner_title: '',
    password: '',
    confirm_password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleTeamName(value: string) {
    setForm(prev => ({
      ...prev,
      team_name: value,
      team_slug: prev.team_slug === slugify(prev.team_name) ? slugify(value) : prev.team_slug,
    }));
  }

  async function submit() {
    if (!form.team_name || !form.team_slug || !form.owner_name || !form.owner_email || !form.password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost<BootstrapResponse>('/onboarding/team', {
        team_name: form.team_name,
        team_slug: form.team_slug.toLowerCase().trim(),
        team_domain: form.team_domain || null,
        owner_name: form.owner_name,
        owner_email: form.owner_email.toLowerCase().trim(),
        owner_title: form.owner_title || null,
        password: form.password,
      });
      // Auto-login: set session cookie directly
      setSession({
        team_id: data.team.id,
        team_slug: data.team.slug,
        team_name: data.team.name,
        user_id: data.owner.id,
        full_name: data.owner.full_name,
        role: 'owner',
      });
      router.push(`/team/${data.team.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create workspace.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--app-bg)] flex items-center justify-center px-4 py-12 text-[var(--app-text)]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center justify-center gap-2 text-sm font-extrabold tracking-tight">
            <span className="grid grid-cols-2 grid-rows-2 gap-[3px]">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--app-blue)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--app-sage)]" />
              <span className="col-span-2 h-2.5 rounded-full bg-[var(--app-sand)]" />
            </span>
            Memoo
          </Link>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Create your workspace</h1>
          <p className="mt-1.5 text-sm text-[var(--app-muted)]">Set up your team and start collaborating.</p>
        </div>

        <div className="panel p-6">
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              Team name
              <input
                className="input"
                value={form.team_name}
                onChange={e => handleTeamName(e.target.value)}
                placeholder="Northline Operations"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Team slug
              <input
                className="input"
                value={form.team_slug}
                onChange={e => setForm(prev => ({ ...prev, team_slug: e.target.value }))}
                placeholder="northline-ops"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Your name
              <input
                className="input"
                value={form.owner_name}
                onChange={e => setForm(prev => ({ ...prev, owner_name: e.target.value }))}
                placeholder="Amaya Voss"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Work email
              <input
                className="input"
                type="email"
                value={form.owner_email}
                onChange={e => setForm(prev => ({ ...prev, owner_email: e.target.value }))}
                placeholder="name@company.com"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Password
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="••••••••"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Confirm password
              <input
                className="input"
                type="password"
                value={form.confirm_password}
                onChange={e => setForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </label>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <button
            className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm"
            disabled={loading}
            onClick={submit}
            type="button"
          >
            {loading ? <span className="animate-spin inline-flex"><CircleNotch size={16} /></span> : null}
            {loading ? 'Creating…' : 'Create workspace'}
          </button>
        </div>

        <p className="mt-5 text-center text-sm text-[var(--app-muted)]">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[var(--app-blue)] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
