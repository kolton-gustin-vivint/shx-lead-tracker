import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { ShxTeam } from '../airtable/index';
import type { ShxTeamRecordType } from '../airtable/index';
import { isManager } from '../lib/access';

export default createEndpoint({
  description: 'Retrieves all active sales representatives. Filters inactive reps at the query level and fetches remaining pages in parallel after the first batch.',
  authenticated: true,
  inputSchema: z.object({}).optional(),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    // Every signed-in user needs the rep list (names on leads, dropdowns), but
    // what each rep has earned is for managers only.
    const canSeeComp = isManager(context.user);

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
      runningCompTotal: canSeeComp ? record.runningCompTotal : undefined,
    }));

    return { pros };
  },
});
