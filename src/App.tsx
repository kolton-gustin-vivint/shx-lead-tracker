"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { recordLogin, getMyProfile, ApiClientError, GetMyProfileOutputType } from '@/lib/api';
import { Toaster } from '@project/components/ui/sonner';
import { ShieldAlert } from 'lucide-react';
import LeadsDashboard from './components/LeadsDashboard';
import { ProxyProvider } from './contexts/ProxyContext';
import { StatusOptionsProvider } from './contexts/StatusOptionsContext';
import { RepsProvider } from './contexts/RepsContext';
import { SessionProvider } from '@FO-Enablement-Vivint/magistrate/next';

type Profile = NonNullable<GetMyProfileOutputType['profile']>;

export default function App() {
  // Magistrate has already proved who this is. What is still unknown is
  // whether they are on the SHX Team roster — the server refuses anyone who
  // is not, so a 403 here is the roster rejecting them, not a failure.
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [deniedReason, setDeniedReason] = useState<string | null>(null);

  useEffect(() => {
    setProfileLoading(true);
    getMyProfile({})
      .then((res) => {
        if (res.found && res.profile) {
          setProfile(res.profile);
        } else {
          setProfile(null);
        }
        setProfileError(false);
      })
      .catch((err) => {
        if (err instanceof ApiClientError && err.status === 403) {
          setDeniedReason(err.message);
        } else {
          setProfileError(true);
        }
      })
      .finally(() => setProfileLoading(false));
  }, []);

  // Record a login once per browser session, not once per page load.
  // sessionStorage survives a refresh but is cleared when the tab or browser is
  // closed, so reopening the app counts and refreshing it does not. The flag is
  // set only after the call succeeds, so a failed attempt retries on next load.
  // (The server also ignores repeat logins within a few hours.)
  const loginStamped = useRef(false);
  useEffect(() => {
    if (profile && profile.role && !loginStamped.current) {
      loginStamped.current = true;
      const flag = `shx:login-recorded:${profile.email.toLowerCase()}`;
      try {
        if (sessionStorage.getItem(flag)) return;
      } catch {
        // Storage blocked: fall through and rely on the server-side window.
      }
      recordLogin({})
        .then(() => {
          try { sessionStorage.setItem(flag, '1'); } catch { /* ignore */ }
        })
        .catch(() => {});
    }
  }, [profile]);

  // Memoize the authenticatedUser object so child providers don't re-render
  // on every parent render. Must be called unconditionally (rules of hooks).
  const authenticatedUser = useMemo(() => {
    if (!profile || !profile.role) return null;
    return {
      id: profile.id,
      email: profile.email,
      proId: profile.id,
      proName: profile.proName,
      displayName: profile.displayName,
      role: profile.role,
    };
  }, [profile?.id, profile?.email, profile?.proName, profile?.displayName, profile?.role]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full border-2 border-border">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary border-t-transparent" />
          </div>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  // ── Profile fetch error ─────────────────────────────────────────────────
  if (profileError) {
    return (
      <>
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="text-center space-y-5 max-w-sm">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-destructive/10">
              <ShieldAlert className="h-7 w-7 text-destructive" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-foreground">Something went wrong</h2>
              <p className="text-sm text-muted-foreground mt-1">
                We couldn't load your team profile. Please try again or contact your manager.
              </p>
            </div>
          </div>
        </div>
        <Toaster />
      </>
    );
  }

  // ── Access control ───────────────────────────────────────────────────────
  // The server is the real gate; these screens explain its decision.
  const isNotInTeam = !authenticatedUser;
  const isInactive = profile?.status === 'Inactive';

  if (deniedReason || isNotInTeam || isInactive) {
    const message =
      deniedReason ??
      (isInactive
        ? 'Your account is marked as Inactive. Please contact your manager.'
        : 'Your email was not found in the SHX Team roster. Please contact your manager.');

    return (
      <>
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="text-center space-y-5 max-w-sm">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-destructive/10">
              <ShieldAlert className="h-7 w-7 text-destructive" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-foreground">Access Denied</h2>
              <p className="text-sm text-muted-foreground mt-1">{message}</p>
            </div>
          </div>
        </div>
        <Toaster />
      </>
    );
  }

  // ── Authenticated ────────────────────────────────────────────────────────
  return (
    <>
      <ProxyProvider user={authenticatedUser}>
        <RepsProvider autoLoad={authenticatedUser.role === 'Manager'}>
          <StatusOptionsProvider>
            <LeadsDashboard />
          </StatusOptionsProvider>
        </RepsProvider>
      </ProxyProvider>
      
      <Toaster />
    </>
  );
}
