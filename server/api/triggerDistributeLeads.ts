import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { ControlPanel } from '../airtable/index';

export default createEndpoint({
  description: 'Triggers the Distribute Leads automation by toggling the runDistribution field in the Control Panel',
  authenticated: true,
  inputSchema: z.object({}).optional(),
  outputSchema: z.any(),
  execute: async () => {
    const findControlPanel = await ControlPanel.findAll({ limit: 1 });
    const controlPanelId = findControlPanel.records[0]?.id;

    await ControlPanel.update({
      record: { runDistribution: true },
      id: controlPanelId,
    });

    return { success: true, message: 'Distribute Leads automation triggered successfully' };
  },
});
