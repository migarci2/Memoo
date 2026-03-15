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
    <div className="min-h-[100dvh] bg-[var(--app-bg)] flex items-center justify-center px-4 py-12 text-[var(--app-text)]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center justify-center gap-2 text-sm font-extrabold tracking-tight">
            <span className="grid grid-cols-2 grid-rows-2 gap-[3px]">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--app-blue)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--app-sage)]" />
              <span className="col-span-2 h-2.5 rounded-full bg-[var(--app-sand)]" />
            </span>
            memoo
          </Link>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Enter the demo</h1>
          <p className="mt-1.5 text-sm text-[var(--app-muted)]">Access the demo account with your guest invite code.</p>
        </div>

        <div className="panel p-6">
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
            {loading ? <span className="animate-spin inline-flex"><CircleNotch size={16} /></span> : <Ticket size={16} weight="fill" />}
            {loading ? 'Entering…' : 'Enter the demo'}
          </button>

          <p className="mt-3 text-center text-[11px] text-[var(--app-muted)]">
            Demo Northline Operations
          </p>
        </div>

        <p className="mt-5 text-center text-sm text-[var(--app-muted)]">
          Invitation-only access for this demo.
          {' '}
          <Link href="/" className="font-semibold text-[var(--app-blue)] hover:underline">
            Back to home
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
