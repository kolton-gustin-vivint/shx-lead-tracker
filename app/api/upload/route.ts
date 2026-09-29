/**
 * Self-Gen attachment uploads. The browser POSTs the raw file bytes with the
 * name in the query string; the response carries a public URL that Airtable
 * downloads the file from.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { ApiError, HTTP_STATUS_FOR_CODE } from '@server/lib/endpoint';
import { storeUpload } from '@server/lib/upload';
import { withSession } from '@FO-Enablement-Vivint/magistrate/next';

const MAX_BYTES = 25 * 1024 * 1024;

export const POST = withSession(async(request: NextRequest) => {
  try {

    const data = Buffer.from(await request.arrayBuffer());
    if (data.length === 0) {
      throw new ApiError({ code: 'BAD_REQUEST', message: 'Empty upload body' });
    }
    if (data.length > MAX_BYTES) {
      throw new ApiError({ code: 'BAD_REQUEST', message: 'File is too large' });
    }

    const filename = request.nextUrl.searchParams.get('filename') || 'upload';
    return NextResponse.json(storeUpload(data, filename));
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
}
)
