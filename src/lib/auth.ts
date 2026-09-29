/**
 * Browser-side auth: the server owns the session (httpOnly cookie). This
 * module only asks who is signed in and starts/ends the login flow.
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiClientError, UNAUTHORIZED_EVENT } from './api';

export type AuthMode = 'email' | 'oidc';

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  /** Which sign-in UI to show. Defaults to "email" until /auth/me answers. */
  mode: AuthMode;
  /** Re-ask the server who is signed in (used after loginWithEmail). */
  refresh: () => Promise<void>;
}

async function fetchMe(): Promise<{ user: AuthUser | null; mode: AuthMode }> {
  const res = await fetch('/auth/me', { credentials: 'same-origin' });
  if (!res.ok) return { user: null, mode: 'email' };
  const data = await res.json();
  return { user: data?.user ?? null, mode: data?.mode === 'oidc' ? 'oidc' : 'email' };
}

export function useAuth(): AuthState {
  const [state, setState] = useState<{ user: AuthUser | null; isLoading: boolean; mode: AuthMode }>({
    user: null,
    isLoading: true,
    mode: 'email',
  });

  const refresh = useCallback(async () => {
    try {
      const { user, mode } = await fetchMe();
      setState({ user, mode, isLoading: false });
    } catch {
      setState(s => ({ ...s, user: null, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then(({ user, mode }) => {
        if (!cancelled) setState({ user, mode, isLoading: false });
      })
      .catch(() => {
        if (!cancelled) setState(s => ({ ...s, user: null, isLoading: false }));
      });

    const onUnauthorized = () => setState(s => ({ ...s, user: null, isLoading: false }));
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  return { ...state, refresh };
}

/**
 * Email mode: check the address against the SHX Team roster and start a
 * session. Resolves on success; throws ApiClientError with the server's
 * message (not in roster, inactive, throttled) otherwise.
 */
export async function loginWithEmail(email: string): Promise<AuthUser> {
  const res = await fetch('/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(res.status, body?.error?.code ?? 'LOGIN_FAILED', body?.error?.message ?? 'Sign-in failed. Please try again.');
  }
  return body.user as AuthUser;
}

/** OIDC mode: send the browser to the identity provider. */
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
