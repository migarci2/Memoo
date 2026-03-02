'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  BookBookmark,
  House,
  List,
  Lock,
  Play,
  SignIn,
  SignOut,
  UserPlus,
  X,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { useAuth } from '@/components/auth-provider';
import { cn } from '@/lib/utils';

type PlatformShellProps = {
  teamId?: string;
  teamName?: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

type NavItem = {
  label: string;
  href: string;
  icon: React.FC<{ size?: number; weight?: 'bold' | 'regular' | 'fill' }>;
};

function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 text-sm font-extrabold tracking-tight">
      <span className="grid grid-cols-2 grid-rows-2 gap-[3px]">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--app-blue)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--app-sage)]" />
        <span className="col-span-2 h-2.5 rounded-full bg-[var(--app-sand)]" />
      </span>
      Memoo
    </Link>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: NavItem & { active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150',
        active
          ? 'bg-[var(--app-blue)] text-white'
          : 'text-white/80 hover:bg-[var(--app-chip)] hover:text-white',
      )}
    >
      <Icon size={15} weight="bold" />
      {label}
    </Link>
  );
}

export function PlatformShell({ teamId, teamName, title, subtitle, children }: PlatformShellProps) {
  const { session, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const teamNavItems: NavItem[] = teamId
    ? [
        { label: 'Dashboard', href: `/team/${teamId}`, icon: House },
        { label: 'Playbooks', href: `/team/${teamId}/playbooks`, icon: BookBookmark },
        { label: 'Runs', href: `/team/${teamId}/runs`, icon: Play },
        { label: 'Vault', href: `/team/${teamId}/vault`, icon: Lock },
      ]
    : [];

  const publicNavItems: NavItem[] = [
    { label: 'Log in', href: '/login', icon: SignIn },
    { label: 'Register', href: '/register', icon: UserPlus },
  ];

  const navItems = isAuthenticated && teamId ? teamNavItems : publicNavItems;
  const displayName = teamName ?? (teamId ? `Team ${teamId.slice(0, 6)}` : null);

  return (
    <div className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 px-3 pt-3">
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-full border border-[var(--app-line)] bg-[var(--app-surface)]/92 px-4 py-2.5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] backdrop-blur">
          <Logo />

          {/* Desktop nav */}
          <nav className="hidden justify-self-center md:flex md:items-center md:gap-1">
            {navItems.map(item => (
              <NavLink
                key={item.href}
                {...item}
                active={
                  item.href === `/team/${teamId}`
                    ? pathname === item.href
                    : pathname.startsWith(item.href)
                }
              />
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isAuthenticated && session ? (
              <>
                {displayName ? (
                  <span className="hidden rounded-full bg-[var(--app-chip)] px-3 py-1 text-xs font-semibold text-[var(--app-blue)] sm:inline-block">
                    {displayName}
                  </span>
                ) : null}
                <div className="group relative">
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-blue)]/15 text-xs font-bold text-[var(--app-blue)] ring-1 ring-[var(--app-blue)]/20 transition-colors hover:bg-[var(--app-blue)] hover:text-white">
                    {session.full_name
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </button>
                  <div className="pointer-events-none absolute right-0 top-10 z-50 w-52 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface)]/98 p-2 opacity-0 shadow-lg backdrop-blur transition-all duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                    <div className="border-b border-[var(--app-line)] pb-2 pl-2 pr-2 pt-1">
                      <p className="text-sm font-semibold">{session.full_name}</p>
                      <p className="text-xs text-[var(--app-muted)]">{session.role}</p>
                    </div>
                    <button
                      onClick={logout}
                      className="mt-1 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-[var(--app-muted)] transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <SignOut size={14} weight="bold" />
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-full bg-[var(--app-blue)] px-3 py-1.5 text-xs font-bold text-[var(--app-surface)] transition-opacity hover:opacity-90"
              >
                Log in
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--app-line)] text-[var(--app-muted)] md:hidden"
              aria-label="Open menu"
            >
              <List size={16} weight="bold" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile slide-in nav ────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              key="sheet"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 top-0 z-50 w-72 bg-[var(--app-surface)] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <Logo />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--app-line)] text-[var(--app-muted)]"
                  aria-label="Close menu"
                >
                  <X size={14} weight="bold" />
                </button>
              </div>

              {isAuthenticated && session ? (
                <div className="mt-5 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-2)] p-3">
                  <p className="font-semibold">{session.full_name}</p>
                  <p className="text-xs text-[var(--app-muted)]">{session.role}</p>
                </div>
              ) : null}

              <nav className="mt-5 flex flex-col gap-1">
                {navItems.map(item => (
                  <NavLink
                    key={item.href}
                    {...item}
                    active={
                      item.href === `/team/${teamId}`
                        ? pathname === item.href
                        : pathname.startsWith(item.href)
                    }
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
              </nav>

              {isAuthenticated ? (
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    logout();
                  }}
                  className="mt-6 flex w-full items-center gap-2 rounded-xl border border-red-200/60 px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <SignOut size={14} weight="bold" />
                  Sign out
                </button>
              ) : null}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="mx-auto w-[min(1200px,calc(100%-1.5rem))] py-8">
        {(title ?? subtitle) ? (
          <div className="mb-8">
            {title ? (
              <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
            ) : null}
            {subtitle ? (
              <p className="mt-2.5 max-w-[70ch] text-[var(--app-muted)]">{subtitle}</p>
            ) : null}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
