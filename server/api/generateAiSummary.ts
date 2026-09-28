import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { NisLeads, Activities } from '../airtable';
import { OpenAIGpt54 } from '../lib/openai';

export default createEndpoint({
  description: "Generates an AI-powered summary of a lead's interaction history using OpenAI",
  authenticated: true,
  inputSchema: z.object({
    leadId: z.string(),
  }),
  outputSchema: z.any(),
  execute: async ({ input }) => {
    // Fetch lead and activities in parallel — two independent queries
    const [fetchLead, fetchActivities] = await Promise.all([
      NisLeads.findOne({ id: input.leadId }),
      Activities.findAll({
        filters: { relatedLead: { contains: input.leadId } },
        limit: 100,
      }),
    ]);

    const activities = fetchActivities.records;
    const totalInteractions = activities.length;
    const customerName = fetchLead?.customerName || 'Unknown';
    const leadStatus = fetchLead?.status || 'Unknown';

    const activitiesText = activities
      .map(act => `${act.date || 'Unknown date'} - ${act.type}: ${act.content}`)
      .join('\n');

    const prompt = `Summarize this lead's interaction history. Provide a brief summary and list 3-5 key points.
      
Lead: ${customerName}
Status: ${leadStatus}
Total Interactions: ${totalInteractions}

Interaction History:
${activitiesText}

Provide your response in this format:
SUMMARY: [2-3 sentence overview of the lead's journey]
KEY POINTS:
- [Key point 1]
- [Key point 2]
- [Key point 3]`;

    const systemPrompt = 'You are a sales analyst helping field sales representatives understand their leads better. Provide concise, actionable summaries that highlight important patterns and opportunities.';

    return await OpenAIGpt54.generateText({ systemPrompt, prompt });
  },
});
