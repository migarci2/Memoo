'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiPost } from '@/lib/api';

type LoginResponse = {
  team_id: string;
  team_slug: string;
  team_name: string;
  user_id: string;
  full_name: string;
  role: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    team_slug: 'northline-ops',
    email: 'amaya@northline.io',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiPost<LoginResponse>('/auth/login', {
        team_slug: form.team_slug.toLowerCase().trim(),
        email: form.email.toLowerCase().trim(),
      });
      router.push(`/team/${data.team_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--app-bg)] px-3 py-3 text-[var(--app-text)] sm:px-5 sm:py-5">
      <header className="mx-auto grid w-full max-w-[1200px] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-full border border-[var(--app-line)] bg-[var(--app-surface)]/92 px-4 py-3 backdrop-blur">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-extrabold tracking-tight">
          <span className="grid grid-cols-2 grid-rows-2 gap-[3px]">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--app-blue)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--app-sage)]" />
            <span className="col-span-2 h-2.5 rounded-full bg-[var(--app-sand)]" />
          </span>
          Memoo
        </Link>
        <p className="hidden justify-self-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)] md:block">
          Team workspace access
        </p>
        <Link
          href="/register"
          className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-2)] px-4 py-2 text-xs font-bold text-[var(--app-blue)]"
        >
          Create account
        </Link>
      </header>

      <main className="mx-auto mt-4 grid w-full max-w-[1200px] gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="panel relative overflow-hidden p-7 sm:p-10">
          <div className="pointer-events-none absolute -right-14 -top-14 h-56 w-56 rounded-full bg-[var(--app-blue)]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-16 h-52 w-52 rounded-full bg-[var(--app-sand)]/20 blur-3xl" />

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-blue)]">Welcome back</p>
          <h1 className="mt-3 max-w-[16ch] text-4xl font-extrabold tracking-tight md:text-6xl">Run operations with confidence.</h1>
          <p className="mt-4 max-w-[52ch] text-base text-[var(--app-muted)]">
            Access your team dashboard to manage playbooks, review execution evidence, and track automation reliability.
          </p>

          <div className="mt-8 space-y-3">
            <div className="panel-tight flex items-start gap-3 p-4">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--app-sage)]" />
              <div>
                <p className="font-semibold">Capture sessions and playbooks in one place</p>
                <p className="text-sm text-[var(--app-muted)]">Teach once, standardize process logic, and share internally.</p>
              </div>
            </div>
            <div className="panel-tight flex items-start gap-3 p-4">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--app-blue)]" />
              <div>
                <p className="font-semibold">Execution history with evidence</p>
                <p className="text-sm text-[var(--app-muted)]">Every run is traceable with logs, outcomes, and audit context.</p>
              </div>
            </div>
            <div className="panel-tight flex items-start gap-3 p-4">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--app-sand)]" />
              <div>
                <p className="font-semibold">Team governance by default</p>
                <p className="text-sm text-[var(--app-muted)]">Roles, versions, and workspace-level collaboration controls.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="panel p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-blue)]">Log in</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Access your dashboard</h2>
          <p className="mt-2 text-sm text-[var(--app-muted)]">Use your team slug and work email to continue.</p>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Team slug
              <input
                className="input"
                value={form.team_slug}
                onChange={e => setForm(prev => ({ ...prev, team_slug: e.target.value }))}
                placeholder="northline-ops"
              />
              <span className="text-xs text-[var(--app-muted)]">Unique workspace identifier.</span>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Work email
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="name@company.com"
              />
              <span className="text-xs text-[var(--app-muted)]">Must be a member of this workspace.</span>
            </label>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <div className="mt-6 grid gap-3">
            <button className="btn-primary w-full justify-center py-3 text-sm" disabled={loading} onClick={submit} type="button">
              {loading ? 'Signing in...' : 'Log in to dashboard'}
            </button>
            <Link href="/register" className="btn-secondary w-full justify-center py-3 text-sm">
              Create account
            </Link>
          </div>

          <p className="mt-5 text-center text-xs text-[var(--app-muted)]">
            New team? Create a workspace and start from your first playbook.
          </p>
          <Link href="/register" className="mt-2 block text-center text-sm font-semibold text-[var(--app-blue)]">
            Go to register
          </Link>
        </section>
      </main>
    </div>
  );
}
