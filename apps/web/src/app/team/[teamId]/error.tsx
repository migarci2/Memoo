'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { WarningCircle } from '@phosphor-icons/react';

import { PlatformShell } from '@/components/platform-shell';

export default function TeamError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[TeamError]', error);
  }, [error]);

  const router = useRouter();

  return (
    <PlatformShell>
      <div className="panel flex flex-col items-center justify-center px-6 py-20 text-center">
        <span className="mb-4 text-[var(--app-muted)] inline-flex">
          <WarningCircle size={48} weight="regular" />
        </span>
        <h1 className="text-2xl font-extrabold">Something went wrong</h1>
        <p className="mt-2 max-w-sm text-[var(--app-muted)]">
          {error.message ?? 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={reset}
            className="btn-primary rounded-full px-5 py-2.5 text-sm font-semibold"
          >
            Try again
          </button>
          <button
            onClick={() => router.back()}
            className="btn-secondary rounded-full px-5 py-2.5 text-sm"
          >
            Go back
          </button>
        </div>
      </div>
    </PlatformShell>
  );
}
