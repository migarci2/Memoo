import { PlatformShell } from '@/components/platform-shell';

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-[var(--app-chip)] ${className ?? ''}`} />
  );
}

export default function DashboardLoading() {
  return (
    <PlatformShell>
      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel-tight px-5 py-4">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>

      {/* Two-column grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="panel p-6">
          <Skeleton className="mb-4 h-5 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="panel p-5">
            <Skeleton className="mb-3 h-5 w-24" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </PlatformShell>
  );
}
