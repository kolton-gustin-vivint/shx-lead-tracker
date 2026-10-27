/**
 * Self-Gen attachment uploads. The browser POSTs one file's raw bytes with the
 * target record id and filename in the query string; the bytes go straight
 * into that record's Attachments cell via Airtable's upload endpoint, so
 * nothing is stored here.
 *
 * Vercel rejects function request bodies over 4.5 MB, and Airtable's endpoint
 * caps files at 5 MB, so the limit below sits just under Vercel's. Keep it in
 * step with MAX_UPLOAD_BYTES in src/lib/upload.ts.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { ApiError, HTTP_STATUS_FOR_CODE } from '@server/lib/endpoint';
import { uploadAttachment } from '@server/lib/airtable';
import { SelfGenTime } from '@server/airtable/index';
import { SelfGenTimeTable } from '@server/airtable/schema.generated';
import { requireRosterUser } from '@server/lib/roster';
import { getSession } from '@FO-Enablement-Vivint/magistrate/next';

const MAX_BYTES = 4 * 1024 * 1024;
const RECORD_ID_RE = /^rec[A-Za-z0-9]{14}$/;
const ATTACHMENTS_FIELD = SelfGenTimeTable.fields.find(f => f.key === 'attachments')!.name;

export const POST = async (request: NextRequest) => {
  try {
    // Same two gates as the endpoint dispatcher: a valid Magistrate session,
    // then active membership of the SHX Team roster.
    const { session } = await getSession();
    if (!session) {
      throw new ApiError({ code: 'UNAUTHORIZED', message: 'Not signed in' });
    }
    const user = await requireRosterUser(session);

    const recordId = request.nextUrl.searchParams.get('recordId') || '';
    if (!RECORD_ID_RE.test(recordId)) {
      throw new ApiError({ code: 'BAD_REQUEST', message: 'A valid recordId is required' });
    }

    // Pros may attach only to their own activities; managers to anyone's.
    const record = await SelfGenTime.findOne({ id: recordId });
    if (!record) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Activity not found' });
    }
    const ownsRecord = (record.shxPro ?? []).includes(user.id);
    if (!ownsRecord && user.role !== 'Manager') {
      throw new ApiError({ code: 'FORBIDDEN', message: 'You can only attach files to your own activities' });
    }

    const data = Buffer.from(await request.arrayBuffer());
    if (data.length === 0) {
      throw new ApiError({ code: 'BAD_REQUEST', message: 'Empty upload body' });
    }
    if (data.length > MAX_BYTES) {
      throw new ApiError({ code: 'BAD_REQUEST', message: 'File is too large (4 MB maximum)' });
    }

    const filename = request.nextUrl.searchParams.get('filename') || 'upload';
    const contentType = (request.headers.get('content-type') || '').split(';')[0].trim().slice(0, 255)
      || 'application/octet-stream';

    await uploadAttachment({ recordId, field: ATTACHMENTS_FIELD, filename, contentType, data });
    return NextResponse.json({ filename });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: HTTP_STATUS_FOR_CODE[err.code] },
      );
    }
    console.error('[upload]', err);
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Upload failed' } }, { status: 500 });
  }
};
