/**
 * Undoes a Manager View lead action — a load (Load Leads / Load NEW CAP) or a
 * Reclaim Leads.
 *
 *   npm run leads:undo -- <auditLogRecordId>           # preview only
 *   npm run leads:undo -- <auditLogRecordId> --apply   # restore
 *
 * Reads the UNDO-DATA line the action wrote into that Audit Log entry and puts
 * each lead back exactly as it was. Leads changed by someone since are left
 * alone and reported:
 *   - load:    only if still assigned to that Pro and unworked (Status blank/NEW)
 *   - reclaim: only if still unassigned and Ready to Assign (not re-loaded)
 *
 * Two writes, because an Airtable automation stamps Status "NEW" and today's
 * Date Assigned whenever Assigned Pro changes (see server/leadLoader/automation.ts).
 */
import { AuditLog, NisLeads } from '../server/airtable/index';
import { readStamps, waitForAssignedProAutomation } from '../server/leadLoader/automation';

const [, , auditId, flag] = process.argv;
const apply = flag === '--apply';

type Before = Record<string, any> & { id: string; dateAssigned: string | null; status?: string | null };
interface UndoData { v: number; kind?: 'load' | 'reclaim'; proId: string; leads: Before[] }

/** Fields written in step 1 (everything except Date Assigned / Status). */
function stepOneFields(kind: 'load' | 'reclaim', b: Before): Record<string, unknown> {
  if (kind === 'reclaim') {
    return { assignedPro: b.assignedPro ?? [], originalAssignedPro: b.originalAssignedPro, closeReason: b.closeReason, assignmentStatus: b.assignmentStatus, leadType: b.leadType };
  }
  return { assignedPro: b.assignedPro ?? [], lastAttempted: b.lastAttempted, assignmentStatus: b.assignmentStatus, leadType: b.leadType };
}

async function main() {
  if (!auditId || !auditId.startsWith('rec')) throw new Error('Usage: npm run leads:undo -- <auditLogRecordId> [--apply]');
  const entry = await AuditLog.findOne({ id: auditId });
  if (!entry) throw new Error(`Audit Log ${auditId} not found`);
  const line = String((entry as any).details ?? '').split('\n').find(l => l.startsWith('UNDO-DATA '));
  if (!line) throw new Error('That Audit Log entry has no UNDO-DATA line');
  const data = JSON.parse(line.slice('UNDO-DATA '.length)) as UndoData;
  const kind = data.kind ?? 'load';
  console.log(`Undo ${kind} from Audit Log ${auditId} (${(entry as any).actions}), Pro ${data.proId}, ${data.leads.length} lead(s)`);

  const current = new Map<string, any>();
  for (let i = 0; i < data.leads.length; i += 100) {
    const page = await NisLeads.findAll({ filters: { id: { in: data.leads.slice(i, i + 100).map(l => l.id) } as any }, fields: ['assignedPro', 'leadType', 'status', 'customerName'], limit: 100 });
    for (const r of page.records) current.set(r.id, r);
  }

  const restore: Before[] = [];
  for (const b of data.leads) {
    const c = current.get(b.id);
    const pros: string[] = c?.assignedPro ?? [];
    const name = c?.customerName ?? '';
    if (!c) { console.log(`  skip ${b.id}: lead no longer exists`); continue; }
    if (kind === 'load') {
      if (!(pros.length === 1 && pros[0] === data.proId)) { console.log(`  skip ${b.id} (${name}): now assigned to ${pros.join(', ') || 'nobody'}, not ${data.proId}`); continue; }
      if (c.status && c.status !== 'NEW') { console.log(`  skip ${b.id} (${name}): already being worked (Status "${c.status}")`); continue; }
    } else {
      if (pros.length || c.leadType !== 'Ready to Assign') { console.log(`  skip ${b.id} (${name}): re-assigned since (${pros.join(', ') || c.leadType})`); continue; }
    }
    restore.push(b);
    console.log(`  ${apply ? 'restore' : 'would restore'} ${b.id} (${name}) → Lead Type ${b.leadType}, Assigned Pro ${b.assignedPro?.length ? b.assignedPro.join(',') : '(none)'}, Date Assigned ${b.dateAssigned ?? '(none)'}`);
  }

  if (!apply) { console.log(`\nPreview: ${restore.length} of ${data.leads.length} lead(s) would be restored. Re-run with --apply to do it.`); return; }
  if (restore.length === 0) { console.log('\nNothing to restore.'); return; }

  // 1. Everything except Date Assigned / Status — this fires the Assigned Pro automation.
  await NisLeads.updateMany(restore.map(b => ({ id: b.id, record: stepOneFields(kind, b) })));
  console.log('Step 1 done. Waiting for the Assigned Pro automation…');

  // 2. Wait for it to stamp, then 3. restore Date Assigned / Status on their own.
  const byId = new Map(restore.map(b => [b.id, b]));
  const stamped = (id: string, now?: { status?: string | null; dateAssigned?: string | null }) => {
    const b = byId.get(id)!;
    return !!now && ((now.dateAssigned ?? null) !== (b.dateAssigned ?? null) || ('status' in b && (now.status ?? null) !== (b.status ?? null)));
  };
  await waitForAssignedProAutomation(restore.map(b => b.id), stamped);
  await NisLeads.updateMany(restore.map(b => ({
    id: b.id,
    record: { dateAssigned: b.dateAssigned, ...('status' in b ? { status: b.status ?? null } : {}) },
  })));
  if (data.v < 2) console.log('Note: this entry predates Status in the undo data, so Status was left unchanged.');

  // 4. Verify.
  await new Promise(r => setTimeout(r, 20_000));
  const final = await readStamps(restore.map(b => b.id));
  const restamped = restore.filter(b => stamped(b.id, final.get(b.id)));
  if (restamped.length) console.log(`WARNING: ${restamped.length} lead(s) changed again after restoring: ${restamped.map(b => b.id).join(', ')}`);

  await AuditLog.create({ record: { actions: 'Undo lead action', details: `Undid ${kind}: restored ${restore.length} of ${data.leads.length} lead(s) from Audit Log ${auditId} (Pro ${data.proId})` } });
  console.log(`\nRestored ${restore.length} of ${data.leads.length} lead(s).`);
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
