import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';

// Complete predefined status options matching the NIS Leads schema.
// This is the authoritative list — no Airtable calls needed.
const PREDEFINED_STATUSES = [
  "NEW",
  "IN-PROGRESS | No Answer",
  "IN-PROGRESS | Follow-Up",
  "IN-PROGRESS | Appointment Set",
  "CLOSED | Not Interested",
  "CLOSED | Blocked by Objection(s)",
  "CLOSED | Appointment Set, No Sale",
  "CLOSED | Missing Contact Info",
  "CLOSED | Already Sold",
  "CLOSED | Sold/Scheduled",
  "CLOSED | Installed",
  "CLOSED | Duplicate",
  "CLOSED | Admin",
  "CLOSED | Lead Outside Market",
];

export default createEndpoint({
  description: 'Returns all available lead status options from a predefined list. No Airtable calls — instant response.',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    statusOptions: z.array(z.string()),
  }),
  execute: async () => {
    return {
      statusOptions: PREDEFINED_STATUSES.filter(s => s !== 'REMOVE | Unassign Lead').sort(),
    };
  },
});
