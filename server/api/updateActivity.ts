import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint.js';
import { Activities } from '../airtable/index.js';

export default createEndpoint({
  description: 'Updates an existing activity record in the Activities table',
  authenticated: true,
  inputSchema: z.object({
    activityId: z.string(),
    type: z.string().optional(),
    content: z.string().optional(),
    date: z.string().optional(),
    assignedPro: z.array(z.string()).optional(),
    followUpDate: z.string().optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input }) => {
    await Activities.update({
      id: input.activityId,
      record: {
        type: input.type,
        content: input.content,
        date: input.date,
        assignedPro: input.assignedPro,
        followUpDate: input.followUpDate,
      },
    });
    return { id: input.activityId, success: true };
  },
});
