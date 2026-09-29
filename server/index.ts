/** Long-lived server for local development or a VM/container. Vercel uses api/index.ts instead. */
import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from './lib/env';
import { createApp } from './app';
import { endpoints } from './api';

const app = createApp();

// Production: serve the built SPA from the same port.
const distDir = resolve('dist');
if (env.isProd && existsSync(distDir)) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.get('/{*splat}', (_req, res) => res.sendFile(resolve(distDir, 'index.html')));
}

app.listen(env.port, () => {
  console.log(`API listening on ${env.publicUrl} (auth: ${env.authMode}, ${Object.keys(endpoints).length} endpoints)`);
});
