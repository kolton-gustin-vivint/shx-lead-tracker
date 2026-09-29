import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint.js';
import { ShxTeam } from '../airtable/index.js';
import type { ShxTeamRecordType } from '../airtable/index.js';

export default createEndpoint({
  description: 'Retrieves all active sales representatives. Filters inactive reps at the query level and fetches remaining pages in parallel after the first batch.',
  authenticated: true,
  inputSchema: z.object({}).optional(),
  outputSchema: z.any(),
  execute: async () => {
    // First batch — also tells us if there are more pages
    const first = await ShxTeam.findAll({
      filters: { status: { not: 'Inactive' } },
      limit: 100,
    });

    let allRecords: ShxTeamRecordType[] = [...first.records];

    if (first.hasMore && first.offset) {
      let offsets: (string | undefined)[] = [first.offset];

      while (offsets.length > 0) {
        const batches = await Promise.all(
          offsets.map(o =>
            ShxTeam.findAll({
              filters: { status: { not: 'Inactive' } },
              offset: o,
              limit: 100,
            })
          )
        );

        const nextOffsets: string[] = [];
        for (const batch of batches) {
          allRecords = allRecords.concat(batch.records);
          if (batch.hasMore && batch.offset) {
            nextOffsets.push(batch.offset);
          }
        }
        offsets = nextOffsets;
      }
    }

    const pros = allRecords.map(record => ({
      id: record.id,
      proId: record.repId,
      proName: record.proName,
      displayName: record.displayName,
      email: record.email,
      role: record.role,
      status: record.status,
      activeLeadCount: record.assignedActiveLeads,
      todaysLeads: record.todaysLeads,
      dailyCap: record.dailyNewLeadCap,
      activeCap: record.activeLeadCap,
      runningCompTotal: record.runningCompTotal,
    }));

    return { pros };
  },
});
