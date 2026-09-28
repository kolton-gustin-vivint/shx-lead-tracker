import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { NisLeads, Activities } from '../airtable';
import { OpenAIGpt54 } from '../lib/openai';

export default createEndpoint({
  description: 'Analyzes a lead and suggests the best next action for a sales representative using AI',
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

    const leadStatus = fetchLead?.status || 'Unknown';
    const customerName = fetchLead?.customerName || 'Unknown';
    const daysSinceLastInteraction = fetchLead?.daysSinceLastInteraction || 0;
    const totalInteractions = fetchActivities.records.length;

    const recentActivities = fetchActivities.records
      .slice(0, 5)
      .map(act => `${act.type}: ${act.content}`)
      .join('\n');

    const prompt = `You are a sales assistant helping a field sales representative. Analyze this lead and suggest the best next action.
      
Lead Information:
- Customer: ${customerName}
- Status: ${leadStatus}
- Days since last interaction: ${daysSinceLastInteraction}
- Total interactions: ${totalInteractions}

Recent Activities:
${recentActivities || 'No recent activities'}

Based on this information, suggest ONE specific next action the pro should take (e.g., call, text, schedule appointment, send follow-up, close lead). Keep your suggestion concise and actionable. Format your response as:

SUGGESTION: [One specific action]
REASONING: [Brief explanation why this is the best next step]`;

    const systemPrompt = 'You are an expert sales coach helping field sales representatives prioritize and take action on leads. Be direct, practical, and action-oriented.';

    return await OpenAIGpt54.generateText({ systemPrompt, prompt });
  },
});
