/**
 * Copies the Airtable "ZIP Centroids" table (ZIP, Lat, Lng) into
 * server/data/zip-centroids.json for the lead loaders' radius matching.
 *
 * The table is static reference data (~43k rows) — far too slow to read over
 * the API on every load (~4 minutes at Airtable's 5 req/s). Re-run this only
 * if the Airtable table changes:  npm run zips:sync
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID || 'apphPJFvk2oPNeJK9';
const TABLE = 'ZIP Centroids';
if (!API_KEY) throw new Error('AIRTABLE_API_KEY is not set');

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function normalizeZip(v: unknown): string {
  if (typeof v === 'number') return String(Math.trunc(v)).padStart(5, '0');
  const m = String(v ?? '').match(/\d{5}/);
  return m ? m[0] : '';
}

async function main() {
  const out: Record<string, [number, number]> = {};
  let offset: string | undefined;
  let rows = 0, skipped = 0, pages = 0;
  do {
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}/listRecords`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageSize: 100, fields: ['ZIP', 'Lat', 'Lng'], ...(offset ? { offset } : {}) }),
    });
    if (res.status === 429) { await sleep(30_000); continue; }
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    const page = (await res.json()) as { records: { fields: Record<string, unknown> }[]; offset?: string };
    for (const r of page.records) {
      rows++;
      const zip = normalizeZip(r.fields.ZIP);
      const lat = r.fields.Lat, lng = r.fields.Lng;
      if (zip && typeof lat === 'number' && typeof lng === 'number') out[zip] = [lat, lng];
      else skipped++;
    }
    offset = page.offset;
    if (++pages % 50 === 0) console.log(`  ${rows} rows…`);
    await sleep(210); // stay under 5 requests/second
  } while (offset);

  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  const target = resolve(process.cwd(), 'server/data/zip-centroids.json');
  writeFileSync(target, JSON.stringify(sorted) + '\n');
  console.log(`Wrote ${Object.keys(sorted).length} ZIPs (${rows} rows read, ${skipped} skipped) to ${target}`);
}

main().catch(err => { console.error(err); process.exit(1); });
