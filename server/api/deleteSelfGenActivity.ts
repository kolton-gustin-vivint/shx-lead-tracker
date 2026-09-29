import { enrichCurrentUser } from '../lib/currentUser.js';
import { z } from 'zod';
import { ApiError, createEndpoint } from '../lib/endpoint.js';
import { SelfGenTime } from '../airtable/index.js';

export default createEndpoint({
  description: 'Deletes a Self-Gen Time activity record. Restricted to Manager-role users.',
  authenticated: true,
  inputSchema: z.object({
    id: z.string(),
  }),
  outputSchema: z.object({
    id: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ input, context }) => {
    await enrichCurrentUser(context);
    if (context.user.role !== 'Manager') {
      throw new ApiError({ code: 'FORBIDDEN', message: 'Only managers can delete Self-Gen activities' });
    }

    await SelfGenTime.delete({ id: input.id });
    return { id: input.id, success: true };
  },
});
