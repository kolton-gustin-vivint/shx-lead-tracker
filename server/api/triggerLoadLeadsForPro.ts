import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { ShxTeam } from '../airtable/index';
import { requireManager } from '../lib/access';

export default createEndpoint({
  description: 'Toggles the loadLeads field for a pro to trigger the automation',
  authenticated: true,
  inputSchema: z.object({
    proId: z.string(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    requireManager(context.user);
    await ShxTeam.update({
      record: { loadLeads: true } as any,
      id: input.proId,
    });
    return { success: true };
  },
});
