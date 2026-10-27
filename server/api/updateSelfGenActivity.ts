import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { SelfGenTime } from '../airtable/index';

export default createEndpoint({
  description: 'Updates an existing Self-Gen Time activity record',
  authenticated: true,
  inputSchema: z.object({
    id: z.string(),
    dateOfActivity: z.string().optional(),
    timeSlot: z.string().optional(),
    activityType: z.array(z.string()).min(1).max(2).optional(),
    notes: z.string().optional(),
    completed: z.boolean().optional(),
    /** Existing attachments to keep; any others on the record are removed. New files are added via /api/upload. */
    keepAttachmentIds: z.array(z.string()).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input }) => {
    const record: Record<string, any> = {};
    if (input.dateOfActivity !== undefined) record.dateOfActivity = input.dateOfActivity;
    if (input.timeSlot !== undefined) record.timeSlot = input.timeSlot;
    if (input.activityType !== undefined) record.activityType = input.activityType;
    if (input.notes !== undefined) record.notes = input.notes;
    if (input.completed !== undefined) record.completed = input.completed;
    if (input.keepAttachmentIds !== undefined) {
      record.attachments = input.keepAttachmentIds.map(id => ({ id }));
    }

    await SelfGenTime.update({ id: input.id, record });
    return { id: input.id, success: true };
  },
});
