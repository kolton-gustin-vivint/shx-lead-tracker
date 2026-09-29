import { enrichCurrentUser } from '../lib/currentUser';
import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { NisLeads, ShxTeam } from '../airtable/index';
import type { NisLeadsRecordType } from '../airtable/index';
import { passesSearch, mapLead } from '../utils/leadUtils';

export default createEndpoint({
  description: `Returns ACTIVE leads only (NEW + IN-PROGRESS — never CLOSED).

  FOR PRO USERS (assignedPro provided): Uses context.user.assignedLeads directly when the
  requesting user is the assigned pro (saves one API call). Fetches all chunks in PARALLEL
  instead of sequentially for a dramatic speed improvement. All matching active leads are
  returned in a single response.

  FOR MANAGERS (no assignedPro): Queries NIS Leads with leadType: 'Active', paginated by limit/offset.`,
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

      return {
        leads: accumulated.map(mapLead),
        offset: undefined,
        hasMore: false,
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

    const fetchLeads = await NisLeads.findAll({
      filters: {
        status: airtableStatusFilter,
        leadType: leadTypeFilter,
      },
      offset: input.offset,
      limit,
    });

    const allRecords = fetchLeads.records || [];
    const filteredRecords = input.search && input.search.trim()
      ? allRecords.filter(r => passesSearch(r, input.search))
      : allRecords;

    return {
      leads: filteredRecords.map(mapLead),
      offset: fetchLeads.offset,
      hasMore: fetchLeads.hasMore || false,
      totalCount: null,
    };
  },
});
