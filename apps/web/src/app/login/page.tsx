'use client';

import { CircleNotch } from '@phosphor-icons/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { useAuth } from '@/components/auth-provider';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [form, setForm] = useState({ team_slug: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.team_slug.trim() || !form.email.trim() || !form.password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(form.team_slug, form.email, form.password);
      const redirect = searchParams.get('redirect');
      const { getSession } = await import('@/lib/auth');
      const session = getSession();
      router.push(redirect ?? `/team/${session?.team_id ?? ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
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
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Welcome back</h1>
          <p className="mt-1.5 text-sm text-[var(--app-muted)]">Sign in with your team slug and work email.</p>
        </div>

        <div className="panel p-6">
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              Team slug
              <input
                className="input"
                value={form.team_slug}
                onChange={e => setForm(prev => ({ ...prev, team_slug: e.target.value }))}
                placeholder="northline-ops"
                autoComplete="off"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Work email
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
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
            {loading ? 'Signing in…' : 'Log in'}
          </button>
        </div>

        <p className="mt-5 text-center text-sm text-[var(--app-muted)]">
          No account?{' '}
          <Link href="/register" className="font-semibold text-[var(--app-blue)] hover:underline">
            Create workspace
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
