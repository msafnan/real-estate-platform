'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { API_URL } from '../lib/config';
import { AuthUser } from '../lib/types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean; // true until the initial silent-refresh completes
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Fetch with the in-memory access token; refreshes + retries once on 401. */
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error?.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Access token kept in memory only (never localStorage) to limit XSS exposure.
  const tokenRef = useRef<string | null>(null);

  const setSession = (accessToken: string, u: AuthUser | null) => {
    tokenRef.current = accessToken;
    if (u) setUser(u);
  };

  /** Ask the backend for a new access token using the httpOnly refresh cookie. */
  const refresh = useCallback(async (): Promise<boolean> => {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      tokenRef.current = null;
      return false;
    }
    const data = await res.json();
    tokenRef.current = data.accessToken;
    return true;
  }, []);

  // Silent refresh on first load (survives page reloads via the cookie).
  useEffect(() => {
    (async () => {
      const ok = await refresh();
      if (ok) {
        // Hydrate the user identity from the token-protected /me route.
        const me = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${tokenRef.current}` },
          credentials: 'include',
        });
        if (me.ok) setUser((await me.json()).user);
      }
      setLoading(false);
    })();
  }, [refresh]);

  const authFetch = useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response> => {
      const withAuth = (): RequestInit => ({
        ...init,
        credentials: 'include',
        headers: {
          ...(init.headers ?? {}),
          ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
        },
      });

      let res = await fetch(`${API_URL}${path}`, withAuth());
      if (res.status === 401 && (await refresh())) {
        res = await fetch(`${API_URL}${path}`, withAuth());
      }
      return res;
    },
    [refresh],
  );

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json();
    setSession(data.accessToken, data.user);
  }, []);

  const register = useCallback(async (email: string, name: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json();
    setSession(data.accessToken, data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    tokenRef.current = null;
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
