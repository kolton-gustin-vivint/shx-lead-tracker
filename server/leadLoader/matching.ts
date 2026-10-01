/**
 * Lead-matching logic shared by the lead loaders. Ported from the Airtable
 * scripts "Single-Pro Loader (GRID BUTTON) v9.9" (Load Leads) and "Load New Cap
 * (GRID BUTTON) v1.9" (Load NEW CAP), whose matching code is identical — keep
 * them in step while the Airtable buttons still exist.
 *
 * Differences from the script are only about data shape: the REST API returns
 * single selects as plain strings (the scripting API returns { name }), and
 * the Pro/lead values come from our Airtable adapter instead of getCellValue().
 * Everything else — normalisation, the eight buckets and their order, the
 * 75-day cutoff — matches the script.
 */
import { zipCentroid, type LatLng } from './zipCentroids';

// ── Constants (same values as the script) ───────────────────────────────────
export const DEFAULT_TOTAL_CAP = 150; // Active Lead Cap when the Pro's field is blank
export const DEFAULT_DAILY_CAP = 10; // Daily New Lead Cap when the Pro's field is blank (Load Leads)
export const MAX_LEAD_AGE_DAYS = 75;
export const DEFAULT_RADIUS_MILES = 60; // when the Pro's Radius field is blank
export const STATE_FALLBACK_BACKSTOP_MILES = 100;

const STATE_MAP: Record<string, string> = {"Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY"};
/** Full state names for building Airtable prefilters (script matches either form). */
export const STATE_NAME_BY_ABBR: Record<string, string> = Object.fromEntries(Object.entries(STATE_MAP).map(([n, a]) => [a, n]));

// ── Normalisers ─────────────────────────────────────────────────────────────
/** Unwraps selects/links ({ name }) and AI text fields ({ state, value, isStale }). */
export function asText(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && typeof (val as any).name === 'string') return (val as any).name;
  if (typeof val === 'object' && typeof (val as any).value === 'string') return (val as any).value;
  return '' + val;
}
export function trimmed(val: unknown): string {
  return val === null || val === undefined ? '' : val.toString().trim();
}
export function normalizeState(input: unknown): string {
  if (Array.isArray(input)) input = input[0];
  const s = asText(input).trim();
  if (!s) return '';
  if (s.length === 2) return s.toUpperCase();
  return (STATE_MAP[s] || '').toUpperCase();
}
export function normalizeDistrict(input: unknown): string {
  if (Array.isArray(input)) input = input[0];
  return asText(input).replace(/ /g, ' ').trim().toLowerCase();
}
export function normalizeZip(input: unknown): string {
  if (input === null || input === undefined || input === '') return '';
  // ZIPs stored as numbers lose leading zeros ("00501" -> 501); pad back.
  if (typeof input === 'number') return String(Math.trunc(input)).padStart(5, '0');
  const s = asText(input).trim();
  if (!s) return '';
  const m = s.match(/\d{5}/);
  return m ? m[0] : '';
}
export function normalizeCity(input: unknown): string {
  if (!input) return '';
  if (Array.isArray(input)) input = input[0];
  const s = asText(input).replace(/ /g, ' ').trim().toLowerCase();
  if (!s) return '';
  return s.split(',')[0].trim().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}
export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function normalizeStatesFromCell(cellVal: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (maybe: unknown) => {
    const st = normalizeState(maybe);
    if (st && !seen.has(st)) { seen.add(st); out.push(st); }
  };
  if (!cellVal) return out;
  if (Array.isArray(cellVal)) for (const opt of cellVal) push((opt as any)?.name || opt);
  else if (typeof cellVal === 'object' && (cellVal as any).name) push((cellVal as any).name);
  else push(cellVal);
  return out;
}
/** Multi-value lookup cells keep EVERY value (a Pro can link to several EML records). */
function setFromCell(cellVal: unknown, norm: (v: unknown) => string): Set<string> {
  const arr = Array.isArray(cellVal) ? cellVal : cellVal ? [cellVal] : [];
  const out = new Set<string>();
  for (const v of arr) { const n = norm(v); if (n) out.add(n); }
  return out;
}
export const normalizeCitiesFromCell = (v: unknown) => setFromCell(v, normalizeCity);
export const normalizeZipsFromCell = (v: unknown) => setFromCell(v, normalizeZip);
export const normalizeDistrictsFromCell = (v: unknown) => setFromCell(v, normalizeDistrict);

function minDistance(proCoords: LatLng[], lat: number, lng: number): number {
  let min = Infinity;
  for (const pc of proCoords) min = Math.min(min, haversineMiles(pc.lat, pc.lng, lat, lng));
  return min;
}

export function parseCityWithRequiredState(token: string): { state: string; city: string } | null {
  const t = (token || '').toString().trim();
  if (!t) return null;
  const m = t.match(/^([A-Za-z]{2})\s*:\s*(.+)$/) || t.match(/^(.+?)\s*\(\s*([A-Za-z]{2})\s*\)\s*$/) || t.match(/^(.+?),\s*([A-Za-z]{2})\s*$/);
  if (m) {
    const stateFirst = t.includes(':');
    const st = normalizeState(stateFirst ? m[1] : m[2]);
    const city = normalizeCity(stateFirst ? m[2] : m[1]);
    if (st && city) return { state: st, city };
  }
  return null;
}
/** "UT: Provo, UT: Orem" / "Provo, UT; Orem (UT)" → Map(state → Set(city)). */
export function parseCityStateMapRequired(raw: unknown): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  if (!raw) return map;
  let text = asText(raw).trim();
  if (!text) return map;
  text = text.replace(/,\s*(?=[A-Za-z]{2}\s*:)/g, '\n'); // commas before "ST:" separate entries
  text = text.replace(/,\s*([A-Za-z]{2})\b/g, '<<STATECOMMA>>$1'); // protect "City, ST"
  const parts = text.split(/[\n;|]+/g).map(s => s.trim()).filter(Boolean).map(s => s.replace(/<<STATECOMMA>>/g, ', '));
  for (const p of parts) {
    const parsed = parseCityWithRequiredState(p);
    if (parsed) {
      if (!map.has(parsed.state)) map.set(parsed.state, new Set());
      map.get(parsed.state)!.add(parsed.city);
    }
  }
  return map;
}

// ── Pro territory ───────────────────────────────────────────────────────────
/** The Pro fields the matcher reads, as our adapter returns them. */
export interface ProFields {
  shxStateAbbreviation?: unknown;
  shxStateAi?: unknown;
  territoryOverride?: unknown;
  district?: unknown;
  shxCity?: unknown;
  additionalCities?: unknown;
  nearbyCities?: unknown;
  shxZip?: unknown;
  nearbyZips?: unknown;
  radius?: number | null;
}
export interface Territory {
  allowedStates: Set<string>;
  homeStateSource: 'SHX State Abbreviation' | 'SHX State (AI) [fallback]';
  districts: Set<string>;
  cities: Set<string>;
  additional: Map<string, Set<string>>;
  nearby: Map<string, Set<string>>;
  zips: Set<string>;
  nearbyZips: Set<string>;
  radiusMiles: number;
  coords: LatLng[];
}
export function territoryOf(pro: ProFields): Territory {
  let homeState = normalizeState(pro.shxStateAbbreviation);
  let homeStateSource: Territory['homeStateSource'] = 'SHX State Abbreviation';
  if (!homeState) {
    homeState = normalizeState(pro.shxStateAi);
    homeStateSource = 'SHX State (AI) [fallback]';
  }
  const allowedStates = new Set([homeState, ...normalizeStatesFromCell(pro.territoryOverride)].filter(Boolean));
  const zips = normalizeZipsFromCell(pro.shxZip);
  return {
    allowedStates,
    homeStateSource,
    districts: normalizeDistrictsFromCell(pro.district),
    cities: normalizeCitiesFromCell(pro.shxCity),
    additional: parseCityStateMapRequired(pro.additionalCities || ''),
    nearby: parseCityStateMapRequired(pro.nearbyCities || ''),
    zips,
    nearbyZips: new Set(asText(pro.nearbyZips).split(/[\n,;|]+/g).map(z => normalizeZip(z)).filter(Boolean)),
    radiusMiles: pro.radius ?? DEFAULT_RADIUS_MILES,
    coords: [...zips].map(z => zipCentroid(z)).filter((c): c is LatLng => !!c),
  };
}

// ── Candidates & buckets ────────────────────────────────────────────────────
export interface LeadFields {
  id: string;
  leadType?: unknown;
  originalAssignedPro?: unknown;
  closeReason?: unknown;
  opportunityCreated?: string | null;
  customerState?: unknown;
  customerCity?: unknown;
  customerZipAi?: unknown;
  customerDistrict?: unknown;
}

export interface FilterStats { considered: number; passed: number; notReady: number; worked: number; tooOld: number; outside: number }

/** The script's candidate filter, applied exactly (our Airtable prefilter is only a superset). */
export function filterCandidates<L extends LeadFields>(leads: L[], t: Territory, now = new Date()): { candidates: L[]; stats: FilterStats } {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - MAX_LEAD_AGE_DAYS);
  const stats: FilterStats = { considered: leads.length, passed: 0, notReady: 0, worked: 0, tooOld: 0, outside: 0 };
  const candidates = leads.filter(r => {
    if (asText(r.leadType) !== 'Ready to Assign') { stats.notReady++; return false; }
    if (trimmed(asText(r.originalAssignedPro)).length > 0 || trimmed(asText(r.closeReason)).length > 0) { stats.worked++; return false; }
    if (!r.opportunityCreated || new Date(r.opportunityCreated) < cutoff) { stats.tooOld++; return false; }
    if (t.allowedStates.has(normalizeState(r.customerState))) return true;
    if (t.districts.size && t.districts.has(normalizeDistrict(r.customerDistrict))) return true;
    stats.outside++;
    return false;
  });
  stats.passed = candidates.length;
  return { candidates, stats };
}

export const BUCKET_ORDER = ['city', 'addl', 'nearby', 'zipEx', 'zipNear', 'district', 'radius', 'backstop'] as const;
export type BucketName = (typeof BUCKET_ORDER)[number];
export const BUCKET_LABELS: Record<BucketName, string> = {
  city: 'Exact city', addl: 'Additional cities', nearby: 'Nearby cities', zipEx: 'ZIP exact',
  zipNear: 'ZIP nearby', district: 'District', radius: 'Radius', backstop: 'State backstop',
};

/** Each candidate lands in the FIRST bucket it matches, in the script's order. Input order is kept. */
export function bucketize<L extends LeadFields>(candidates: L[], t: Territory): Record<BucketName, L[]> {
  const buckets = Object.fromEntries(BUCKET_ORDER.map(b => [b, [] as L[]])) as Record<BucketName, L[]>;
  const within = (zip: string, miles: number) => {
    if (t.coords.length === 0 || !zip) return false;
    const c = zipCentroid(zip);
    return !!c && minDistance(t.coords, c.lat, c.lng) <= miles;
  };
  for (const lead of candidates) {
    const city = normalizeCity(lead.customerCity);
    const state = normalizeState(lead.customerState);
    const zip = normalizeZip(lead.customerZipAi);
    const dist = normalizeDistrict(lead.customerDistrict);
    if (t.cities.size && t.cities.has(city)) buckets.city.push(lead);
    else if (city && t.additional.get(state)?.has(city)) buckets.addl.push(lead);
    else if (city && t.nearby.get(state)?.has(city)) buckets.nearby.push(lead);
    else if (zip && t.zips.has(zip)) buckets.zipEx.push(lead);
    else if (zip && t.nearbyZips.has(zip)) buckets.zipNear.push(lead);
    else if (t.districts.size && t.districts.has(dist)) buckets.district.push(lead);
    else if (within(zip, t.radiusMiles)) buckets.radius.push(lead);
    else if (within(zip, STATE_FALLBACK_BACKSTOP_MILES)) buckets.backstop.push(lead);
  }
  return buckets;
}

/** The script's shortfall explanations, word for word where it can be. */
export function shortfallReasons(b: Record<BucketName, unknown[]>, t: Territory, needed: number, stats: FilterStats): string[] {
  const total = BUCKET_ORDER.reduce((n, k) => n + b[k].length, 0);
  const zips = [...t.zips].join(', ');
  const reasons: string[] = [];
  if (total === 0) {
    reasons.push('No candidates matched any bucket. Check that territory fields (city, district, ZIP) are configured correctly and that leads exist for those areas.');
    return reasons;
  }
  if (total < needed) reasons.push(`Only ${total} total leads available across all buckets (need ${needed}).`);
  if (b.city.length === 0 && t.cities.size) reasons.push(`No leads in exact city/cities "${[...t.cities].join(', ')}".`);
  if (b.addl.length === 0 && t.additional.size > 0) reasons.push('Additional Cities configured but no matching leads found.');
  if (b.nearby.length === 0 && t.nearby.size > 0) reasons.push('Nearby Cities configured but no matching leads found.');
  if (b.zipEx.length === 0 && t.zips.size) reasons.push(`No leads matching pro ZIP(s) "${zips}".`);
  if (b.zipNear.length === 0 && t.nearbyZips.size > 0) reasons.push('Nearby ZIPs configured but no matching leads found.');
  if (b.district.length === 0 && t.districts.size) reasons.push(`No leads in district(s) "${[...t.districts].join(', ')}".`);
  if (b.radius.length === 0) {
    reasons.push(t.coords.length === 0 ? `Radius match skipped — no ZIP centroid on file for Pro ZIP(s) "${zips}".` : `No leads found within ${t.radiusMiles}mi radius of ${zips}.`);
  }
  if (b.backstop.length === 0) {
    reasons.push(t.coords.length === 0 ? `State fallback backstop skipped — no ZIP centroid on file for Pro ZIP(s) "${zips}".` : `No leads found within ${STATE_FALLBACK_BACKSTOP_MILES}mi backstop of ${zips}.`);
  }
  if (stats.tooOld > 0) reasons.push(`${stats.tooOld} lead(s) excluded for being older than ${MAX_LEAD_AGE_DAYS} days.`);
  if (stats.worked > 0) reasons.push(`${stats.worked} lead(s) excluded as previously worked.`);
  return reasons;
}
