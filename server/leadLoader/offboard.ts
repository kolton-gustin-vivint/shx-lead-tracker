/**
 * Offboards a Pro — the server-side version of the Airtable "Offboard Pro"
 * button script, in the same order:
 *
 *   1. Reclaim every lead assigned to the Pro with Status NEW (any age, any
 *      Lead Type) back to Ready to Assign — same reset as the other reclaims,
 *      without touching Assignment Needed. In-progress leads stay with them.
 *   2. Deactivate the Pro: Status Inactive, Daily New Lead Cap 0, Active Lead
 *      Cap 0 (so the distribution ignores them).
 *
 * Plus the usual: preview first, Audit Log entry with undo data for BOTH parts,
 * and Date Assigned cleared again after the Assigned Pro automation re-stamps it.
 *
 * Once Inactive the Pro can't sign in and no longer appears on the Team page,
 * so undoing goes through `npm run leads:undo`.
 */
import { ShxTeam, AuditLog } from '../airtable/index';
import { ApiError } from '../lib/endpoint';
import { clearRestampedDates, describeLead, leadsToReclaim, reclaimUndoData, writeReclaim, type ReclaimLead } from './reclaim';

export interface OffboardResult {
  status: 'preview' | 'offboarded';
  message: string;
  pro: { id: string; name: string; status: string; dailyCap: number | null; activeCap: number | null };
  /** NEW leads that will be / were returned to the pool. */
  leads: ReclaimLead[];
  reclaimed?: number;
  dateCleanup?: { cleared: number; automationSeen: boolean };
  auditLogId?: string;
}

export async function offboardPro(o: { proId: string; dryRun: boolean; actor: { id: string; name: string; email: string } }): Promise<OffboardResult> {
  const pro = await ShxTeam.findOne({ id: o.proId });
  if (!pro) throw new ApiError({ code: 'NOT_FOUND', message: 'Rep not found' });
  const p = pro as Record<string, any>;
  const info = {
    id: pro.id, name: String(p.displayName || p.proName || p.repId),
    status: String(p.status ?? ''), dailyCap: p.dailyNewLeadCap ?? null, activeCap: p.activeLeadCap ?? null,
  };

  const leads = await leadsToReclaim('offboard', o.proId, String(p.repId), new Date());

  if (o.dryRun) {
    return {
      status: 'preview', pro: info, leads: leads.map(describeLead),
      message: `Returns ${leads.length} NEW lead(s) to the pool, then sets ${info.name} to Inactive with both caps at 0.`,
    };
  }

  // 1. Reclaim (as the script does first).
  const leadsBefore = reclaimUndoData(leads);
  const { written, failure: leadFailure } = await writeReclaim(leads, { setAssignmentNeeded: false });

  // 2. Deactivate — only if every lead was reclaimed, so a failure doesn't
  // leave an Inactive Pro still holding NEW leads.
  const proBefore = { status: p.status ?? null, dailyNewLeadCap: p.dailyNewLeadCap ?? null, activeLeadCap: p.activeLeadCap ?? null };
  const proAfter = { status: 'Inactive', dailyNewLeadCap: 0, activeLeadCap: 0 };
  let proFailure: unknown = null;
  let deactivated = false;
  if (!leadFailure) {
    try {
      await ShxTeam.update({ id: o.proId, record: proAfter });
      deactivated = true;
    } catch (err) { proFailure = err; }
  }

  // 3. Audit log with undo data for whatever actually happened.
  const failure = leadFailure ?? proFailure;
  const details = [
    `Offboard Pro via Manager View${failure ? ' — STOPPED EARLY (error)' : ''}`,
    `Pro: ${p.repId} (${o.proId})`,
    `By: ${o.actor.name} <${o.actor.email}>`,
    `Reclaimed ${written} of ${leads.length} NEW lead(s)`,
    deactivated
      ? `Status ${proBefore.status ?? '(blank)'} → Inactive | Daily New Lead Cap ${proBefore.dailyNewLeadCap ?? '(blank)'} → 0 | Active Lead Cap ${proBefore.activeLeadCap ?? '(blank)'} → 0`
      : 'Pro NOT deactivated',
    `UNDO-DATA ${JSON.stringify({
      v: 2, kind: 'offboard', proId: o.proId,
      leads: leadsBefore.slice(0, written),
      ...(deactivated ? { before: proBefore, after: proAfter } : {}),
    })}`,
  ].join('\n');
  let auditLogId: string | undefined;
  try {
    auditLogId = (await AuditLog.create({ record: { actions: 'Offboard Pro', assignedPro: [o.actor.id], details } })).id;
  } catch (err) {
    console.error('[offboardPro] audit log write failed', err, details);
  }

  // 4. Clear the re-stamped Date Assigned on the reclaimed leads.
  const dateCleanup = await clearRestampedDates(leads.slice(0, written).map(r => r.id));

  if (failure) {
    throw new ApiError({
      code: 'INTERNAL',
      message: `Offboarding stopped: reclaimed ${written} of ${leads.length} lead(s); Pro ${deactivated ? 'was' : 'was NOT'} deactivated. ${failure instanceof Error ? failure.message : String(failure)}${auditLogId ? ` (Audit Log ${auditLogId} has the undo data)` : ''}`,
    });
  }
  return {
    status: 'offboarded', pro: { ...info, status: 'Inactive', dailyCap: 0, activeCap: 0 }, leads: leads.map(describeLead),
    reclaimed: written, dateCleanup, auditLogId,
    message: `${info.name} is offboarded: ${written} NEW lead(s) returned to the pool, Status Inactive, caps 0.`,
  };
}
