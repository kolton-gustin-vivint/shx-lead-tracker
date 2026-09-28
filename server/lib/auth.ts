/**
 * Sign-in routes. Two modes:
 *   AUTH_MODE=oidc  — standard OpenID Connect (Google Workspace, Microsoft
 *                     Entra, Okta, …) with PKCE. Redirect URI is
 *                     <PUBLIC_URL>/auth/callback.
 *   AUTH_MODE=dev   — local email-only form. Refused in production.
 *
 * Either way the result is a signed session cookie holding { sub, email, name }.
 * Authorization (roster membership, role, Inactive) is still decided by the
 * SHX Team table, exactly as before.
 */
import { Router, type Request, type Response } from 'express';
import * as oidc from 'openid-client';
import { env } from './env';
import { clearSession, decodeSession, encodeSession, getSession, parseCookies, setSession } from './session';

export const authRouter = Router();

const LOGIN_STATE_COOKIE = 'shx_login';

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

function finishLogin(res: Response, user: { sub: string; email: string; name?: string }, redirect: string) {
  setSession(res, user);
  res.clearCookie(LOGIN_STATE_COOKIE, { path: '/' });
  res.redirect(redirect);
}

// ── /auth/me ────────────────────────────────────────────────────────────────

authRouter.get('/me', (req, res) => {
  const s = getSession(req);
  res.json({ user: s ? { id: s.sub, email: s.email, name: s.name ?? null } : null });
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

// ── Dev mode ────────────────────────────────────────────────────────────────

if (env.authMode === 'dev') {
  authRouter.get('/login', (req, res) => {
    const redirect = safeRedirect(req.query.redirect);
    const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    if (email) {
      if (!emailAllowed(email)) return res.status(403).send('Email domain not allowed');
      return finishLogin(res, { sub: `dev:${email}`, email, name: email.split('@')[0] }, redirect);
    }
    res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Dev sign-in</title>
<style>body{font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#eef0f4}
form{background:#fff;padding:32px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.08);display:grid;gap:12px;min-width:320px}
input,button{font:inherit;padding:10px 12px;border-radius:8px;border:1px solid #cbd0d8}button{background:#2f8a52;color:#fff;border:0;cursor:pointer}</style></head>
<body><form method="get" action="/auth/login">
<strong>Local dev sign-in</strong>
<span style="font-size:13px;color:#555">Enter an email that exists in the SHX Team table.</span>
<input type="hidden" name="redirect" value="${redirect.replace(/"/g, '&quot;')}">
<input type="email" name="email" placeholder="you@vivint.com" required autofocus>
<button type="submit">Sign in</button>
</form></body></html>`);
  });
}

// ── OIDC mode ───────────────────────────────────────────────────────────────

if (env.authMode === 'oidc') {
  let configPromise: Promise<oidc.Configuration> | null = null;
  const getConfig = () => {
    configPromise ??= oidc.discovery(new URL(env.oidc.issuer), env.oidc.clientId, env.oidc.clientSecret || undefined);
    return configPromise;
  };
  const redirectUri = `${env.publicUrl}/auth/callback`;

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
