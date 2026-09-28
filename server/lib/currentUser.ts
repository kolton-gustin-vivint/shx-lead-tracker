// Migration shim: this app's records are linked to rows in the synced users
// table, so `context.user` has to BE that row. Each endpoint calls this
// first. Dropping a call still compiles — `context.user.id` becomes the
// platform session id, which belongs to no row, so anything filtering on
// it errors or comes back empty, at runtime only.
import { ShxTeam } from '../airtable';

/** Set by the platform; a roster column of the same name must not win. */
const PLATFORM_OWNED = ['email', 'roles'];

/** No-op on scheduled/webhook fires; throws for a caller not in the table. */
export async function enrichCurrentUser(context: {
  user?: ({ email?: string } & Record<string, unknown>) | null;
}): Promise<void> {
  const email = context.user?.email;
  if (!email) return;

  const record = await ShxTeam.findOne({
    filters: { email },
  });
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
