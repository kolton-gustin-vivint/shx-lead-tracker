import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The Airtable adapter, endpoint files and OpenAI helper are server-only and
  // must never be bundled into the browser build.
  serverExternalPackages: ['openai'],
  // The lead loaders read this at runtime (fs), so make sure it ships with the API route.
  outputFileTracingIncludes: {
    '/api/[name]': ['./server/data/zip-centroids.json'],
  },
  turbopack: {
    resolveAlias: {
      // @FO-Enablement-Vivint/magistrate >= 1.0.6 imports "next/navigation.js".
      // The explicit .js skips Next's server build of that module, so inside
      // an API route Turbopack loads the browser version and fails ("Could not
      // parse module … app-route/vendored/contexts/app-router-context.js").
      // Point it back at the normal entry so Next picks the right build.
      'next/navigation.js': 'next/navigation',
    },
  },
};

export default nextConfig;
