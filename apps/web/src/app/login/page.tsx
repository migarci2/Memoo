'use client';

import { CircleNotch, Ticket } from '@phosphor-icons/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { DEMO_CREDENTIALS, DEMO_INVITE_CODE } from '@/lib/demo-access';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doLogin(creds: { team_slug: string; email: string; password: string }) {
    await login(creds.team_slug, creds.email, creds.password);
    const redirect = searchParams.get('redirect');
    const { getSession } = await import('@/lib/auth');
    const session = getSession();
    router.push(redirect ?? `/team/${session?.team_id ?? ''}`);
  }

  async function submit() {
    if (!inviteCode.trim()) {
      setError('Enter the guest invite code.');
      return;
    }
    if (inviteCode.trim() !== DEMO_INVITE_CODE) {
      setError('Invalid guest invite code.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await doLogin(DEMO_CREDENTIALS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enter the demo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--app-bg)] px-4 py-12 text-[var(--app-text)]">
      <div className="mx-auto grid min-h-[calc(100dvh-6rem)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden lg:block">
          <div className="rounded-[28px] border border-[var(--app-line-soft)] bg-white p-10">
            <p className="page-eyebrow">Guest workspace</p>
            <h1 className="mt-4 text-6xl font-black tracking-tight text-[var(--app-text)]">
              Enter memoo the warm way.
            </h1>
            <p className="mt-5 max-w-[36ch] text-lg leading-relaxed text-[var(--app-muted)]">
              Access the demo environment to explore playbooks, live runs, and the calmer visual system behind the platform.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[20px] border border-[var(--app-line-soft)] bg-[var(--app-surface-soft)] p-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--app-muted)]">Capture</p>
                <p className="mt-2 text-sm font-semibold">Teach once and structure the workflow.</p>
              </div>
              <div className="rounded-[20px] border border-[var(--app-line-soft)] bg-[var(--app-surface-soft)] p-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--app-muted)]">Run</p>
                <p className="mt-2 text-sm font-semibold">Watch each execution in the live sandbox.</p>
              </div>
              <div className="rounded-[20px] border border-[var(--app-line-soft)] bg-[var(--app-surface-soft)] p-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--app-muted)]">Share</p>
                <p className="mt-2 text-sm font-semibold">Reuse playbooks across your team.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md justify-self-center">
          <div className="mb-8 text-center">
            <Link href="/" className="inline-flex items-center justify-center gap-2 text-sm font-extrabold tracking-tight">
              <span className="grid grid-cols-2 grid-rows-2 gap-[3px]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#1f5c84]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#1b8b82]" />
                <span className="col-span-2 h-2.5 rounded-full bg-[#d98a3f]" />
              </span>
              memoo
            </Link>
            <p className="page-eyebrow mt-6">Invitation only</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Enter the demo</h1>
            <p className="mt-2 text-sm text-[var(--app-muted)]">Access the demo account with your guest invite code.</p>
          </div>

          <div className="rounded-[28px] border border-[var(--app-line-strong)] bg-white p-7">
            <div className="grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium">
                Guest invite code
                <input
                  className="input"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  placeholder="CODE HERE"
                  autoComplete="off"
                  onKeyDown={e => e.key === 'Enter' && submit()}
                />
              </label>
            </div>

            {error ? (
              <p className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            <button
              className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm"
              disabled={loading}
              onClick={submit}
              type="button"
            >
              {loading ? <span className="animate-spin inline-flex"><CircleNotch size={16} /></span> : <Ticket size={16} weight="fill" />}
              {loading ? 'Entering…' : 'Enter the demo'}
            </button>

            <p className="mt-4 text-center text-[11px] text-[var(--app-muted)]">
              Demo Northline Operations
            </p>
          </div>

          <p className="mt-5 text-center text-sm text-[var(--app-muted)]">
            Invitation-only access for this demo.
            {' '}
            <Link href="/" className="font-semibold text-[var(--app-text)] hover:underline">
              Back to home
            </Link>
          </p>
        </div>
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
