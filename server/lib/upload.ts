/**
 * File uploads for Self-Gen attachments. Files are stored on local disk and
 * served publicly at /uploads/<random-id>/<filename>. Airtable downloads the
 * file from that URL when the attachment is saved, so PUBLIC_URL must be
 * reachable from the internet in production.
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Request, Response } from 'express';
import { env } from './env';

mkdirSync(env.uploadDir, { recursive: true });

function safeFilename(name: string): string {
  const cleaned = name.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 180) || 'file';
}

export function handleUpload(req: Request, res: Response): void {
  const body = req.body as Buffer | undefined;
  if (!body || !Buffer.isBuffer(body) || body.length === 0) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Empty upload body' } });
    return;
  }
  const filename = safeFilename(String(req.query.filename || 'upload'));
  const id = randomBytes(12).toString('hex');
  const dir = join(env.uploadDir, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), body);
  res.json({ fileUrl: `${env.publicUrl}/uploads/${id}/${encodeURIComponent(filename)}`, filename });
}
