import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { Exports } from '../airtable/index';

export default createEndpoint({
  description: 'Deletes a compensation record from the Exports table',
  authenticated: true,
  inputSchema: z.object({
    recordId: z.string(),
  }),
  outputSchema: z.any(),
  execute: async ({ input }) => {
    await Exports.delete({ id: input.recordId });
    return { success: true, deletedRecordId: input.recordId };
  },
});
