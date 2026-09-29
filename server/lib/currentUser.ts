// Migration shim: this app's records are linked to rows in the synced users
// table, so `context.user` has to BE that row. Each endpoint calls this first.
//
// The route handler now applies the roster gate before dispatch, so by the
// time an endpoint runs `context.user` already carries its SHX Team row. This
// call is therefore usually a no-op; it is kept so the endpoint files stay
// unchanged, and so any caller that builds a context by hand still works.
import { findRosterRecord } from './roster';

/** Set by the platform; a roster column of the same name must not win. */
const PLATFORM_OWNED = ['email', 'roles'];

/** No-op on scheduled/webhook fires; throws for a caller not in the table. */
export async function enrichCurrentUser(context: {
  user?: ({ email?: string } & Record<string, unknown>) | null;
}): Promise<void> {
  const email = context.user?.email;
  if (!email) return;

  // Already enriched by the roster gate — `id` is the Airtable record id.
  if (context.user && typeof context.user.id === 'string' && context.user.id.startsWith('rec')) {
    return;
  }

  const record = await findRosterRecord(email);
  if (!record) {
    // What the 1.0 runtime did. Carrying on would file records under an id
    // that is not in the users table at all.
    throw new Error(`No user found in the users table for ${email}`);
  }
  if (!context.user) return;

  for (const [key, value] of Object.entries(record)) {
    if (PLATFORM_OWNED.includes(key)) continue;
    context.user[key] = value;
  }
}
