import { z } from 'zod';
import { ApiError, createEndpoint } from '../lib/endpoint';
import { Exports } from '../airtable/index';
import { isManager } from '../lib/access';

export default createEndpoint({
  description: 'Deletes a compensation record from the Exports table. Managers can delete any record; everyone else only records linked to their own SHX Team row.',
  authenticated: true,
  inputSchema: z.object({
    recordId: z.string(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const record = await Exports.findOne({ id: input.recordId });
    if (!record) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Compensation record not found' });
    }

    if (!isManager(context.user)) {
      const owners = ([] as string[]).concat((record.shx as string[] | string | undefined) ?? []);
      if (!owners.includes(context.user.id)) {
        throw new ApiError({ code: 'FORBIDDEN', message: 'You can only delete your own compensation records.' });
      }
    }

    await Exports.delete({ id: input.recordId });
    return { success: true, deletedRecordId: input.recordId };
  },
});
