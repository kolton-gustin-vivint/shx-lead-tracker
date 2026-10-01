/**
 * ZIP → lat/lng, from server/data/zip-centroids.json (a copy of the static
 * Airtable "ZIP Centroids" table; refresh with `npm run zips:sync`).
 * Loaded once per server instance, on first use.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface LatLng { lat: number; lng: number }

let table: Record<string, [number, number]> | null = null;

function load(): Record<string, [number, number]> {
  if (!table) {
    // next.config.ts includes this file in the API route's server bundle (outputFileTracingIncludes).
    table = JSON.parse(readFileSync(join(process.cwd(), 'server/data/zip-centroids.json'), 'utf8'));
  }
  return table!;
}

export function zipCentroid(zip: string): LatLng | null {
  const hit = load()[zip];
  return hit ? { lat: hit[0], lng: hit[1] } : null;
}
