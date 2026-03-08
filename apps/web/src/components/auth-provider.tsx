'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { apiPost } from '@/lib/api';
import { clearSession, getSession, setSession, type SessionData } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthContextValue = {
  session: SessionData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (teamSlug: string, email: string, password: string) => Promise<void>;
  updateSession: (patch: Partial<SessionData>) => void;
  logout: () => void;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSessionState] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate from cookie on mount
  useEffect(() => {
    setSessionState(getSession());
    setIsLoading(false);
  }, []);

  const login = useCallback(async (teamSlug: string, email: string, password: string) => {
    const data = await apiPost<SessionData>('/auth/login', {
      team_slug: teamSlug.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password,
    });
    setSession(data);
    setSessionState(data);
  }, []);

  const updateSession = useCallback((patch: Partial<SessionData>) => {
    setSessionState(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      setSession(next);
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSessionState(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: session !== null,
        isLoading,
        login,
        updateSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
