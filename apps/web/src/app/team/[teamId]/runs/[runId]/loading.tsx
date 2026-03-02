import { PlatformShell } from '@/components/platform-shell';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[var(--app-chip)] ${className ?? ''}`} />;
}

export default function RunDetailLoading() {
  return (
    <PlatformShell>
      <div className="mb-6 flex gap-2">
        <Skeleton className="h-4 w-20" />
        <span className="text-[var(--app-muted)]">/</span>
        <Skeleton className="h-4 w-12" />
        <span className="text-[var(--app-muted)]">/</span>
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="panel mb-6 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="mt-3 h-8 w-40" />
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--app-line)] pt-5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-1.5 h-3 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-5 h-2 w-full rounded-full" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </PlatformShell>
  );
}
