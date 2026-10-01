import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { loadLeadsForPro } from '../leadLoader/loadForPro';

/** Team page → "Load NEW CAP". Manager-only via MANAGER_ONLY_ENDPOINTS. */
export default createEndpoint({
  description: 'Loads leads onto a Pro with a one-off daily cap (the Airtable "Load New Cap" button). dryRun previews without writing.',
  authenticated: true,
  inputSchema: z.object({
    proId: z.string(),
    cap: z.number().int().min(1).max(500),
    localDate: z.string(),
    dryRun: z.boolean(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const u = context.user as Record<string, any>;
    return loadLeadsForPro({
      proId: input.proId!,
      cap: input.cap!,
      localDate: input.localDate!,
      dryRun: input.dryRun!,
      action: 'Load NEW CAP',
      actor: { id: u.id, name: String(u.displayName || u.proName || u.name || u.email), email: u.email },
    });
  },
});
