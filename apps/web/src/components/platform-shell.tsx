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
  SignOut,
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
        <span className="h-2.5 w-2.5 rounded-full bg-[#1f5c84]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#1b8b82]" />
        <span className="col-span-2 h-2.5 rounded-full bg-[#d98a3f]" />
      </span>
      memoo
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
          ? 'border-[rgba(27,42,74,0.12)] bg-[rgba(27,42,74,0.06)] text-[var(--app-text)]'
          : 'border-transparent bg-transparent text-[var(--app-muted)] hover:border-[rgba(27,42,74,0.08)] hover:text-[var(--app-text)]',
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
    { label: 'Demo access', href: '/login', icon: ArrowSquareOut },
  ];

  const navItems = isPublicRoute ? publicNavItems : teamNavItems;
  const showAuthenticatedUi = isAuthenticated && !!session;
  const showPublicAuthCtas = isPublicRoute && !isAuthenticated;
  const displayName = teamName ?? session?.team_name ?? (resolvedTeamId ? `Team ${resolvedTeamId.slice(0, 6)}` : null);
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

      <div className="relative mx-auto grid w-[min(1440px,calc(100%-1.25rem))] gap-4 py-3 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-3 flex h-[calc(100dvh-1.5rem)] flex-col rounded-[14px] border border-[var(--app-line-soft)] bg-white p-4 shadow-[var(--app-shadow-soft)]">
            <div className="flex items-center justify-between">
              <div className="group/logo logo-wiggle cursor-pointer">
                <Logo />
              </div>
            </div>

            {showAuthenticatedUi ? (
              <div className="mt-5 rounded-xl border border-[var(--app-line-soft)] bg-[var(--app-surface-soft)] p-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--app-text)] text-[10px] font-bold text-white">
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

            <nav className="mt-5 space-y-1">
              {navItems.map(item => {
                const active = item.href === `/team/${resolvedTeamId}` ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                      active
                        ? 'bg-[rgba(27,42,74,0.05)] text-[var(--app-text)]'
                        : 'text-[var(--app-muted)] hover:bg-[rgba(27,42,74,0.03)] hover:text-[var(--app-text)]',
                    )}
                  >
                    <item.icon size={16} weight={active ? 'bold' : 'regular'} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto rounded-lg border border-[var(--app-line-soft)] bg-[var(--app-surface-soft)] p-1.5">
              {showAuthenticatedUi ? (
                <button
                  onClick={logout}
                  className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--app-muted)] transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <SignOut size={14} weight="bold" />
                  Sign out
                </button>
              ) : showPublicAuthCtas ? (
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-[16px] bg-[var(--app-text)] px-3 py-2.5 text-sm font-semibold text-white"
                >
                  Enter demo
                </Link>
              ) : (
                <div className="h-9" aria-hidden="true" />
              )}
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-30 pb-3">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-[var(--app-line-soft)] bg-[rgba(255,255,255,0.85)] px-4 py-2.5 shadow-[var(--app-shadow-soft)] backdrop-blur-xl">
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
                      <span className="hidden rounded-full border border-[var(--app-line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--app-muted)] sm:inline-block">
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
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(27,42,74,0.06)] text-xs font-bold text-[var(--app-text)] ring-1 ring-[rgba(27,42,74,0.08)] transition-colors hover:bg-[var(--app-text)] hover:text-white"
                      >
                        {initials}
                      </button>
                      <div
                        className={cn(
                          'absolute right-0 top-11 z-50 w-56 rounded-[20px] border border-[var(--app-line-soft)] bg-white p-2 shadow-[var(--app-shadow-panel)] backdrop-blur transition-all duration-150',
                          profileOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0',
                        )}
                        role="menu"
                      >
                        <div className="border-b border-[var(--app-line-soft)] pb-2 pl-2 pr-2 pt-1">
                          <p className="text-sm font-semibold">{session.full_name}</p>
                          <p className="text-xs text-[var(--app-muted)]">{session.role}</p>
                        </div>
                        {resolvedTeamId ? (
                          <Link
                            href={`/team/${resolvedTeamId}/settings`}
                            onClick={() => setProfileOpen(false)}
                            className="mt-1 flex w-full items-center gap-2 rounded-[14px] px-2 py-2 text-sm text-[var(--app-muted)] transition-colors hover:bg-[rgba(27,42,74,0.04)] hover:text-[var(--app-text)]"
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
                          className="mt-1 flex w-full items-center gap-2 rounded-[14px] px-2 py-2 text-sm text-[var(--app-muted)] transition-colors hover:bg-red-50 hover:text-red-600"
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
                    className="rounded-full bg-[var(--app-text)] px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
                  >
                    Enter demo
                  </Link>
                ) : (
                  <div className="h-8 w-8" aria-hidden="true" />
                )}

                <button
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--app-line-soft)] text-[var(--app-muted)] lg:hidden"
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
                  className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm"
                  onClick={() => setMobileOpen(false)}
                />
                <motion.aside
                  key="sheet"
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="fixed bottom-0 left-0 top-0 z-50 w-72 border-r border-[var(--app-line-soft)] bg-white p-6 shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <Logo />
                    <button
                      onClick={() => setMobileOpen(false)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--app-line-soft)] text-[var(--app-muted)]"
                      aria-label="Close menu"
                    >
                      <X size={14} weight="bold" />
                    </button>
                  </div>

                  {showAuthenticatedUi ? (
                    <div className="mt-5 rounded-[20px] border border-[var(--app-line-soft)] bg-[var(--app-surface-soft)] p-4">
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
                      className="mt-6 flex w-full items-center gap-2 rounded-[16px] border border-red-200/60 px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
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
              <div className="mb-6 rounded-xl border border-[var(--app-line-soft)] bg-white p-5 shadow-[var(--app-shadow-soft)]">
                {title ? (
                  <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
                ) : null}
                {subtitle ? (
                  <p className="mt-2 max-w-[76ch] text-sm text-[var(--app-muted)]">{subtitle}</p>
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
