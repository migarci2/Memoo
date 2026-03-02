'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type PlatformShellProps = {
  teamId?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function PlatformShell({ teamId, title, subtitle, children }: PlatformShellProps) {
  return (
    <div className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <header className="mx-auto mt-3 grid w-[min(1200px,calc(100%-1.5rem))] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-full border border-[var(--app-line)] bg-[var(--app-surface)]/90 px-4 py-3 backdrop-blur">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-extrabold tracking-tight">
          <span className="grid grid-cols-2 grid-rows-2 gap-[3px]">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--app-blue)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--app-sage)]" />
            <span className="col-span-2 h-2.5 rounded-full bg-[var(--app-sand)]" />
          </span>
          Memoo Platform
        </Link>

        <nav className="hidden justify-self-center md:flex md:items-center md:gap-4 md:text-sm md:text-[var(--app-muted)]">
          <Link href="/register">Register</Link>
          <Link href="/login">Log in</Link>
          {teamId ? <Link href={`/team/${teamId}`}>Dashboard</Link> : null}
          {teamId ? <Link href={`/team/${teamId}/capture`}>Capture</Link> : null}
          {teamId ? <Link href={`/team/${teamId}/playbooks/new`}>New Playbook</Link> : null}
        </nav>

        <div className="flex items-center gap-2 text-xs">
          {teamId ? <span className="rounded-full bg-[var(--app-chip)] px-3 py-1 font-semibold">Team {teamId.slice(0, 8)}</span> : null}
          <Link className="rounded-full bg-[var(--app-blue)] px-3 py-1.5 font-semibold text-[var(--app-surface)]" href="/register">
            Create Account
          </Link>
        </div>
      </header>

      <main className="mx-auto w-[min(1200px,calc(100%-1.5rem))] py-10">
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">{title}</h1>
          {subtitle ? <p className="mt-3 max-w-[70ch] text-[var(--app-muted)]">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
