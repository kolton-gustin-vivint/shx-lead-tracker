/**
 * The Express application, without a listener. Used by:
 *   server/index.ts — long-lived local/VM server (also serves dist/ in production)
 *   api/index.ts    — Vercel serverless function
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { ZodError } from 'zod';
import { env } from './lib/env.js';
import { authRouter } from './lib/auth.js';
import { getSession } from './lib/session.js';
import { handleUpload } from './lib/upload.js';
import { ApiError, HTTP_STATUS_FOR_CODE, type AnyEndpoint, type RequestUser } from './lib/endpoint.js';
import { AirtableError } from './lib/airtable.js';
import { endpoints } from './api/index.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ── Auth ───────────────────────────────────────────────────────────────────
  app.use('/auth', authRouter);

  // ── Uploaded attachments (public; ids are unguessable) ─────────────────────
  app.use('/uploads', express.static(resolve(env.uploadDir), { immutable: true, maxAge: '365d', index: false }));

  function requireUser(req: Request): RequestUser {
    const s = getSession(req);
    if (!s) throw new ApiError({ code: 'UNAUTHORIZED', message: 'Not signed in' });
    return { id: s.sub, email: s.email, name: s.name, roles: [] };
  }

  app.post(
    '/api/upload',
    (req, _res, next) => {
      try {
        requireUser(req);
        next();
      } catch (err) {
        next(err);
      }
    },
    express.raw({ type: () => true, limit: '25mb' }),
    handleUpload,
  );

  // ── Endpoint dispatch: POST /api/<name> with a JSON body as input ───────────
  app.post('/api/:name', express.json({ limit: '2mb' }), async (req, res, next) => {
    const name = req.params.name as string;
    const endpoint = (endpoints as Record<string, AnyEndpoint>)[name];
    if (!endpoint) return next(new ApiError({ code: 'NOT_FOUND', message: `Unknown endpoint "${name}"` }));

    try {
      const user = endpoint.authenticated ? requireUser(req) : ({ id: 'anonymous', email: '', roles: [] } as RequestUser);
      const input = endpoint.inputSchema.parse(req.body === undefined || req.body === null ? {} : req.body);
      const output = await endpoint.execute({ input, context: { user, requestId: randomUUID() } });
      res.json(output ?? null);
    } catch (err) {
      next(err);
    }
  });

  app.all('/api/{*splat}', (_req, res) => {
    res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Endpoints accept POST only' } });
  });

  // ── Errors ─────────────────────────────────────────────────────────────────
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      return res.status(HTTP_STATUS_FOR_CODE[err.code]).json({ error: { code: err.code, message: err.message } });
    }
    if (err instanceof ZodError) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid input', issues: err.issues } });
    }
    if (err instanceof AirtableError) {
      console.error('[airtable]', err.message);
      return res.status(502).json({ error: { code: 'UPSTREAM', message: err.message } });
    }
    const anyErr = err as { type?: string; status?: number; message?: string };
    if (anyErr?.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } });
    }
    console.error('[server]', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: anyErr?.message || 'Internal error' } });
  });

  return app;
}
