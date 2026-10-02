import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { offboardPro } from '../leadLoader/offboard';

/** Team page → "Offboard Pro". dryRun previews. Manager-only via MANAGER_ONLY_ENDPOINTS. */
export default createEndpoint({
  description: 'Offboards a Pro (the Airtable Offboard Pro button): returns their NEW leads to the pool, then sets them Inactive with both caps 0. dryRun previews.',
  authenticated: true,
  inputSchema: z.object({ proId: z.string(), dryRun: z.boolean() }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const u = context.user as Record<string, any>;
    return offboardPro({
      proId: input.proId!,
      dryRun: input.dryRun!,
      actor: { id: u.id, name: String(u.displayName || u.proName || u.name || u.email), email: u.email },
    });
  },
});
