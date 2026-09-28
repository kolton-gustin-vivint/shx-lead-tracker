import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { NisLeads, ControlPanel } from '../airtable';

export default createEndpoint({
  description: 'Recomputes pipeline counts by paginating NIS Leads, then saves the results to the Control Panel record for instant future reads via getAdminStats.',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    unassignedCount: z.number(),
    rawIntakeCount: z.number(),
  }),
  execute: async () => {
    // Run both counts in parallel — independent queries
    const [unassignedCount, rawIntakeCount] = await Promise.all([
      // Count leads with leadType = 'Ready to Assign'
      (async () => {
        let count = 0;
        let offset: string | undefined = undefined;
        let hasMore = true;
        while (hasMore) {
          const batch = await NisLeads.findAll({
            filters: { leadType: 'Ready to Assign' },
            offset,
            limit: 100,
          });
          count += batch.records.length;
          if (batch.hasMore && !batch.offset) break;
          hasMore = batch.hasMore;
          offset = batch.offset;
        }
        return count;
      })(),

      // Count records with no leadType (raw intake queue)
      // Raw records appear newest-first; if none in page 1, queue is empty
      (async () => {
        const batch = await NisLeads.findAll({ limit: 100 });
        return batch.records.filter(r => !r.leadType).length;
      })(),
    ]);

    // Save computed counts back to Control Panel for instant future reads
    const panel = await ControlPanel.findOne({});
    if (panel) {
      await ControlPanel.update({
        id: panel.id,
        record: {
          unassignedLeadsCount: unassignedCount,
          rawIntakeCount: rawIntakeCount,
        },
      });
    }

    return { unassignedCount, rawIntakeCount };
  },
});
