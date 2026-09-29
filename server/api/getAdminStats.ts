import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint.js';
import { ControlPanel } from '../airtable/index.js';

export default createEndpoint({
  description: 'Returns cached pipeline counts from the Control Panel record — instant single API call. Use refreshAdminStats to recompute and update these values.',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    unassignedCount: z.number(),
    rawIntakeCount: z.number(),
    isCached: z.boolean(),
  }),
  execute: async () => {
    const panel = await ControlPanel.findOne({});
    return {
      unassignedCount: panel?.unassignedLeadsCount ?? 0,
      rawIntakeCount: panel?.rawIntakeCount ?? 0,
      isCached: true,
    };
  },
});
