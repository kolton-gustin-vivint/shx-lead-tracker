import { ApiClientError } from './api';

/** Keep in step with MAX_BYTES in app/api/upload/route.ts (Vercel's 4.5 MB body cap). */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** An error message if the file can't be uploaded, otherwise null. */
export function checkUploadSize(file: File): string | null {
  if (file.size <= MAX_UPLOAD_BYTES) return null;
  const mb = (file.size / (1024 * 1024)).toFixed(1);
  return `${file.name} is ${mb} MB. Files must be under 4 MB.`;
}

export interface PendingFile {
  file: File;
  name: string;
}

/** Uploads one file into an existing Self-Gen record's Attachments. */
export async function uploadFile(options: { data: Blob | File; filename: string; recordId: string }): Promise<void> {
  const params = new URLSearchParams({ recordId: options.recordId, filename: options.filename });
  const res = await fetch(`/api/upload?${params}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': options.data.type || 'application/octet-stream' },
    body: options.data,
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      message = (await res.json())?.error?.message ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiClientError(res.status, 'UPLOAD_FAILED', message);
  }
}

/**
 * Uploads the files to the record one at a time (they all append to the same
 * cell) and resolves with the ones that failed.
 */
export async function uploadFiles(recordId: string, files: PendingFile[]): Promise<PendingFile[]> {
  const failed: PendingFile[] = [];
  for (const f of files) {
    try {
      await uploadFile({ data: f.file, filename: f.name, recordId });
    } catch (error) {
      console.error(error);
      failed.push(f);
    }
  }
  return failed;
}
