import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint.js';
import { NisLeads } from '../airtable/index.js';

// Paginate through all records matching filters and return the count.
// Each call runs as an independent async stream — callers run these in parallel.
async function paginateCount(filters: Record<string, any>): Promise<number> {
  let count = 0;
  let offset: string | undefined;
  let hasMore = true;
  while (hasMore) {
    const batch = await NisLeads.findAll({ filters, offset, limit: 100 });
    count += batch.records.length;
    hasMore = batch.hasMore;
    offset = batch.offset;
  }
  return count;
}

export default createEndpoint({
  description: `Returns lead statistics using parallel filtered queries per status bucket.
  Previously fetched ALL leads sequentially (50+ API calls for large bases). Now runs
  ~7 targeted paginators simultaneously via Promise.all — wall-clock time equals the
  slowest single bucket, not the sum of all buckets.`,
  authenticated: true,
  inputSchema: z.object({
    assignedPro: z.string().optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input }) => {
    const repFilter = input.assignedPro
      ? { assignedPro: { contains: input.assignedPro } }
      : {};

    const [
      totalLeads,
      newLeads,
      inProgressLeads,
      allClosedLeads,
      soldScheduledLeads,
      soldInstalledLeads,
      unassignedLeads,
    ] = await Promise.all([
      paginateCount(repFilter),
      paginateCount({ ...repFilter, status: 'NEW' }),
      paginateCount({ ...repFilter, status: { contains: 'IN-PROGRESS' } }),
      paginateCount({ ...repFilter, status: { contains: 'CLOSED' } }),
      paginateCount({ ...repFilter, status: 'CLOSED | Sold/Scheduled' }),
      paginateCount({ ...repFilter, status: 'CLOSED | Installed' }),
      input.assignedPro
        ? Promise.resolve(0)
        : paginateCount({ leadType: 'Ready to Assign' }),
    ]);

    const soldLeads = soldScheduledLeads + soldInstalledLeads;
    const closedLeads = allClosedLeads - soldLeads;

    return {
      totalLeads,
      newLeads,
      inProgressLeads,
      closedLeads,
      soldLeads,
      unassignedLeads,
    };
  },
});
