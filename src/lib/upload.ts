import { ApiClientError, UNAUTHORIZED_EVENT } from './api';

export interface UploadResult {
  fileUrl: string;
  filename: string;
}

/** Uploads a file to the API server and returns a public URL Airtable can fetch. */
export async function uploadFile(options: { data: Blob | File; filename: string }): Promise<UploadResult> {
  const res = await fetch(`/api/upload?filename=${encodeURIComponent(options.filename)}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': options.data.type || 'application/octet-stream' },
    body: options.data,
  });
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    let message = `${res.status} ${res.statusText}`;
    try {
      message = (await res.json())?.error?.message ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiClientError(res.status, 'UPLOAD_FAILED', message);
  }
  return (await res.json()) as UploadResult;
}
