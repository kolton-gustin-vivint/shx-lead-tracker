import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { NisLeads } from '../airtable';

export default createEndpoint({
  description: 'Updates a lead record in the NIS Leads table with the provided field values',
  authenticated: true,
  inputSchema: z.object({
    id: z.string(),
    status: z.string().optional(),
    assignedPro: z.array(z.string()).optional(),
    closeReason: z.string().optional(),
    leadDetails: z.string().optional(),
    dateAssigned: z.string().optional(),
    customerName: z.string().optional(),
    customerEmail: z.string().optional(),
    customerPhone: z.string().optional(),
    opportunityName: z.string().optional(),
    assignmentNeeded: z.boolean().optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input }) => {
    // Explicitly map input fields to NisLeads fields — never spread raw input
    const record: Record<string, any> = {};
    if (input.status !== undefined) record.status = input.status;
    if (input.assignedPro !== undefined) record.assignedPro = input.assignedPro;
    if (input.closeReason !== undefined) record.closeReason = input.closeReason;
    if (input.leadDetails !== undefined) record.leadDetails = input.leadDetails;
    if (input.dateAssigned !== undefined) record.dateAssigned = input.dateAssigned;
    if (input.customerName !== undefined) record.customerName = input.customerName;
    if (input.customerEmail !== undefined) record.customerEmail = input.customerEmail;
    if (input.customerPhone !== undefined) record.customerPhone = input.customerPhone;
    if (input.opportunityName !== undefined) record.opportunityName = input.opportunityName;
    if (input.assignmentNeeded !== undefined) record.assignmentNeeded = input.assignmentNeeded;

    await NisLeads.update({ id: input.id, record });
    return { id: input.id, success: true };
  },
});
