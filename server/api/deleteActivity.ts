import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { Activities } from '../airtable';

export default createEndpoint({
  description: 'Deletes an activity record from the Activities table',
  authenticated: true,
  inputSchema: z.object({
    activityId: z.string(),
  }),
  outputSchema: z.any(),
  execute: async ({ input }) => {
    await Activities.delete({ id: input.activityId });
    return { id: input.activityId, success: true };
  },
});
