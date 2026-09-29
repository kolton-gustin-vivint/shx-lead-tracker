/**
 * Sign-in routes. Two modes:
 *   AUTH_MODE=email — the user enters an email address; it must match a row in
 *                     the SHX Team table whose Status is not "Inactive". No
 *                     password or verification, mirroring the original app.
 *   AUTH_MODE=oidc  — standard OpenID Connect (Google Workspace, Microsoft
 *                     Entra, Okta, …) with PKCE. Redirect URI is
 *                     <PUBLIC_URL>/auth/callback.
 *
 * Either way the result is a signed session cookie holding { sub, email, name }.
 * Role / Inactive gating in the app is still driven by the SHX Team table.
 */
import { Router, json, type Request, type Response } from 'express';
import * as oidc from 'openid-client';
import { env } from './env.js';
import { ShxTeam } from '../airtable/index.js';
import { clearSession, decodeSession, encodeSession, getSession, parseCookies, setSession } from './session.js';

export const authRouter = Router();

const LOGIN_STATE_COOKIE = 'shx_login';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailAllowed(email: string): boolean {
  if (!env.allowedEmailDomains.length) return true;
  const domain = email.split('@')[1]?.toLowerCase();
  return Boolean(domain && env.allowedEmailDomains.includes(domain));
}

/** Only allow redirects back to our own web/app origins (or a relative path). */
function safeRedirect(target: unknown): string {
  const fallback = env.webUrl || '/';
  if (typeof target !== 'string' || !target) return fallback;
  if (target.startsWith('/') && !target.startsWith('//')) return target;
  try {
    const u = new URL(target);
    const allowed = [env.webUrl, env.publicUrl].filter(Boolean).map(o => new URL(o).origin);
    if (allowed.includes(u.origin)) return u.href;
  } catch {
    /* not a URL */
  }
  return fallback;
}

// ── Small per-IP throttle so the login form can't be used to enumerate the roster ──
const attempts = new Map<string, { count: number; resetAt: number }>();
function throttled(ip: string, max = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

// ── /auth/me ────────────────────────────────────────────────────────────────

authRouter.get('/me', (req, res) => {
  const s = getSession(req);
  res.json({ mode: env.authMode, user: s ? { id: s.sub, email: s.email, name: s.name ?? null } : null });
});

// ── /auth/logout ────────────────────────────────────────────────────────────

authRouter.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});
authRouter.get('/logout', (_req, res) => {
  clearSession(res);
  res.redirect(env.webUrl || '/');
});

// ── Email mode ──────────────────────────────────────────────────────────────

if (env.authMode === 'email') {
  /** Body: { email }. 200 → session cookie set. 404 → not in roster. 403 → inactive / domain blocked. */
  authRouter.post('/login', json({ limit: '10kb' }), async (req: Request, res: Response, next) => {
    try {
      if (throttled(req.ip || 'unknown')) {
        return res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message: 'Too many sign-in attempts. Try again in a minute.' } });
      }
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Enter a valid email address.' } });
      }
      if (!emailAllowed(email)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'That email domain is not allowed.' } });
      }

      const record = await ShxTeam.findOne({ filters: { email } });
      if (!record) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Your email was not found in the SHX Team roster. Please contact your manager.' } });
      }
      if (record.status === 'Inactive') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Your account is marked as Inactive. Please contact your manager.' } });
      }

      setSession(res, { sub: record.id, email: record.email || email, name: record.displayName || record.proName });
      res.json({ ok: true, user: { id: record.id, email: record.email || email, name: record.displayName || record.proName || null } });
    } catch (err) {
      next(err);
    }
  });

  // Old-style link (/auth/login?redirect=…) just goes back to the app, which shows the form.
  authRouter.get('/login', (req, res) => res.redirect(safeRedirect(req.query.redirect)));
}

// ── OIDC mode ───────────────────────────────────────────────────────────────

if (env.authMode === 'oidc') {
  let configPromise: Promise<oidc.Configuration> | null = null;
  const getConfig = () => {
    configPromise ??= oidc.discovery(new URL(env.oidc.issuer), env.oidc.clientId, env.oidc.clientSecret || undefined);
    return configPromise;
  };
  const redirectUri = `${env.publicUrl}/auth/callback`;

  const finishLogin = (res: Response, user: { sub: string; email: string; name?: string }, redirect: string) => {
    setSession(res, user);
    res.clearCookie(LOGIN_STATE_COOKIE, { path: '/' });
    res.redirect(redirect);
  };

  authRouter.get('/login', async (req, res, next) => {
    try {
      const config = await getConfig();
      const codeVerifier = oidc.randomPKCECodeVerifier();
      const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
      const state = oidc.randomState();
      const redirect = safeRedirect(req.query.redirect);

      // Stash PKCE verifier + state in a short-lived signed cookie.
      const now = Math.floor(Date.now() / 1000);
      const stash = encodeSession({ sub: codeVerifier, email: state, name: redirect, iat: now, exp: now + 600 });
      res.cookie(LOGIN_STATE_COOKIE, stash, { httpOnly: true, sameSite: 'lax', secure: env.isProd, path: '/', maxAge: 600_000 });

      const url = oidc.buildAuthorizationUrl(config, {
        redirect_uri: redirectUri,
        scope: 'openid email profile',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
      res.redirect(url.href);
    } catch (err) {
      next(err);
    }
  });

  authRouter.get('/callback', async (req: Request, res: Response, next) => {
    try {
      const config = await getConfig();
      const stash = decodeSession(parseCookies(req.headers.cookie)[LOGIN_STATE_COOKIE]);
      if (!stash) return res.status(400).send('Login session expired. Please try signing in again.');

      const currentUrl = new URL(req.originalUrl, env.publicUrl);
      const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: stash.sub,
        expectedState: stash.email,
      });
      const claims = tokens.claims();
      const email = String(claims?.email || claims?.preferred_username || '').toLowerCase();
      if (!email) return res.status(400).send('Identity provider did not return an email address.');
      if (!emailAllowed(email)) return res.status(403).send('Email domain not allowed');

      finishLogin(res, { sub: String(claims?.sub || email), email, name: (claims?.name as string) || undefined }, safeRedirect(stash.name));
    } catch (err) {
      next(err);
    }
  });
}
