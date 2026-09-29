import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint.js';
import { ShxTeam } from '../airtable/index.js';

export default createEndpoint({
  description: 'Toggles the loadLeads field for a pro to trigger the automation',
  authenticated: true,
  inputSchema: z.object({
    proId: z.string(),
  }),
  outputSchema: z.any(),
  execute: async ({ input }) => {
    await ShxTeam.update({
      record: { loadLeads: true } as any,
      id: input.proId,
    });
    return { success: true };
  },
});
