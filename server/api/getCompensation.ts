import { enrichCurrentUser } from '../lib/currentUser.js';
import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint.js';
import { Exports } from '../airtable/index.js';

export default createEndpoint({
  description: 'Gets compensation records from the Exports table based on user role and permissions. Uses context.user directly — no redundant user lookup.',
  authenticated: true,
  inputSchema: z.object({
    limit: z.number().optional(),
    repId: z.string().optional(),
    offset: z.string().optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await enrichCurrentUser(context);
    const isManager = context.user.role === 'Manager';
    const limit = input.limit || 50;

    // Pros can only see their own records; managers see all or filter by repId
    const filterRepId = isManager
      ? (input.repId || undefined)
      : context.user.id;

    const result = filterRepId
      ? await Exports.findAll({
          filters: { shx: { contains: filterRepId } },
          offset: input.offset,
          limit,
        })
      : await Exports.findAll({
          offset: input.offset,
          limit,
        });

    const compensationRecords = result.records.map(record => ({
      id: record.id,
      badgeId: record.badgeId,
      createdTime: record.createdTime,
      shxName: record.shxName,
      shxEmail: record.shxEmail,
      compensationDetails: record.compensationDetails,
      shxCompensationTotal: record.shxCompensationTotal,
      customerName: record.customerName,
    }));

    return {
      compensationRecords,
      offset: result.offset,
      hasMore: result.hasMore,
    };
  },
});
