import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint.js';
import { ShxTeam } from '../airtable/index.js';

export default createEndpoint({
  description: 'Looks up the signed-in user in the SHX Team table by email and returns their profile',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    found: z.boolean(),
    profile: z.object({
      id: z.string(),
      proName: z.string(),
      displayName: z.string(),
      email: z.string(),
      role: z.string(),
      status: z.string(),
    }).nullable(),
  }),
  execute: async ({ context }) => {
    const email = context.user.email;
    const record = await ShxTeam.findOne({ filters: { email } });

    if (!record) {
      return { found: false, profile: null };
    }

    return {
      found: true,
      profile: {
        id: record.id,
        proName: String(record.proName || ''),
        displayName: record.displayName || String(record.proName || ''),
        email: record.email || email,
        role: String(record.role || ''),
        status: String(record.status || ''),
      },
    };
  },
});
