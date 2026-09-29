import { enrichCurrentUser } from '../lib/currentUser.js';
import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint.js';
import { SelfGenTime, ShxTeam } from '../airtable/index.js';

/** Parses "8:00 am - 8:30 am" style time slots into minutes-since-midnight for sorting. */
function parseSlotMinutes(slot?: string): number {
  if (!slot) return 0;
  const match = slot.match(/^(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toLowerCase();
  if (period === 'pm' && hours !== 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export default createEndpoint({
  description: 'Fetches Self-Gen Time activities for the current user (Pro) or filtered by pro (Manager). Returns open and completed lists separately.',
  authenticated: true,
  inputSchema: z.object({
    proId: z.string().optional(),
    completed: z.boolean().optional(),
    limit: z.number().optional(),
    offset: z.string().optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await enrichCurrentUser(context);
    const isManager = context.user.role === 'Manager';
    const limit = input.limit || 100;

    // Determine which pro's activities to fetch
    const targetProId = isManager ? input.proId : context.user.id;

    const filters: Record<string, any> = {};
    if (targetProId) {
      filters.shxPro = { contains: targetProId };
    }
    if (input.completed !== undefined) {
      filters.completed = input.completed;
    }

    const result = await SelfGenTime.findAll({
      filters,
      offset: input.offset,
      limit,
    });

    const activities = result.records.map(r => ({
      id: r.id,
      selfGenId: r.selfGenId,
      shxPro: Array.isArray(r.shxPro) ? r.shxPro : r.shxPro ? [r.shxPro] : undefined,
      shxProEmail: r.shxProEmail,
      dateOfActivity: r.dateOfActivity,
      timeSlot: r.timeSlot,
      activityType: r.activityType,
      completed: r.completed || false,
      notes: r.notes,
      attachments: r.attachments,
      dateCreated: r.dateCreated,
    }));

    // Sort chronologically: date ascending, then time slot ascending (AM → PM)
    activities.sort((a, b) => {
      // Compare dates first
      const dateA = a.dateOfActivity ? new Date(a.dateOfActivity).getTime() : 0;
      const dateB = b.dateOfActivity ? new Date(b.dateOfActivity).getTime() : 0;
      if (dateA !== dateB) return dateA - dateB;

      // Same date — compare time slots by parsing the start time
      return parseSlotMinutes(a.timeSlot) - parseSlotMinutes(b.timeSlot);
    });

    return {
      activities,
      offset: result.offset,
      hasMore: result.hasMore,
    };
  },
});
