import { useState, type FormEvent } from 'react';
import { loginWithEmail, loginWithRedirect, type AuthMode } from '@/lib/auth';
import { Button } from '@project/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@project/components/ui/card';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { LogIn, Building2, Loader2, AlertCircle } from 'lucide-react';

interface LoginScreenProps {
  /** "email" shows the roster email form; "oidc" shows a single Sign In button. */
  mode?: AuthMode;
  /** Called after a successful email sign-in so the app can reload the session. */
  onSignedIn?: () => void | Promise<void>;
}

export default function LoginScreen({ mode = 'email', onSignedIn }: LoginScreenProps) {
  const [imageError, setImageError] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) {
      setError('Enter your work email address.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await loginWithEmail(value);
      await onSignedIn?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedirectLogin = () => {
    loginWithRedirect({ redirectUrl: window.location.href });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Subtle background decoration */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 20%, hsl(var(--primary) / 0.06) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, hsl(var(--primary) / 0.04) 0%, transparent 50%)
          `,
        }}
      />
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative w-full max-w-md">
        <Card className="shadow-premium-lg border border-border">
          {/* Green accent top bar */}
          <div className="h-1 w-full rounded-t-[calc(var(--radius)-1px)] bg-primary" />

          <CardHeader className="text-center pt-8 pb-4 px-8">
            <div className="mx-auto mb-5 flex items-center justify-center">
              {!imageError ? (
                <img
                  src="https://images.fillout.com/orgid-437101/flowpublicid-qiwrempa9p/widgetid-default/owKHhW1n4uhUbawjWp4g6t/pasted-image-1757524861485.jpeg"
                  alt="SHX Logo"
                  className="h-20 w-auto object-contain rounded-lg"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="h-20 w-20 flex items-center justify-center rounded-2xl bg-primary/10">
                  <Building2 className="h-10 w-10 text-primary" />
                </div>
              )}
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">SHX Leads Tracker</CardTitle>
            <CardDescription className="mt-2 text-sm leading-relaxed">
              Sign in to access your leads dashboard.{' '}
              <span className="whitespace-nowrap">Only authorized team members</span> can access this system.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-8">
            {mode === 'oidc' ? (
              <Button onClick={handleRedirectLogin} className="w-full h-11 text-base font-medium" size="lg">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            ) : (
              <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
                <div className="space-y-2 text-left">
                  <Label htmlFor="login-email">Work email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@vivint.com"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    disabled={submitting}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? 'login-error' : undefined}
                    className="h-11"
                  />
                </div>

                {error && (
                  <div
                    id="login-error"
                    role="alert"
                    className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" className="w-full h-11 text-base font-medium" size="lg" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                  {submitting ? 'Checking roster…' : 'Sign In'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Having trouble? Contact your team administrator.
        </p>
      </div>
    </div>
  );
}
