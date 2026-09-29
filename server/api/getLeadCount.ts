import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { NisLeads } from '../airtable/index';
import type { NisLeadsRecordType } from '../airtable/index';

export default createEndpoint({
  description: 'Gets the total count of leads matching the specified filters including status, assigned pro, unassigned only flag, and search term',
  authenticated: true,
  inputSchema: z.object({
    search: z.string().optional(),
    status: z.string().optional(),
    assignedPro: z.string().optional(),
    unassignedOnly: z.boolean().optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input }) => {
    const statusFilter = input.status;
    const leadTypeFilter = input.unassignedOnly ? 'Ready to Assign' : undefined;
    // Only build the assignedPro filter if a value is actually provided
    const assignedProFilter = input.assignedPro ? { contains: input.assignedPro } : undefined;

    // Paginate through all matching records
    let allRecords: NisLeadsRecordType[] = [];
    let offset: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const batch = await NisLeads.findAll({
        filters: {
          status: statusFilter,
          assignedPro: assignedProFilter,
          leadType: leadTypeFilter,
        },
        offset,
        limit: 100,
      });

      allRecords = allRecords.concat(batch.records);
      hasMore = batch.hasMore;
      offset = batch.offset;
    }

    // Apply in-memory search if provided
    let filteredRecords = allRecords;
    if (input.search && input.search.trim()) {
      const searchTerm = input.search.toLowerCase().trim();
      filteredRecords = allRecords.filter(record => {
        const searchFields = [
          record.customerName,
          record.opportunityName,
          record.customerPhone,
          record.customerEmail,
          record.customerCity,
          record.customerState,
          record.leadDetails,
        ];
        return searchFields.some(field =>
          field && field.toString().toLowerCase().includes(searchTerm)
        );
      });
    }

    return { totalCount: filteredRecords.length };
  },
});
