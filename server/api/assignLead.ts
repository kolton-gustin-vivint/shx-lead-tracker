import { z } from 'zod';
import { ApiError, createEndpoint } from '../lib/endpoint';
import { NisLeads, ShxTeam } from '../airtable/index';

/**
 * Assigns an unassigned lead to a Pro. Writes the same fields the Lead
 * Tracker's lead form writes on a first assignment: Assigned Pro, plus Date
 * Assigned (today, UTC date). Airtable's formulas/automations take it from
 * there.
 */
export default createEndpoint({
  description: 'Assigns an unassigned lead to a Pro (sets Assigned Pro and Date Assigned).',
  authenticated: true,
  inputSchema: z.object({
    leadId: z.string(),
    proId: z.string(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input }) => {
    const [lead, pro] = await Promise.all([
      NisLeads.findOne({ id: input.leadId }),
      ShxTeam.findOne({ id: input.proId }),
    ]);
    if (!lead) throw new ApiError({ code: 'NOT_FOUND', message: 'Lead not found' });
    if (!pro || pro.status === 'Inactive') {
      throw new ApiError({ code: 'BAD_REQUEST', message: 'That rep is not an active team member' });
    }

    const current = ([] as string[]).concat((lead.assignedPro as string[] | string | undefined) ?? []);
    if (current.length > 0) {
      // Someone else got to it first, or the list is stale.
      throw new ApiError({ code: 'CONFLICT', message: 'This lead is already assigned. Refresh the list.' });
    }

    await NisLeads.update({
      id: input.leadId,
      record: {
        assignedPro: [input.proId],
        dateAssigned: new Date().toISOString().split('T')[0],
      },
    });
    return { success: true };
  },
});
