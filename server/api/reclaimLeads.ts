import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { reclaimStaleLeads } from '../leadLoader/reclaim';

/** Team page → "Reclaim Leads". dryRun previews without writing. Manager-only via MANAGER_ONLY_ENDPOINTS. */
export default createEndpoint({
  description: "Reclaims a Pro's leads that are still NEW more than 14 days after assignment (the Airtable Reclaim Leads button). dryRun previews without writing.",
  authenticated: true,
  inputSchema: z.object({ proId: z.string(), dryRun: z.boolean() }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const u = context.user as Record<string, any>;
    return reclaimStaleLeads({
      proId: input.proId!,
      dryRun: input.dryRun!,
      actor: { id: u.id, name: String(u.displayName || u.proName || u.name || u.email), email: u.email },
    });
  },
});
