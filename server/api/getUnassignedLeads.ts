import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { NisLeads } from '../airtable/index';
import { leadSearchAny } from '../utils/leadUtils';

/**
 * One page of leads waiting to be assigned (Lead Type = "Ready to Assign").
 * `offset` is Airtable's cursor from the previous page. Search runs inside the
 * Airtable formula, so it covers every unassigned lead, not just this page.
 */
export default createEndpoint({
  description: 'Returns one page of unassigned leads (Lead Type = Ready to Assign), with optional search.',
  authenticated: true,
  inputSchema: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.string().optional(),
    search: z.string().optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input }) => {
    const page = await NisLeads.findAll({
      filters: { leadType: 'Ready to Assign' },
      searchAny: leadSearchAny(input.search),
      offset: input.offset,
      limit: input.limit ?? 50,
    });

    return {
      leads: page.records.map(r => ({
        id: r.id,
        customerName: r.customerName ?? '',
        opportunityName: r.opportunityName ?? '',
        city: r.customerCity ?? '',
        state: r.customerState ?? '',
        zip: r.customerZip ?? '',
        district: r.customerDistrict ?? '',
        salesOffice: r.salesOffice ?? '',
        leadSource: r.leadSource ?? '',
        dateAdded: r.dateAdded ?? null,
      })),
      offset: page.offset,
      hasMore: page.hasMore,
    };
  },
});
