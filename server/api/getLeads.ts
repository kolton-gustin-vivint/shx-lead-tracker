import { enrichCurrentUser } from '../lib/currentUser';
import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { NisLeads, ShxTeam } from '../airtable/index';
import type { NisLeadsRecordType } from '../airtable/index';
import { passesSearch, mapLead, leadSearchAny } from '../utils/leadUtils';

export default createEndpoint({
  description: `Returns ACTIVE leads only (NEW + IN-PROGRESS — never CLOSED).

  FOR PRO USERS (assignedPro provided): Uses context.user.assignedLeads directly when the
  requesting user is the assigned pro (saves one API call). Fetches all chunks in PARALLEL
  instead of sequentially for a dramatic speed improvement. Returns all matching active leads
  in a single response, or one page of them (numeric index offset) when a limit is provided.

  FOR MANAGERS (no assignedPro): Queries NIS Leads with leadType: 'Active', paginated by limit/offset.
  Search is pushed into the Airtable formula so it covers the whole table, not just the current page.`,
  authenticated: true,
  inputSchema: z.object({
    limit: z.number().optional(),
    offset: z.string().optional(),
    search: z.string().optional(),
    status: z.string().optional(),
    assignedPro: z.string().optional(),
    unassignedOnly: z.boolean().optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await enrichCurrentUser(context);
    const ACTIVE_BUCKETS = ['NEW', 'IN-PROGRESS'];
    const statusBucket = input.status && ACTIVE_BUCKETS.includes(input.status) ? input.status : undefined;
    const exactStatus = input.status && !ACTIVE_BUCKETS.includes(input.status) ? input.status : undefined;

    const matchesStatus = (record: NisLeadsRecordType): boolean => {
      const s = record.status || '';
      if (s.startsWith('CLOSED')) return false;
      if (!input.status) return true;
      if (statusBucket) return s.startsWith(statusBucket);
      if (exactStatus) return s === exactStatus;
      return true;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // PRO VIEW — fetch all assigned lead chunks in PARALLEL (not sequential)
    // ─────────────────────────────────────────────────────────────────────────
    if (input.assignedPro) {
      let allAssignedIds: string[];

      if (input.assignedPro === context.user.id) {
        // User is viewing their own leads — use the synced context directly,
        // no extra API call to ShxTeam needed
        const raw = context.user.assignedLeads1;
        allAssignedIds = Array.isArray(raw) ? (raw as string[]) : raw ? [raw as string] : [];
      } else {
        // Manager proxying as a different Pro — must fetch their record
        const repRecord = await ShxTeam.findOne({ id: input.assignedPro });
        const raw = repRecord?.assignedLeads1;
        allAssignedIds = Array.isArray(raw) ? (raw as string[]) : raw ? [raw as string] : [];
      }

      if (allAssignedIds.length === 0) {
        return { leads: [], offset: undefined, hasMore: false, totalCount: 0 };
      }

      // Split into chunks of 100, then fetch ALL chunks in parallel
      const CHUNK_SIZE = 100;
      const chunks: string[][] = [];
      for (let i = 0; i < allAssignedIds.length; i += CHUNK_SIZE) {
        chunks.push(allAssignedIds.slice(i, i + CHUNK_SIZE));
      }

      const chunkResults = await Promise.all(
        chunks.map(chunk =>
          NisLeads.findAll({
            filters: { id: { in: chunk } as any },
            limit: CHUNK_SIZE,
          })
        )
      );

      const accumulated: NisLeadsRecordType[] = [];
      for (const result of chunkResults) {
        for (const record of result.records) {
          if (matchesStatus(record) && passesSearch(record, input.search)) {
            accumulated.push(record);
          }
        }
      }

      // Everything is already in memory, so paging is just a slice. `offset` is
      // a numeric index here (same scheme as getClosedLeads). Without a `limit`
      // the caller gets the whole set, as before.
      const startIndex = input.limit && input.offset ? parseInt(input.offset, 10) || 0 : 0;
      const pageEnd = input.limit ? startIndex + input.limit : accumulated.length;
      const hasMore = pageEnd < accumulated.length;

      return {
        leads: accumulated.slice(startIndex, pageEnd).map(mapLead),
        offset: hasMore ? pageEnd.toString() : undefined,
        hasMore,
        totalCount: accumulated.length,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MANAGER VIEW — paginated Airtable query
    // ─────────────────────────────────────────────────────────────────────────
    const limit = input.limit || 100;
    const airtableStatusFilter = statusBucket
      ? { contains: statusBucket }
      : exactStatus
      ? exactStatus
      : undefined;

    const leadTypeFilter = input.unassignedOnly ? 'Ready to Assign' : 'Active';

    // Search runs in the Airtable formula, not over the returned page, so a
    // page of results is a page of matches from the whole table.
    const fetchLeads = await NisLeads.findAll({
      filters: {
        status: airtableStatusFilter,
        leadType: leadTypeFilter,
      },
      searchAny: leadSearchAny(input.search),
      offset: input.offset,
      limit,
    });

    const allRecords = fetchLeads.records || [];

    return {
      leads: allRecords.map(mapLead),
      offset: fetchLeads.offset,
      hasMore: fetchLeads.hasMore || false,
      totalCount: null,
    };
  },
});
