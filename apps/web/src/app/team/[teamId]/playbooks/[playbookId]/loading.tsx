import { PlatformShell } from '@/components/platform-shell';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[var(--app-chip)] ${className ?? ''}`} />;
}

export default function PlaybookDetailLoading() {
  return (
    <PlatformShell>
      {/* Breadcrumb skeleton */}
      <div className="mb-6 flex gap-2">
        <Skeleton className="h-4 w-20" />
        <span className="text-[var(--app-muted)]">/</span>
        <Skeleton className="h-4 w-24" />
        <span className="text-[var(--app-muted)]">/</span>
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Header panel */}
      <div className="panel p-6 sm:p-8">
        <Skeleton className="mb-3 h-9 w-64" />
        <Skeleton className="mb-4 h-4 w-80" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--app-line)] pt-5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-1.5 h-3 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Steps table */}
      <div className="panel mt-6 overflow-hidden p-0">
        <div className="border-b border-[var(--app-line)] bg-[var(--app-surface-2)]/60 px-4 py-3">
          <Skeleton className="h-4 w-32" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-t border-[var(--app-line)] px-4 py-3.5 first:border-t-0">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-6 rounded" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </PlatformShell>
  );
}
