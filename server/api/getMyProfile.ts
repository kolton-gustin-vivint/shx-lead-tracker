import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { ShxTeam } from '../airtable/index';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@FO-Enablement-Vivint/magistrate/next';


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
  
  execute: async () => {
    const {session} = await getSession();
    const record = await ShxTeam.findOne({ filters: { email: session.email } });

    if (!record) {
      return { found: false, profile: null };
    }

    return {
      found: true,
      profile: {
        id: record.id,
        proName: String(record.proName || ''),
        displayName: record.displayName || String(record.proName || ''),
        email: record.email || session.email,
        role: String(record.role || ''),
        status: String(record.status || ''),
      },
    };
  },
});
