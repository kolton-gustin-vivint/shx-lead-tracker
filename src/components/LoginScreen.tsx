import { loginWithRedirect } from '@/lib/auth';
import { Button } from '@project/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@project/components/ui/card';
import { LogIn, Building2 } from 'lucide-react';
import { useState } from 'react';

export default function LoginScreen() {
  const [imageError, setImageError] = useState(false);

  const handleLogin = () => {
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
            <Button onClick={handleLogin} className="w-full h-11 text-base font-medium" size="lg">
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          </CardContent>
        </Card>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Having trouble? Contact your team administrator.
        </p>
      </div>
    </div>
  );
}
