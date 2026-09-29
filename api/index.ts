/**
 * Vercel serverless entry. vercel.json rewrites /api/* and /auth/* here; the
 * Express app sees the original path. Static files come from dist/ via the CDN.
 */
import { createApp } from '../server/app';

export default createApp();
