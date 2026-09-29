'use client';

/**
 * Client entry point for the dashboard. Everything below this is the same
 * React app that ran under Vite; this file supplies the providers that used
 * to live in main.tsx.
 */
import { useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Unknown error';
}

function RuntimeErrorFallback({ error }: { error: unknown }) {
  return (
    <div className="fixed inset-0 grid place-items-center p-4">
      <div className="relative w-full max-w-xl rounded border-t-4 border-t-destructive bg-card p-4 shadow-lg">
        <h3 className="mb-2 flex items-center gap-2 font-medium">Issue rendering app</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Something went wrong while loading this app. You can try reloading the page.
        </p>
        <pre className="overflow-auto rounded border-l-4 border-destructive bg-destructive/10 p-4 font-mono text-sm">
          {messageOf(error)}
        </pre>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded border border-border bg-muted px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted/80"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppRoot() {
  // One client per browser session; created lazily so it is not shared
  // between requests on the server.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ErrorBoundary fallbackRender={({ error }) => <RuntimeErrorFallback error={error} />}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
