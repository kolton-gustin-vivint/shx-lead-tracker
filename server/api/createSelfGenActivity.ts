import { enrichCurrentUser } from '../lib/currentUser.js';
import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint.js';
import { SelfGenTime } from '../airtable/index.js';

export default createEndpoint({
  description: 'Creates a new Self-Gen Time activity record. Managers can optionally specify a proId to log on behalf of another Pro.',
  authenticated: true,
  inputSchema: z.object({
    dateOfActivity: z.string(),
    timeSlot: z.string(),
    activityType: z.array(z.string()).min(1).max(2),
    notes: z.string().optional(),
    attachments: z.array(z.object({
      url: z.string(),
      filename: z.string(),
    })).optional(),
    proId: z.string().optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await enrichCurrentUser(context);
    // Managers can specify a target Pro; non-managers always self-link
    const isManager = context.user.role === 'Manager';
    const targetProId = isManager && input.proId ? input.proId : context.user.id;

    const record: Record<string, any> = {
      shxPro: [targetProId],
      dateOfActivity: input.dateOfActivity,
      timeSlot: input.timeSlot,
      activityType: input.activityType,
      notes: input.notes,
      completed: false,
    };

    if (input.attachments && input.attachments.length > 0) {
      record.attachments = input.attachments.map(a => ({
        url: a.url,
        filename: a.filename,
      }));
    }

    const created = await SelfGenTime.create({ record });
    return {
      id: created.id,
      success: true,
    };
  },
});
