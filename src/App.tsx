"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { recordLogin, getMyProfile, GetMyProfileOutputType } from '@/lib/api';
import { Toaster } from '@project/components/ui/sonner';
import { ShieldAlert } from 'lucide-react';
import LeadsDashboard from './components/LeadsDashboard';
import { ProxyProvider } from './contexts/ProxyContext';
import { StatusOptionsProvider } from './contexts/StatusOptionsContext';
import { RepsProvider } from './contexts/RepsContext';
import { SessionProvider } from '@FO-Enablement-Vivint/magistrate/next';

type Profile = NonNullable<GetMyProfileOutputType['profile']>;

export default function App() {
  // There is no sign-in. The server decides which SHX Team member every
  // request acts as (see server/lib/session.ts); getMyProfile reports who
  // that turned out to be, along with their role.
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

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
      .catch(() => {
        setProfileError(true);
      })
      .finally(() => setProfileLoading(false));
  }, []);

  // Stamp last-login once per page load (fire-and-forget)
  const loginStamped = useRef(false);
  useEffect(() => {
    if (profile && profile.role && !loginStamped.current) {
      loginStamped.current = true;
      recordLogin({}).catch(() => {});
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
                We couldn't load the team profile. Check that APP_USER_EMAIL and the Airtable
                credentials are set, then reload.
              </p>
            </div>
          </div>
        </div>
        <Toaster />
      </>
    );
  }

  // ── Access control ───────────────────────────────────────────────────────
  const isNotInTeam = !authenticatedUser;
  const isInactive = profile?.status === 'Inactive';

  if (isNotInTeam || isInactive) {
    const message = isInactive
      ? 'This account is marked as Inactive in the SHX Team table.'
      : 'APP_USER_EMAIL does not match any row in the SHX Team table. Check the server configuration.';

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
            <LeadsDashboard user={authenticatedUser} />
          </StatusOptionsProvider>
        </RepsProvider>
      </ProxyProvider>
      
      <Toaster />
    </>
  );
}
