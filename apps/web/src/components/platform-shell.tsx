'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowSquareOut,
  BookBookmark,
  GearSix,
  House,
  Lightning,
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
import { useEffect, useRef, useState, type ReactNode } from 'react';

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
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-150',
        active
          ? 'border-[var(--app-blue)]/20 bg-[var(--app-chip)] text-[var(--app-blue)]'
          : 'border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-muted)] hover:border-[var(--app-blue)]/25 hover:text-[var(--app-blue)]',
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
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [profileOpen]);

  const pathnameTeamMatch = pathname.match(/^\/team\/([^/]+)/);
  const teamIdFromPath = pathnameTeamMatch?.[1];
  const resolvedTeamId = teamId ?? teamIdFromPath ?? session?.team_id;
  const isPublicRoute = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/register');

  const teamNavItems: NavItem[] = resolvedTeamId
    ? [
        { label: 'Dashboard', href: `/team/${resolvedTeamId}`, icon: House },
        { label: 'Playbooks', href: `/team/${resolvedTeamId}/playbooks`, icon: BookBookmark },
        { label: 'Runs', href: `/team/${resolvedTeamId}/runs`, icon: Play },
        { label: 'Automations', href: `/team/${resolvedTeamId}/automations`, icon: Lightning },
        { label: 'Vault', href: `/team/${resolvedTeamId}/vault`, icon: Lock },
        { label: 'Settings', href: `/team/${resolvedTeamId}/settings`, icon: GearSix },
      ]
    : [];

  const publicNavItems: NavItem[] = [
    { label: 'Log in', href: '/login', icon: SignIn },
    { label: 'Register', href: '/register', icon: UserPlus },
  ];

  const navItems = isPublicRoute ? publicNavItems : teamNavItems;
  const showAuthenticatedUi = isAuthenticated && !!session;
  const showPublicAuthCtas = isPublicRoute && !isAuthenticated;
  const displayName = teamName ?? (resolvedTeamId ? `Team ${resolvedTeamId.slice(0, 6)}` : null);
  const initials = session
    ? session.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'ME';

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:linear-gradient(to_right,rgba(17,33,48,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(17,33,48,0.07)_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative mx-auto grid w-[min(1400px,calc(100%-1.25rem))] gap-4 py-3 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-3 flex h-[calc(100dvh-1.5rem)] flex-col rounded-3xl border border-[var(--app-line)] bg-[linear-gradient(180deg,rgba(248,252,255,0.98),rgba(241,247,252,0.9))] p-4 shadow-[0_18px_40px_rgba(15,33,52,0.12)]">
            <div className="flex items-center justify-between">
              <div className="group/logo logo-wiggle cursor-pointer">
                <Logo />
              </div>
              <Link
                href="/"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--app-line)] bg-white/70 text-[var(--app-muted)] transition-colors hover:border-[var(--app-blue)]/35 hover:text-[var(--app-blue)]"
                title="Back to Landing"
              >
                <ArrowSquareOut size={14} weight="bold" />
              </Link>
            </div>

            {showAuthenticatedUi ? (
              <div className="mt-6 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface)]/88 p-3 shadow-inner">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-blue)] text-xs font-bold text-white shadow-sm ring-2 ring-white/50">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{session.full_name}</p>
                    <p className="truncate text-xs text-[var(--app-muted)]">{session.role}</p>
                  </div>
                </div>
                {displayName ? (
                  <p className="mt-2 truncate text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                    {displayName}
                  </p>
                ) : null}
              </div>
            ) : null}

            <nav className="mt-6 space-y-2">
              {navItems.map(item => {
                const active = item.href === `/team/${resolvedTeamId}` ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-all',
                      active
                        ? 'border-[var(--app-blue)]/20 bg-[var(--app-chip)] text-[var(--app-blue)]'
                        : 'border-transparent bg-transparent text-[var(--app-muted)] hover:border-[var(--app-line)] hover:bg-white/70 hover:text-[var(--app-blue)]',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                        active ? 'bg-[var(--app-blue)]/16' : 'bg-[var(--app-chip)] group-hover:bg-[var(--app-blue)]/15',
                      )}
                    >
                      <item.icon size={15} weight="bold" />
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto rounded-2xl border border-[var(--app-line)] bg-white/75 p-2">
              {showAuthenticatedUi ? (
                <button
                  onClick={logout}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[var(--app-muted)] transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <SignOut size={14} weight="bold" />
                  Sign out
                </button>
              ) : showPublicAuthCtas ? (
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--app-blue)] px-3 py-2 text-sm font-semibold text-white"
                >
                  Log in
                </Link>
              ) : (
                <div className="h-9" aria-hidden="true" />
              )}
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-30 pb-3">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface)]/90 px-4 py-2.5 shadow-[0_10px_24px_rgba(15,33,52,0.08)] backdrop-blur">
              <div className="lg:hidden">
                <Logo />
              </div>

              <nav className="hidden justify-self-center md:flex md:items-center md:gap-1 lg:hidden">
                {navItems.map(item => (
                  <NavLink
                    key={item.href}
                    {...item}
                    active={
                      item.href === `/team/${resolvedTeamId}`
                        ? pathname === item.href
                        : pathname.startsWith(item.href)
                    }
                  />
                ))}
              </nav>

              <div className="flex items-center justify-end gap-2">
                {showAuthenticatedUi ? (
                  <>
                    {displayName ? (
                      <span className="hidden rounded-full border border-[var(--app-line)] bg-white/70 px-3 py-1 text-xs font-semibold text-[var(--app-muted)] sm:inline-block">
                        {displayName}
                      </span>
                    ) : null}
                    <div ref={profileRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setProfileOpen(open => !open)}
                        aria-expanded={profileOpen}
                        aria-haspopup="menu"
                        aria-label="Open profile menu"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-blue)]/15 text-xs font-bold text-[var(--app-blue)] ring-1 ring-[var(--app-blue)]/20 transition-colors hover:bg-[var(--app-blue)] hover:text-white"
                      >
                        {initials}
                      </button>
                      <div
                        className={cn(
                          'absolute right-0 top-10 z-50 w-52 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface)] p-2 shadow-lg backdrop-blur transition-all duration-150',
                          profileOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0',
                        )}
                        role="menu"
                      >
                        <div className="border-b border-[var(--app-line)] pb-2 pl-2 pr-2 pt-1">
                          <p className="text-sm font-semibold">{session.full_name}</p>
                          <p className="text-xs text-[var(--app-muted)]">{session.role}</p>
                        </div>
                        {resolvedTeamId ? (
                          <Link
                            href={`/team/${resolvedTeamId}/settings`}
                            onClick={() => setProfileOpen(false)}
                            className="mt-1 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-[var(--app-muted)] transition-colors hover:bg-[var(--app-chip)] hover:text-[var(--app-blue)]"
                          >
                            <GearSix size={14} weight="bold" />
                            Profile settings
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen(false);
                            logout();
                          }}
                          className="mt-1 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-[var(--app-muted)] transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <SignOut size={14} weight="bold" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  </>
                ) : showPublicAuthCtas ? (
                  <Link
                    href="/login"
                    className="rounded-full bg-[var(--app-blue)] px-3 py-1.5 text-xs font-bold text-[var(--app-surface)] transition-opacity hover:opacity-90"
                  >
                    Log in
                  </Link>
                ) : (
                  <div className="h-8 w-8" aria-hidden="true" />
                )}

                <button
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--app-line)] text-[var(--app-muted)] lg:hidden"
                  aria-label="Open menu"
                >
                  <List size={16} weight="bold" />
                </button>
              </div>
            </div>
          </header>

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

                  {showAuthenticatedUi ? (
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
                          item.href === `/team/${resolvedTeamId}`
                            ? pathname === item.href
                            : pathname.startsWith(item.href)
                        }
                        onClick={() => setMobileOpen(false)}
                      />
                    ))}
                  </nav>

                  {showAuthenticatedUi ? (
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

          <main className="px-1 pb-4 pt-1 md:px-2">
            {(title ?? subtitle) ? (
              <div className="mb-8 rounded-3xl border border-[var(--app-line)] bg-[linear-gradient(130deg,rgba(248,252,255,0.96),rgba(241,247,252,0.9))] p-5 shadow-[0_10px_26px_rgba(15,33,52,0.08)] md:p-7">
                {title ? (
                  <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
                ) : null}
                {subtitle ? (
                  <p className="mt-2 max-w-[76ch] text-sm text-[var(--app-muted)] md:text-base">{subtitle}</p>
                ) : null}
              </div>
            ) : null}
            {children}
          </main>
        </section>
      </div>
    </div>
  );
}
