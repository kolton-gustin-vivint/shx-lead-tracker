import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { revertPro } from '../leadLoader/revertPro';

/** Team page → "Revert Pro". dryRun previews. Manager-only via MANAGER_ONLY_ENDPOINTS. */
export default createEndpoint({
  description: 'Sets a Pro to Status Reverted with a Reversion Date (the Airtable Revert Pro button). Leads are not touched. dryRun previews.',
  authenticated: true,
  inputSchema: z.object({ proId: z.string(), dryRun: z.boolean() }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const u = context.user as Record<string, any>;
    return revertPro({
      proId: input.proId!,
      dryRun: input.dryRun!,
      actor: { id: u.id, name: String(u.displayName || u.proName || u.name || u.email), email: u.email },
    });
  },
});
