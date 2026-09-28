import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { ControlPanel } from '../airtable';

export default createEndpoint({
  description: 'Triggers the Mark Leftover Leads (post-Distribution) automation by toggling the markLeadLeftovers field in the Control Panel',
  authenticated: true,
  inputSchema: z.object({}).optional(),
  outputSchema: z.any(),
  execute: async () => {
    const findControlPanel = await ControlPanel.findAll({ limit: 1 });
    const controlPanelId = findControlPanel.records[0]?.id;

    await ControlPanel.update({
      record: { markLeadLeftovers: true },
      id: controlPanelId,
    });

    return {
      success: true,
      message: 'Mark Leftover Leads automation triggered successfully',
    };
  },
});
