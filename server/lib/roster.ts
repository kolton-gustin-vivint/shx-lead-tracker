/**
 * SHX Team roster gate.
 *
 * Magistrate says *who* someone is — any Field Pro Mobile user can hold a
 * valid session. This decides whether they may use this app at all: their
 * email must match a row in the SHX Team table, and that row must not be
 * Inactive.
 *
 * Every API request passes through `requireRosterUser`, so the check applies
 * to all endpoints at once rather than each one remembering to ask.
 */
import { ShxTeam, type ShxTeamRecordType } from '../airtable/index';
import { ApiError, type RequestUser } from './endpoint';

/**
 * Roster rows are cached briefly so a burst of API calls from one page load
 * costs a single Airtable lookup instead of one per request. The trade-off is
 * that a role change, or someone being marked Inactive, takes up to this long
 * to take effect.
 */
const CACHE_TTL_MS = 60_000;

type CacheEntry = { record: ShxTeamRecordType | null; expires: number };
const cache = new Map<string, CacheEntry>();

/** Looks up a roster row by email, using the short-lived cache. */
export async function findRosterRecord(email: string): Promise<ShxTeamRecordType | null> {
  const key = email.trim().toLowerCase();
  if (!key) return null;

  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.record;

  const record = (await ShxTeam.findOne({ filters: { email: key } })) ?? null;
  cache.set(key, { record, expires: Date.now() + CACHE_TTL_MS });
  return record;
}

/** Drops a cached row, so the next request re-reads it from Airtable. */
export function forgetRosterRecord(email: string): void {
  cache.delete(email.trim().toLowerCase());
}

/** Fields the platform owns; a roster column of the same name must not win. */
const PLATFORM_OWNED = new Set(['email', 'roles']);

/**
 * Builds the endpoint `context.user` for a signed-in person, refusing anyone
 * who is not an active member of the SHX Team.
 *
 * The returned user already carries the roster row, so `context.user.id` is
 * the Airtable record id and `role` / `assignedLeads1` are populated — the
 * same shape `enrichCurrentUser` produces.
 */
export async function requireRosterUser(session: { email?: string; firstName?: string; lastName?: string }): Promise<RequestUser> {
  const email = (session.email || '').trim().toLowerCase();
  if (!email) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Not signed in' });
  }

  const record = await findRosterRecord(email);
  if (!record) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Your email was not found in the SHX Team roster. Please contact your manager.',
    });
  }
  if (record.status === 'Inactive') {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Your account is marked as Inactive. Please contact your manager.',
    });
  }

  const name = [session.firstName, session.lastName].filter(Boolean).join(' ').trim();
  const user: RequestUser = { id: record.id, email, name: name || undefined, roles: [] };

  for (const [key, value] of Object.entries(record)) {
    if (PLATFORM_OWNED.has(key)) continue;
    user[key] = value;
  }

  return user;
}
