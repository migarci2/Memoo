'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiPost } from '@/lib/api';

type BootstrapResponse = {
  team: { id: string; name: string; slug: string };
  owner: { id: string; full_name: string; email: string };
  next_step: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    team_name: 'Northline Operations',
    team_slug: 'northline-ops',
    team_domain: 'northline.io',
    owner_name: 'Amaya Voss',
    owner_email: 'amaya@northline.io',
    owner_title: 'Head of Operations',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiPost<BootstrapResponse>('/onboarding/team', {
        ...form,
        team_slug: form.team_slug.toLowerCase().trim(),
        owner_email: form.owner_email.toLowerCase().trim(),
      });
      router.push(`/team/${data.team.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create workspace.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--app-bg)] px-3 py-3 text-[var(--app-text)] sm:px-5 sm:py-5">
      <header className="mx-auto grid w-full max-w-[1220px] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-full border border-[var(--app-line)] bg-[var(--app-surface)]/92 px-4 py-3 backdrop-blur">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-extrabold tracking-tight">
          <span className="grid grid-cols-2 grid-rows-2 gap-[3px]">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--app-blue)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--app-sage)]" />
            <span className="col-span-2 h-2.5 rounded-full bg-[var(--app-sand)]" />
          </span>
          Memoo
        </Link>
        <p className="hidden justify-self-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)] md:block">
          Create workspace
        </p>
        <Link
          href="/login"
          className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-2)] px-4 py-2 text-xs font-bold text-[var(--app-blue)]"
        >
          Log in
        </Link>
      </header>

      <main className="mx-auto mt-4 grid w-full max-w-[1220px] gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="panel relative overflow-hidden p-7 sm:p-10">
          <div className="pointer-events-none absolute -left-20 top-10 h-52 w-52 rounded-full bg-[var(--app-sage)]/18 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 right-10 h-56 w-56 rounded-full bg-[var(--app-blue)]/20 blur-3xl" />

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-blue)]">For operations teams</p>
          <h1 className="mt-3 max-w-[14ch] text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Build your automation workspace.
          </h1>
          <p className="mt-4 max-w-[50ch] text-base text-[var(--app-muted)]">
            Create your team account and start turning repeated browser tasks into governed, reusable playbooks.
          </p>

          <div className="mt-8 grid gap-3">
            <article className="panel-tight p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">Step 1</p>
              <p className="mt-1 font-semibold">Create team workspace</p>
              <p className="mt-1 text-sm text-[var(--app-muted)]">Set company, slug, and owner details in one flow.</p>
            </article>
            <article className="panel-tight p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">Step 2</p>
              <p className="mt-1 font-semibold">Capture your first process</p>
              <p className="mt-1 text-sm text-[var(--app-muted)]">Use teach mode to record and structure workflow steps.</p>
            </article>
            <article className="panel-tight p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">Step 3</p>
              <p className="mt-1 font-semibold">Run with governance</p>
              <p className="mt-1 text-sm text-[var(--app-muted)]">Track logs, evidence, versions, and team permissions.</p>
            </article>
          </div>
        </section>

        <section className="panel p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-blue)]">Create account</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Start your team dashboard</h2>
          <p className="mt-2 text-sm text-[var(--app-muted)]">We will create the workspace and take you directly into the product.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Team name
              <input
                className="input"
                value={form.team_name}
                onChange={e => setForm(prev => ({ ...prev, team_name: e.target.value }))}
                placeholder="Northline Operations"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Team slug
              <input
                className="input"
                value={form.team_slug}
                onChange={e => setForm(prev => ({ ...prev, team_slug: e.target.value }))}
                placeholder="northline-ops"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Team domain
              <input
                className="input"
                value={form.team_domain}
                onChange={e => setForm(prev => ({ ...prev, team_domain: e.target.value }))}
                placeholder="northline.io"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Your name
              <input
                className="input"
                value={form.owner_name}
                onChange={e => setForm(prev => ({ ...prev, owner_name: e.target.value }))}
                placeholder="Amaya Voss"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Work email
              <input
                className="input"
                type="email"
                value={form.owner_email}
                onChange={e => setForm(prev => ({ ...prev, owner_email: e.target.value }))}
                placeholder="name@company.com"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Job title
              <input
                className="input"
                value={form.owner_title}
                onChange={e => setForm(prev => ({ ...prev, owner_title: e.target.value }))}
                placeholder="Head of Operations"
              />
            </label>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button className="btn-primary w-full justify-center py-3 text-sm" disabled={loading} onClick={submit} type="button">
              {loading ? 'Creating account...' : 'Create account and open dashboard'}
            </button>
            <Link href="/login" className="btn-secondary w-full justify-center py-3 text-sm">
              Already have an account
            </Link>
          </div>

          <div className="mt-5 rounded-xl border border-[var(--app-line)] bg-[var(--app-surface-2)]/75 px-3 py-2 text-xs text-[var(--app-muted)]">
            After signup, you land directly in your team dashboard with starter data model ready.
          </div>
          <Link href="/login" className="mt-3 block text-center text-sm font-semibold text-[var(--app-blue)]">
            Prefer to log in instead
          </Link>
        </section>
      </main>
    </div>
  );
}
