import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint.js';
import { Activities } from '../airtable/index.js';

export default createEndpoint({
  description: 'Creates a new activity record in the Activities table',
  authenticated: true,
  inputSchema: z.object({
    date: z.string(),
    type: z.string(),
    content: z.string(),
    relatedLead: z.string(),
    assignedPro: z.array(z.string()).optional(),
    followUpDate: z.string().optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input }) => {
    const createActivityRecord = await Activities.create({
      record: {
        type: input.type,
        followUpDate: input.followUpDate,
        content: input.content,
        relatedLead: [input.relatedLead],
        date: input.date,
        assignedPro: input.assignedPro,
      },
    });

    return { id: createActivityRecord.id, success: true };
  },
});
