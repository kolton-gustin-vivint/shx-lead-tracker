/**
 * Reclaims a Pro's never-worked leads — the server-side version of two
 * Airtable button scripts:
 *
 *   mode 'stale' — "SINGLE-PRO RECLAIM LEADS SCRIPT v1.0" (Reclaim Leads):
 *     Lead Type Active, Status NEW, assigned more than 14 days ago.
 *   mode 'force' — "SINGLE-PRO FORCE RECLAIM LEADS SCRIPT v1.0" (FORCE Reclaim):
 *     Status NEW, any age, any Lead Type (the script doesn't check it); also
 *     sets Assignment Needed = true.
 *
 * Both reset the lead to Ready to Assign (Assigned Pro, Original Assigned Pro,
 * Date Assigned, Assignment Status and Close Reason cleared; Status left NEW).
 *
 * One deliberate difference: an Airtable automation re-stamps Date Assigned
 * when Assigned Pro is cleared, which defeats the script's "clear Date
 * Assigned". We clear it again once that automation has run (automation.ts).
 */
import { NisLeads, ShxTeam, AuditLog } from '../airtable/index';
import { airtableString as q } from '../lib/airtable';
import { ApiError } from '../lib/endpoint';
import { waitForAssignedProAutomation } from './automation';

export const STALE_THRESHOLD_DAYS = 14;
/** 'offboard' = Offboard Pro's reclaim step: same filter as 'force', but no Assignment Needed change. */
export type ReclaimMode = 'stale' | 'force' | 'offboard';

export interface ReclaimLead { id: string; customerName: string; opportunityName: string; city: string; state: string; dateAssigned: string }

export interface ReclaimResult {
  status: 'preview' | 'reclaimed' | 'nothing-to-do';
  mode: ReclaimMode;
  message: string;
  pro: { id: string; name: string };
  thresholdDays: number;
  leads: ReclaimLead[];
  reclaimed?: number;
  /** Leads that changed (reassigned, worked or deleted) after the list was read, so were left alone. */
  skipped?: number;
  /** Leads whose Date Assigned the automation re-stamped and we cleared again. */
  dateCleanup?: { cleared: number; automationSeen: boolean };
  auditLogId?: string;
}

const FIELDS = ['assignedPro', 'status', 'leadType', 'dateAssigned', 'originalAssignedPro', 'closeReason', 'assignmentStatus', 'assignmentNeeded', 'customerName', 'opportunityName', 'customerCity', 'customerState'];

export async function leadsToReclaim(mode: ReclaimMode, proId: string, repId: string, now: Date): Promise<Record<string, any>[]> {
  // Airtable prefilter (a superset — one day of slack); each script's exact rule runs below.
  const linked = `FIND(${q(`|${repId}|`)}, '|' & ARRAYJOIN({Assigned Pro}, '|') & '|')`;
  const formula = mode !== 'stale'
    ? `AND(${linked}, {Status} = 'NEW')`
    : `AND(${linked}, {Lead Type} = 'Active', {Status} = 'NEW', IS_BEFORE({Date Assigned}, DATEADD(TODAY(), -${STALE_THRESHOLD_DAYS - 1}, 'days')))`;
  const rows: Record<string, any>[] = [];
  let offset: string | undefined;
  do {
    const page = await NisLeads.findAll({ formula, fields: FIELDS, sort: [{ field: 'dateAssigned', direction: 'asc' }], offset, limit: 100 });
    rows.push(...(page.records as any[]));
    offset = page.hasMore ? page.offset : undefined;
  } while (offset);

  return rows.filter(r => isReclaimable(mode, proId, r, now));
}

/** Exactly the scripts' filters. Also used to re-check a lead right before it is written. */
export function isReclaimable(mode: ReclaimMode, proId: string, r: Record<string, any>, now: Date): boolean {
  if (!(r.assignedPro ?? []).includes(proId) || r.status !== 'NEW') return false;
  if (mode !== 'stale') return true;
  const threshold = new Date(now);
  threshold.setDate(now.getDate() - STALE_THRESHOLD_DAYS);
  return r.leadType === 'Active' && !!r.dateAssigned && new Date(r.dateAssigned) < threshold;
}

export function describeLead(r: Record<string, any>): ReclaimLead {
  return {
    id: r.id, customerName: String(r.customerName ?? ''), opportunityName: String(r.opportunityName ?? ''),
    city: String(r.customerCity ?? ''), state: String(r.customerState ?? ''), dateAssigned: String(r.dateAssigned ?? ''),
  };
}

/** Each lead's values before a reclaim — the undo data. */
export function reclaimUndoData(leads: Record<string, any>[]) {
  return leads.map(r => ({
    id: r.id,
    assignedPro: r.assignedPro ?? null, originalAssignedPro: r.originalAssignedPro ?? null, dateAssigned: r.dateAssigned ?? null,
    assignmentStatus: r.assignmentStatus ?? null, closeReason: r.closeReason ?? null, leadType: r.leadType ?? null, status: r.status ?? null,
    assignmentNeeded: r.assignmentNeeded ?? false,
  }));
}

/**
 * The scripts' reclaim write, 10 per request. Stops at the first failed chunk.
 *
 * Each chunk is re-read right before it is written, and any lead that is no
 * longer reclaimable (reassigned, worked, closed, deleted) is skipped rather
 * than overwritten. This narrows the read-to-write gap from the whole run to one
 * round trip; Airtable can't make it atomic. `written` holds the fresh
 * pre-write records, so it is also the right source for undo data.
 */
export async function writeReclaim(
  leads: Record<string, any>[],
  { setAssignmentNeeded, mode, proId }: { setAssignmentNeeded: boolean; mode: ReclaimMode; proId: string },
): Promise<{ written: Record<string, any>[]; skipped: Record<string, any>[]; failure: unknown }> {
  const written: Record<string, any>[] = [];
  const skipped: Record<string, any>[] = [];
  for (let i = 0; i < leads.length; i += 10) {
    const chunk = leads.slice(i, i + 10);
    try {
      const page = await NisLeads.findAll({ filters: { id: { in: chunk.map(r => r.id) } as any }, fields: FIELDS, limit: 100 });
      const fresh = new Map((page.records as any[]).map(r => [r.id, r]));
      const now = new Date();
      const keep: Record<string, any>[] = [];
      for (const r of chunk) {
        const f = fresh.get(r.id);
        if (f && isReclaimable(mode, proId, f, now)) keep.push(f);
        else skipped.push(r);
      }
      if (keep.length === 0) continue;
      await NisLeads.updateMany(keep.map(r => ({
        id: r.id,
        record: {
          assignedPro: [], originalAssignedPro: null, dateAssigned: null, assignmentStatus: null, closeReason: null, leadType: 'Ready to Assign',
          ...(setAssignmentNeeded ? { assignmentNeeded: true } : {}),
        },
      })));
      written.push(...keep);
    } catch (failure) { return { written, skipped, failure }; }
  }
  return { written, skipped, failure: null };
}

/** The automation re-stamps Date Assigned after Assigned Pro is cleared; clear it again once it has. */
export async function clearRestampedDates(ids: string[]): Promise<{ cleared: number; automationSeen: boolean }> {
  if (ids.length === 0) return { cleared: 0, automationSeen: false };
  const { allStamped } = await waitForAssignedProAutomation(ids, (_id, now) => !!now?.dateAssigned);

  // The wait can take a while; a lead assigned to someone else meanwhile keeps its new date.
  const stillFree: string[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const page = await NisLeads.findAll({ filters: { id: { in: ids.slice(i, i + 100) } as any }, fields: ['assignedPro'], limit: 100 });
    for (const r of page.records as any[]) if (!(r.assignedPro ?? []).length) stillFree.push(r.id);
  }
  await NisLeads.updateMany(stillFree.map(id => ({ id, record: { dateAssigned: null } })));
  return { cleared: stillFree.length, automationSeen: allStamped };
}

export async function reclaimLeadsFor(o: {
  mode: ReclaimMode;
  proId: string;
  dryRun: boolean;
  actor: { id: string; name: string; email: string };
}): Promise<ReclaimResult> {
  const pro = await ShxTeam.findOne({ id: o.proId });
  if (!pro) throw new ApiError({ code: 'NOT_FOUND', message: 'Rep not found' });
  const p = pro as Record<string, any>;
  const proInfo = { id: pro.id, name: String(p.displayName || p.proName || p.repId) };
  const describe = describeLead;

  const force = o.mode === 'force';
  const action = force ? 'FORCE Reclaim' : 'Reclaim Leads';
  const stale = await leadsToReclaim(o.mode, o.proId, String(p.repId), new Date());
  const base = { mode: o.mode, pro: proInfo, thresholdDays: STALE_THRESHOLD_DAYS, leads: stale.map(describe) };

  if (stale.length === 0) {
    return { ...base, status: 'nothing-to-do', message: force
      ? `No NEW leads assigned to ${proInfo.name}.`
      : `No stale NEW leads — nothing assigned to ${proInfo.name} more than ${STALE_THRESHOLD_DAYS} days ago is still untouched.` };
  }
  if (o.dryRun) {
    return { ...base, status: 'preview', message: force
      ? `Would reclaim all ${stale.length} NEW lead(s), regardless of age.`
      : `Would reclaim ${stale.length} lead(s) assigned more than ${STALE_THRESHOLD_DAYS} days ago that are still NEW.` };
  }

  // 1. The script's write. Leads that changed since the list was read are skipped.
  const { written, skipped, failure } = await writeReclaim(stale, { setAssignmentNeeded: force, mode: o.mode, proId: o.proId });
  const before = reclaimUndoData(written);

  // 2. Audit log straight away, so the undo data exists even if cleanup fails.
  const details = [
    `${action} via Manager View${failure ? ' — STOPPED EARLY (error)' : ''}`,
    `Pro: ${p.repId} (${o.proId})`,
    `By: ${o.actor.name} <${o.actor.email}>`,
    force ? `Force reclaimed ${written.length} lead(s): every NEW lead, any age` : `Reclaimed ${written.length} lead(s): Status NEW, Lead Type Active, assigned more than ${STALE_THRESHOLD_DAYS} days ago`,
    ...(skipped.length ? [`Skipped ${skipped.length} lead(s) that changed after the list was read`] : []),
    `UNDO-DATA ${JSON.stringify({ v: 2, kind: 'reclaim', proId: o.proId, leads: before })}`,
  ].join('\n');
  let auditLogId: string | undefined;
  try {
    auditLogId = (await AuditLog.create({ record: { actions: action, assignedPro: [o.actor.id], details } })).id;
  } catch (err) {
    console.error('[reclaimLeadsFor] audit log write failed', err, details);
  }
  if (failure) {
    throw new ApiError({ code: 'INTERNAL', message: `Stopped after reclaiming ${written.length} of ${stale.length}: ${failure instanceof Error ? failure.message : String(failure)}${auditLogId ? ` (Audit Log ${auditLogId} has the undo data)` : ''}` });
  }

  // 3. The automation re-stamps Date Assigned after Assigned Pro is cleared; clear it again.
  const dateCleanup = await clearRestampedDates(written.map(r => r.id));

  return {
    ...base, status: 'reclaimed', reclaimed: written.length, skipped: skipped.length, auditLogId,
    dateCleanup,
    message: `Reclaimed ${written.length} lead(s) from ${proInfo.name}. They're back in the pool as Ready to Assign.`
      + (skipped.length ? ` ${skipped.length} more were skipped because they changed after the list was read.` : ''),
  };
}
