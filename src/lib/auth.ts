/**
 * Browser-side auth: the server owns the session (httpOnly cookie). This
 * module only asks who is signed in and starts/ends the login flow.
 */
import { useEffect, useState } from 'react';
import { UNAUTHORIZED_EVENT } from './api';

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, isLoading: true });

  useEffect(() => {
    let cancelled = false;
    fetch('/auth/me', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : { user: null }))
      .then(data => {
        if (!cancelled) setState({ user: data?.user ?? null, isLoading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ user: null, isLoading: false });
      });

    const onUnauthorized = () => setState({ user: null, isLoading: false });
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  return state;
}

export function loginWithRedirect(options: { redirectUrl?: string } = {}): void {
  const redirect = options.redirectUrl ?? window.location.href;
  window.location.assign(`/auth/login?redirect=${encodeURIComponent(redirect)}`);
}

export async function logout(): Promise<void> {
  try {
    await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    window.location.assign('/');
  }
}
