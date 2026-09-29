import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { ShxTeam, AuditLog } from '../airtable/index';

export default createEndpoint({
  description: 'Logs an audit event by finding the user pro and creating an audit log entry with the action, details, and lead information',
  authenticated: true,
  inputSchema: z.object({
    action: z.any(),
    leadId: z.string().optional(),
    details: z.string().optional(),
    userName: z.string(),
    userEmail: z.string(),
  }),
  outputSchema: z.any(),
  execute: async ({ input }) => {
    const findUserPro = await ShxTeam.findOne({
      filters: { email: input.userEmail },
    });

    const processedDetails = input.details
      ? `${input.details}${input.leadId ? ` (Lead ID: ${input.leadId})` : ''}`
      : input.leadId
      ? `Lead ID: ${input.leadId}`
      : undefined;

    const assignedPro = findUserPro?.id ? [findUserPro.id] : undefined;

    const createAuditLog = await AuditLog.create({
      record: {
        actions: input.action,
        assignedPro,
        details: processedDetails,
      },
    });

    return { success: true, auditId: createAuditLog.id };
  },
});
