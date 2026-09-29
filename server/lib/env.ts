import 'dotenv/config';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const isProd = process.env.NODE_ENV === 'production';
/** Set automatically by Vercel. The filesystem there is read-only except /tmp. */
export const isVercel = Boolean(process.env.VERCEL);

const defaultPublicUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : `http://localhost:${process.env.PORT || 3001}`;

export const env = {
  isProd,
  isVercel,
  port: Number(process.env.PORT || 3001),
  publicUrl: (process.env.PUBLIC_URL || defaultPublicUrl).replace(/\/$/, ''),
  webUrl: (process.env.WEB_URL || (isProd ? process.env.PUBLIC_URL || defaultPublicUrl : 'http://localhost:5173')).replace(/\/$/, ''),
  airtableApiKey: req('AIRTABLE_API_KEY'),
  airtableBaseId: process.env.AIRTABLE_BASE_ID,
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.ZITE_OPENAI_ACCESS_TOKEN || '',
  sessionSecret: process.env.SESSION_SECRET || (isProd ? req('SESSION_SECRET') : 'dev-only-insecure-secret'),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 168),
  /**
   * email — sign in with an email address that exists in the SHX Team table (no password).
   * oidc  — OpenID Connect provider (Google Workspace, Microsoft Entra, Okta, …).
   */
  authMode: (process.env.AUTH_MODE || 'email') as 'email' | 'oidc',
  oidc: {
    issuer: process.env.OIDC_ISSUER || '',
    clientId: process.env.OIDC_CLIENT_ID || '',
    clientSecret: process.env.OIDC_CLIENT_SECRET || '',
  },
  allowedEmailDomains: (process.env.ALLOWED_EMAIL_DOMAINS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean),
  dataDir: process.env.DATA_DIR || (isVercel ? '/tmp/shx-data' : './data'),
  uploadDir: process.env.UPLOAD_DIR || (isVercel ? '/tmp/shx-uploads' : './uploads'),
};

if (!['email', 'oidc'].includes(env.authMode)) {
  throw new Error(`AUTH_MODE must be "email" or "oidc" (got "${env.authMode}")`);
}
if (env.authMode === 'oidc' && (!env.oidc.issuer || !env.oidc.clientId)) {
  throw new Error('AUTH_MODE=oidc requires OIDC_ISSUER and OIDC_CLIENT_ID');
}
