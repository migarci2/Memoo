// ---------------------------------------------------------------------------
// Cookie-based session helper (client-safe, no sensitive secrets)
// ---------------------------------------------------------------------------
import Cookies from 'js-cookie';

export type SessionData = {
  team_id: string;
  team_slug: string;
  team_name: string;
  user_id: string;
  full_name: string;
  role: string;
};

const COOKIE_KEY = 'memoo_session';
const COOKIE_OPTS: Cookies.CookieAttributes = {
  expires: 7, // days
  sameSite: 'Lax',
  path: '/',
};

export function setSession(data: SessionData): void {
  Cookies.set(COOKIE_KEY, JSON.stringify(data), COOKIE_OPTS);
}

export function getSession(): SessionData | null {
  try {
    const raw = Cookies.get(COOKIE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  Cookies.remove(COOKIE_KEY, { path: '/' });
}
