import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { reclaimLeadsFor } from '../leadLoader/reclaim';

/** Team page → "FORCE Reclaim": every NEW lead, any age. dryRun previews. Manager-only via MANAGER_ONLY_ENDPOINTS. */
export default createEndpoint({
  description: "Force-reclaims ALL of a Pro's NEW leads regardless of age (the Airtable FORCE Reclaim button). dryRun previews without writing.",
  authenticated: true,
  inputSchema: z.object({ proId: z.string(), dryRun: z.boolean() }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const u = context.user as Record<string, any>;
    return reclaimLeadsFor({
      mode: 'force',
      proId: input.proId!,
      dryRun: input.dryRun!,
      actor: { id: u.id, name: String(u.displayName || u.proName || u.name || u.email), email: u.email },
    });
  },
});
