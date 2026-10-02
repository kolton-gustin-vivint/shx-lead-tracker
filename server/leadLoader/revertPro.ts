/**
 * Reverts a Pro — the server-side version of the Airtable "Revert Pro" button
 * script: sets the SHX Team record's Status to "Reverted" and Reversion Date
 * to now. Like the script, it does NOT touch the Pro's leads; the preview
 * reports what they still hold so a manager can reclaim first if needed.
 *
 * Deliberate (decided 2026-10-02): a Reverted Pro keeps their leads and keeps
 * Pro app access — only "Inactive" is blocked by the roster gate. The loaders
 * still skip them, since loading requires Status "Active".
 */
import { NisLeads, ShxTeam, AuditLog } from '../airtable/index';
import { airtableString as q } from '../lib/airtable';
import { ApiError } from '../lib/endpoint';

export interface RevertResult {
  status: 'preview' | 'reverted';
  message: string;
  pro: { id: string; name: string; currentStatus: string; reversionDate: string | null };
  /** What the Pro still holds (unchanged by reverting). */
  leads: { active: number; activeNew: number };
  auditLogId?: string;
}

export async function revertPro(o: { proId: string; dryRun: boolean; actor: { id: string; name: string; email: string } }): Promise<RevertResult> {
  const pro = await ShxTeam.findOne({ id: o.proId });
  if (!pro) throw new ApiError({ code: 'NOT_FOUND', message: 'Rep not found' });
  const p = pro as Record<string, any>;
  const info = { id: pro.id, name: String(p.displayName || p.proName || p.repId), currentStatus: String(p.status ?? ''), reversionDate: p.reversionDate ?? null };

  const linked = `FIND(${q(`|${p.repId}|`)}, '|' & ARRAYJOIN({Assigned Pro}, '|') & '|')`;
  const rows: any[] = [];
  let offset: string | undefined;
  do {
    const page = await NisLeads.findAll({ formula: `AND(${linked}, {Lead Type} = 'Active')`, fields: ['assignedPro', 'status'], offset, limit: 100 });
    rows.push(...page.records);
    offset = page.hasMore ? page.offset : undefined;
  } while (offset);
  const mine = rows.filter(r => (r.assignedPro ?? []).includes(o.proId));
  const leads = { active: mine.length, activeNew: mine.filter(r => r.status === 'NEW').length };

  if (o.dryRun) {
    const already = info.currentStatus === 'Reverted' ? ` They're already Reverted${info.reversionDate ? ` (since ${info.reversionDate})` : ''}; this re-stamps the date.` : '';
    return { status: 'preview', pro: info, leads, message: `Sets ${info.name}'s Status to Reverted (currently ${info.currentStatus || 'blank'}) and Reversion Date to now.${already}` };
  }

  const now = new Date().toISOString();
  await ShxTeam.update({ id: o.proId, record: { status: 'Reverted', reversionDate: now } });

  const details = [
    'Revert Pro via Manager View',
    `Pro: ${p.repId} (${o.proId})`,
    `By: ${o.actor.name} <${o.actor.email}>`,
    `Status ${info.currentStatus || '(blank)'} → Reverted | Reversion Date ${info.reversionDate ?? '(blank)'} → ${now}`,
    `Still holds ${leads.active} active lead(s), ${leads.activeNew} still NEW (not changed)`,
    `UNDO-DATA ${JSON.stringify({ v: 2, kind: 'pro', proId: o.proId, before: { status: p.status ?? null, reversionDate: p.reversionDate ?? null }, after: { status: 'Reverted', reversionDate: now } })}`,
  ].join('\n');
  let auditLogId: string | undefined;
  try {
    auditLogId = (await AuditLog.create({ record: { actions: 'Revert Pro', assignedPro: [o.actor.id], details } })).id;
  } catch (err) {
    console.error('[revertPro] audit log write failed', err, details);
  }
  return { status: 'reverted', pro: { ...info, currentStatus: 'Reverted', reversionDate: now }, leads, auditLogId, message: `${info.name} is now Reverted.` };
}
