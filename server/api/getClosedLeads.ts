import { enrichCurrentUser } from '../lib/currentUser';
import { z } from 'zod';
import { createEndpoint } from '../lib/endpoint';
import { NisLeads, ShxTeam } from '../airtable';
import type { NisLeadsRecordType } from '../airtable';
import { passesSearch, mapLead } from '../utils/leadUtils';

export default createEndpoint({
  description: `Returns CLOSED leads only. Uses context.user.assignedLeads directly when the
  requesting user is the assigned pro (saves one API call vs. fetching the rep record).
  Pro path fetches ALL chunks in PARALLEL (same pattern as getLeads) then paginates
  the accumulated results. Manager path uses Airtable cursor pagination.`,
  authenticated: true,
  inputSchema: z.object({
    limit: z.number().optional(),
    offset: z.string().optional(),
    search: z.string().optional(),
    subStatus: z.string().optional(),
    assignedPro: z.string().optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await enrichCurrentUser(context);
    const limit = input.limit || 50;

    const matchesStatus = (record: NisLeadsRecordType): boolean => {
      const s = record.status || '';
      if (!s.startsWith('CLOSED')) return false;
      if (input.subStatus) return s === input.subStatus;
      return true;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // PRO VIEW — fetch ALL assigned lead chunks in PARALLEL, then paginate
    // ─────────────────────────────────────────────────────────────────────────
    if (input.assignedPro) {
      let allAssignedIds: string[];

      if (input.assignedPro === context.user.id) {
        const raw = context.user.assignedLeads1;
        allAssignedIds = Array.isArray(raw) ? (raw as string[]) : raw ? [raw as string] : [];
      } else {
        const repRecord = await ShxTeam.findOne({ id: input.assignedPro });
        const raw = repRecord?.assignedLeads1;
        allAssignedIds = Array.isArray(raw) ? (raw as string[]) : raw ? [raw as string] : [];
      }

      if (allAssignedIds.length === 0) {
        return { leads: [], offset: undefined, hasMore: false, totalCount: null };
      }

      // Fetch all chunks in parallel
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

      // Accumulate all matching closed leads from all chunks
      const allMatching: NisLeadsRecordType[] = [];
      for (const result of chunkResults) {
        for (const record of result.records) {
          if (matchesStatus(record) && passesSearch(record, input.search)) {
            allMatching.push(record);
          }
        }
      }

      // Apply numeric pagination on the accumulated results
      const startIndex = input.offset ? parseInt(input.offset, 10) || 0 : 0;
      const page = allMatching.slice(startIndex, startIndex + limit);
      const nextIndex = startIndex + limit;
      const hasMore = nextIndex < allMatching.length;

      return {
        leads: page.map(mapLead),
        offset: hasMore ? nextIndex.toString() : undefined,
        hasMore,
        totalCount: null,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MANAGER VIEW — use leadType: 'Closed' filter at Airtable level
    // ─────────────────────────────────────────────────────────────────────────
    const fetchLeads = await NisLeads.findAll({
      filters: {
        leadType: 'Closed',
        status: input.subStatus ? input.subStatus : undefined,
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
