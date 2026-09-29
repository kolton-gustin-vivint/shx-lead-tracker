import { enrichCurrentUser } from '../lib/currentUser';
import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { ShxTeam } from '../airtable/index';

export default createEndpoint({
  description: 'Gets running compensation totals for SHX reps based on user permissions. Uses context.user directly — no redundant user lookup.',
  authenticated: true,
  inputSchema: z.object({
    repIds: z.array(z.string()).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await enrichCurrentUser(context);
    const isManager = context.user.role === 'Manager';
    const hasSpecificRepIds = Boolean(input.repIds && input.repIds.length > 0);

    const formatTotals = (records: Awaited<ReturnType<typeof ShxTeam.findAll>>['records']) => {
      const totals = records
        .filter(rep => rep.role !== 'Manager')
        .map(rep => ({
          repId: rep.id,
          repName: rep.proName || rep.displayName || 'Unknown',
          repEmail: rep.email || '',
          runningCompTotal: rep.runningCompTotal || 0,
        }));
      return {
        totals,
        grandTotal: totals.reduce((sum, r) => sum + r.runningCompTotal, 0),
      };
    };

    if (isManager && hasSpecificRepIds) {
      const result = await ShxTeam.findAll({
        filters: { id: { in: input.repIds } as any },
      });
      return formatTotals(result.records);
    }

    if (isManager) {
      const result = await ShxTeam.findAll({});
      return formatTotals(result.records);
    }

    // Pro — show only their own total
    const result = await ShxTeam.findAll({
      filters: { id: context.user.id } as any,
    });
    return formatTotals(result.records);
  },
});
