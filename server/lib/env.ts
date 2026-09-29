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
  : `http://localhost:${process.env.PORT || 3000}`;

/**
 * Server-side configuration. The app has no authentication yet; the current
 * user comes from APP_USER_EMAIL — see server/lib/session.ts.
 */
export const env = {
  isProd,
  isVercel,
  publicUrl: (process.env.PUBLIC_URL || defaultPublicUrl).replace(/\/$/, ''),
  airtableApiKey: req('AIRTABLE_API_KEY'),
  airtableBaseId: process.env.AIRTABLE_BASE_ID,
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.ZITE_OPENAI_ACCESS_TOKEN || '',
  dataDir: process.env.DATA_DIR || (isVercel ? '/tmp/shx-data' : './data'),
  uploadDir: process.env.UPLOAD_DIR || (isVercel ? '/tmp/shx-uploads' : './uploads'),
};
