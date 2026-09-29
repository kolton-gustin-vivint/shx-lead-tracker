import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The Airtable adapter, endpoint files and OpenAI helper are server-only and
  // must never be bundled into the browser build.
  serverExternalPackages: ['openai'],
};

export default nextConfig;
