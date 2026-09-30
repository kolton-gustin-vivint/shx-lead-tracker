import { enrichCurrentUser } from '../lib/currentUser';
import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { ShxTeam } from '../airtable/index';
import { loginEvents } from '../lib/db';

/**
 * A second login inside this window is treated as the same visit (another tab,
 * closing and reopening the app), so it is not counted again. The client
 * already skips refreshes; this is the backstop for everything else.
 */
const LOGIN_DEDUPE_MS = 4 * 60 * 60 * 1000;

export default createEndpoint({
  description: 'Stamps last login on the Airtable record and logs a login event to the local database. Skips the write if this person already logged in within the last few hours.',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ success: z.boolean(), recorded: z.boolean() }),
  execute: async ({ context }) => {
    await enrichCurrentUser(context);
    const now = new Date().toISOString();
    const user = context.user as Record<string, any>;

    const since = new Date(Date.now() - LOGIN_DEDUPE_MS).toISOString();
    if (await loginEvents.hasLoginSince(user.id, since)) {
      return { success: true, recorded: false };
    }

    // Update Airtable lastLogin
    await ShxTeam.update({
      id: user.id,
      record: { lastLogin: now },
    });

    // Append to the login log in Neon
    await loginEvents.create({
      userEmail: user.email ?? '',
      userName: user.proName ?? user.displayName ?? '',
      airtableRecordId: user.id,
      loggedInAt: now,
      role: user.role ?? '',
    });

    return { success: true, recorded: true };
  },
});
