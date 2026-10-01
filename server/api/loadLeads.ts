import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { loadLeadsForPro } from '../leadLoader/loadForPro';

/**
 * Team page → "Load Leads": loads up to the Pro's own Daily New Lead Cap (the
 * Airtable "Single-Pro Loader" button). dryRun previews without writing.
 * Manager-only via MANAGER_ONLY_ENDPOINTS.
 */
export default createEndpoint({
  description: "Loads leads onto a Pro up to their Daily New Lead Cap (the Airtable Single-Pro Loader button). dryRun previews without writing.",
  authenticated: true,
  inputSchema: z.object({
    proId: z.string(),
    localDate: z.string(),
    dryRun: z.boolean(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const u = context.user as Record<string, any>;
    return loadLeadsForPro({
      proId: input.proId!,
      localDate: input.localDate!,
      dryRun: input.dryRun!,
      action: 'Load Leads',
      actor: { id: u.id, name: String(u.displayName || u.proName || u.name || u.email), email: u.email },
    });
  },
});
