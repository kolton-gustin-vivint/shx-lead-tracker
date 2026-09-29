/**
 * File uploads for Self-Gen attachments. Files are stored on disk and served
 * back at /uploads/<random-id>/<filename>. Airtable downloads the file from
 * that URL when the attachment is saved, so PUBLIC_URL must be reachable from
 * the internet in production.
 *
 * On Vercel this writes to /tmp, which is neither shared between instances nor
 * durable — attachments need object storage (or Airtable's direct upload
 * endpoint) before they work there. See VERIFICATION.md.
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, normalize, resolve, sep } from 'node:path';
import { env } from './env';

export interface StoredUpload {
  fileUrl: string;
  filename: string;
}

function safeFilename(name: string): string {
  const cleaned = name.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 180) || 'file';
}

/** Writes an uploaded file to disk and returns the public URL Airtable can fetch. */
export function storeUpload(data: Buffer, requestedName: string): StoredUpload {
  const filename = safeFilename(requestedName);
  const id = randomBytes(12).toString('hex');
  // The upload directory is configured per environment, so these paths are
  // resolved at runtime on purpose. The ignore comments stop the bundler from
  // tracing the whole project as a possible filesystem dependency.
  const dir = join(/* turbopackIgnore: true */ env.uploadDir, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(/* turbopackIgnore: true */ dir, filename), data);
  return { fileUrl: `${env.publicUrl}/uploads/${id}/${encodeURIComponent(filename)}`, filename };
}

/**
 * Resolves a published upload path to a file on disk, rejecting anything that
 * escapes the upload directory.
 */
export function resolveUploadPath(segments: string[]): string | null {
  if (!segments.length) return null;
  const root = resolve(/* turbopackIgnore: true */ env.uploadDir);
  const target = resolve(/* turbopackIgnore: true */ root, normalize(segments.join('/')));
  if (target !== root && !target.startsWith(root + sep)) return null;
  return target;
}
