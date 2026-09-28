import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, logout as doLogout } from '@/lib/auth';
import { recordLogin, getMyProfile, GetMyProfileOutputType } from '@/lib/api';
import { Toaster } from '@project/components/ui/sonner';
import { Button } from '@project/components/ui/button';
import { ShieldAlert, LogOut } from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import LeadsDashboard from './components/LeadsDashboard';
import { ProxyProvider } from './contexts/ProxyContext';
import { StatusOptionsProvider } from './contexts/StatusOptionsContext';
import { RepsProvider } from './contexts/RepsContext';

type Profile = NonNullable<GetMyProfileOutputType['profile']>;

export default function App() {
  const { user, isLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(false);

  // Fetch SHX Team profile once user is authenticated.
  // Depend on user?.id (not the whole object) so background token refreshes
  // don't re-trigger the fetch and flash the full-screen spinner.
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    // Only show full-screen loader on the very first fetch
    if (!profile) setProfileLoading(true);
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
  }, [user?.id]);

  // Stamp last-login once per session (fire-and-forget)
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
  if (isLoading || (user && profileLoading)) {
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

  // ── Not logged in ────────────────────────────────────────────────────────
  if (!user) {
    return (
      <>
        <LoginScreen />
        <Toaster />
      </>
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
            <Button variant="outline" size="sm" onClick={() => doLogout()}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
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
      ? 'Your account is marked as Inactive. Please contact your manager.'
      : 'Your email was not found in the SHX Team roster. Please contact your manager.';

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
            <Button variant="outline" size="sm" onClick={() => doLogout()}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
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
            <LeadsDashboard user={authenticatedUser} onLogout={() => doLogout()} />
          </StatusOptionsProvider>
        </RepsProvider>
      </ProxyProvider>
      <Toaster />
    </>
  );
}
