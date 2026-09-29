import { enrichCurrentUser } from '../lib/currentUser';
import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { ShxTeam } from '../airtable/index';
import { loginEvents } from '../lib/db';

export default createEndpoint({
  description: 'Stamps last login on the Airtable record and logs a login event to the local database.',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ context }) => {
    await enrichCurrentUser(context);
    const now = new Date().toISOString();
    const user = context.user as Record<string, any>;

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

    return { success: true };
  },
});
