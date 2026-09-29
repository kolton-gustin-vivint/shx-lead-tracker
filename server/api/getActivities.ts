import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint.js';
import { Activities, NisLeads } from '../airtable/index.js';

export default createEndpoint({
  description: 'Retrieves activities for a specific lead from the Activities table',
  authenticated: true,
  inputSchema: z.object({
    leadId: z.string(),
    limit: z.number().optional(),
    offset: z.string().optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input }) => {
    // Fetch the lead to get its linked activity IDs from notesInteractions
    const lead = await NisLeads.findOne({ id: input.leadId });

    const activityIds = lead?.notesInteractions;

    if (!activityIds || (Array.isArray(activityIds) && activityIds.length === 0)) {
      return { activities: [], offset: undefined, hasMore: false };
    }

    const ids = Array.isArray(activityIds) ? activityIds : [activityIds];

    // Apply limit if provided
    const limit = input.limit || 50;
    const slicedIds = ids.slice(0, limit);

    // Fetch each activity by ID
    const activityResults = await Promise.all(
      slicedIds.map((id) => Activities.findOne({ id: id as string }))
    );

    const processedActivities = activityResults
      .filter((record): record is NonNullable<typeof record> => record != null)
      .map((record) => ({
        id: record.id,
        activityId: record.activityId,
        date: record.date,
        type: record.type,
        content: record.content,
        relatedLead: Array.isArray(record.relatedLead)
          ? record.relatedLead
          : record.relatedLead
          ? [record.relatedLead]
          : undefined,
        assignedPro: Array.isArray(record.assignedPro)
          ? record.assignedPro
          : record.assignedPro
          ? [record.assignedPro]
          : undefined,
        daysSinceInteraction: record.daysSinceInteraction,
      }));

    return {
      activities: processedActivities,
      offset: undefined,
      hasMore: ids.length > limit,
    };
  },
});
