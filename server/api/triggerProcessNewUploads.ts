import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint.js';
import { ControlPanel } from '../airtable/index.js';

export default createEndpoint({
  description: 'Triggers the Process New Uploads automation by toggling the processNewUploads field in the Control Panel',
  authenticated: true,
  inputSchema: z.object({}).optional(),
  outputSchema: z.any(),
  execute: async () => {
    const findControlPanel = await ControlPanel.findAll({ limit: 1 });
    const controlPanelId = findControlPanel.records[0]?.id;

    await ControlPanel.update({
      record: { processNewUploads: true },
      id: controlPanelId,
    });

    return { success: true, message: 'Process New Uploads automation triggered successfully' };
  },
});
