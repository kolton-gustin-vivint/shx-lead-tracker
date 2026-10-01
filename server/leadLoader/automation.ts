/**
 * Works around an Airtable automation on NIS Leads: whenever Assigned Pro
 * changes — including being CLEARED — it stamps Status = "NEW" and today's
 * Date Assigned. A field written in the same request as the Assigned Pro
 * change gets overwritten moments later.
 *
 * Fix: write the Assigned Pro change first, wait for the automation to run,
 * then write Date Assigned / Status on their own (no Assigned Pro change, so
 * it doesn't fire again). Verified live on 2026-10-01.
 */
import { NisLeads } from '../airtable/index';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface Stamp { status?: string | null; dateAssigned?: string | null }

export async function readStamps(ids: string[]): Promise<Map<string, Stamp>> {
  const out = new Map<string, Stamp>();
  for (let i = 0; i < ids.length; i += 100) {
    const page = await NisLeads.findAll({ filters: { id: { in: ids.slice(i, i + 100) } as any }, fields: ['status', 'dateAssigned'], limit: 100 });
    for (const r of page.records as any[]) out.set(r.id, { status: r.status ?? null, dateAssigned: r.dateAssigned ?? null });
  }
  return out;
}

/**
 * Waits until every lead looks stamped by the automation (`isStamped`), or
 * `timeoutMs` passes, then a little longer for stragglers.
 */
export async function waitForAssignedProAutomation(
  ids: string[],
  isStamped: (id: string, now: Stamp | undefined) => boolean,
  { timeoutMs = 90_000, pollMs = 4_000 } = {},
): Promise<{ allStamped: boolean; waitedMs: number }> {
  const t0 = Date.now();
  let allStamped = false;
  while (Date.now() - t0 < timeoutMs) {
    await sleep(pollMs);
    const now = await readStamps(ids);
    if (ids.every(id => isStamped(id, now.get(id)))) { allStamped = true; break; }
  }
  await sleep(3_000);
  return { allStamped, waitedMs: Date.now() - t0 };
}
