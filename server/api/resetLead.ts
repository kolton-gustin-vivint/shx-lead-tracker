import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint.js';
import { NisLeads } from '../airtable/index.js';

export default createEndpoint({
  description: 'Resets a lead by updating the resetLead field to trigger the Airtable automation',
  authenticated: true,
  inputSchema: z.object({
    leadId: z.string(),
  }),
  outputSchema: z.any(),
  execute: async ({ input }) => {
    await NisLeads.update({
      record: { resetLead: true } as any,
      id: input.leadId,
    });

    return { success: true, message: 'Lead reset successfully' };
  },
});
