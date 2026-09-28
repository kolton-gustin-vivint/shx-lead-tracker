import 'dotenv/config';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const isProd = process.env.NODE_ENV === 'production';

export const env = {
  isProd,
  port: Number(process.env.PORT || 3001),
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, ''),
  webUrl: (process.env.WEB_URL || (isProd ? process.env.PUBLIC_URL || '' : 'http://localhost:5173')).replace(/\/$/, ''),
  airtableApiKey: req('AIRTABLE_API_KEY'),
  airtableBaseId: process.env.AIRTABLE_BASE_ID,
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.ZITE_OPENAI_ACCESS_TOKEN || '',
  sessionSecret: process.env.SESSION_SECRET || (isProd ? req('SESSION_SECRET') : 'dev-only-insecure-secret'),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 168),
  authMode: (process.env.AUTH_MODE || 'dev') as 'oidc' | 'dev',
  oidc: {
    issuer: process.env.OIDC_ISSUER || '',
    clientId: process.env.OIDC_CLIENT_ID || '',
    clientSecret: process.env.OIDC_CLIENT_SECRET || '',
  },
  allowedEmailDomains: (process.env.ALLOWED_EMAIL_DOMAINS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean),
  dataDir: process.env.DATA_DIR || './data',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
};

if (env.authMode === 'dev' && isProd) {
  throw new Error('AUTH_MODE=dev is not allowed when NODE_ENV=production. Configure OIDC.');
}
if (env.authMode === 'oidc' && (!env.oidc.issuer || !env.oidc.clientId)) {
  throw new Error('AUTH_MODE=oidc requires OIDC_ISSUER and OIDC_CLIENT_ID');
}
