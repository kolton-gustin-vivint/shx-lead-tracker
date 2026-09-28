import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { loginEvents } from '../lib/db';
import { ShxTeam } from '../airtable';

export default createEndpoint({
  description: 'Returns a login report for managers — last login per team member plus recent login event counts.',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    teamLogins: z.array(z.object({
      airtableId: z.string(),
      proName: z.string(),
      displayName: z.string(),
      email: z.string(),
      role: z.string(),
      status: z.string(),
      lastLogin: z.string().nullable(),
      loginCount30d: z.number(),
    })),
  }),
  execute: async () => {
    // Get all non-inactive team members from Airtable
    let allRecords: any[] = [];
    const first = await ShxTeam.findAll({ filters: { status: { not: 'Inactive' } }, limit: 100 });
    allRecords = [...first.records];
    let nextOffset = first.offset;
    while (first.hasMore && nextOffset) {
      const batch = await ShxTeam.findAll({ filters: { status: { not: 'Inactive' } }, offset: nextOffset, limit: 100 });
      allRecords = allRecords.concat(batch.records);
      nextOffset = batch.hasMore ? batch.offset : undefined;
    }

    // Get login counts from the local store for last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const countMap = new Map<string, number>();
    for (const row of loginEvents.countsSince(thirtyDaysAgo)) {
      countMap.set(String(row.airtableRecordId), Number(row.cnt));
    }

    const teamLogins = allRecords.map(r => ({
      airtableId: r.id,
      proName: r.proName ?? '',
      displayName: r.displayName ?? '',
      email: r.email ?? '',
      role: r.role ?? '',
      status: r.status ?? '',
      lastLogin: r.lastLogin ?? null,
      loginCount30d: countMap.get(r.id) ?? 0,
    }));

    // Sort: most recent login first, never-logged-in at bottom
    teamLogins.sort((a, b) => {
      if (!a.lastLogin && !b.lastLogin) return 0;
      if (!a.lastLogin) return 1;
      if (!b.lastLogin) return -1;
      return new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime();
    });

    return { teamLogins };
  },
});
