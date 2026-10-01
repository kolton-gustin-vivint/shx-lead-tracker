/**
 * Undoes a lead load (Load NEW CAP / Load Leads run from the Manager View).
 *
 *   npm run leads:undo -- <auditLogRecordId>           # preview only
 *   npm run leads:undo -- <auditLogRecordId> --apply   # restore
 *
 * Reads the UNDO-DATA line the loader wrote into that Audit Log entry and puts
 * each lead's Assigned Pro, Date Assigned, Last Attempted, Assignment Status
 * and Lead Type back (and Status, for v2 undo data). A lead is only restored
 * if it is STILL assigned to that Pro and still unworked (Status blank or NEW
 * — an Airtable automation sets NEW on activation). Anything reassigned or
 * worked since is left alone and reported.
 */
import { AuditLog, NisLeads } from '../server/airtable/index';

const [, , auditId, flag] = process.argv;
const apply = flag === '--apply';

interface Before { id: string; assignedPro: string[] | null; dateAssigned: string | null; lastAttempted: string | null; assignmentStatus: string | null; leadType: string | null; status?: string | null }

async function main() {
  if (!auditId || !auditId.startsWith('rec')) throw new Error('Usage: npm run leads:undo -- <auditLogRecordId> [--apply]');
  const entry = await AuditLog.findOne({ id: auditId });
  if (!entry) throw new Error(`Audit Log ${auditId} not found`);
  const line = String((entry as any).details ?? '').split('\n').find(l => l.startsWith('UNDO-DATA '));
  if (!line) throw new Error('That Audit Log entry has no UNDO-DATA line');
  const data = JSON.parse(line.slice('UNDO-DATA '.length)) as { v: number; proId: string; leads: Before[] };

  const current = new Map<string, any>();
  for (let i = 0; i < data.leads.length; i += 100) {
    const page = await NisLeads.findAll({ filters: { id: { in: data.leads.slice(i, i + 100).map(l => l.id) } as any }, fields: ['assignedPro', 'leadType', 'status', 'customerName'], limit: 100 });
    for (const r of page.records) current.set(r.id, r);
  }

  const restore: Before[] = [];
  for (const b of data.leads) {
    const c = current.get(b.id);
    const pros: string[] = c?.assignedPro ?? [];
    if (!c) console.log(`  skip ${b.id}: lead no longer exists`);
    else if (!(pros.length === 1 && pros[0] === data.proId)) console.log(`  skip ${b.id} (${c.customerName}): now assigned to ${pros.join(', ') || 'nobody'}, not ${data.proId}`);
    else if (c.status && c.status !== 'NEW') console.log(`  skip ${b.id} (${c.customerName}): already being worked (Status "${c.status}")`);
    else { restore.push(b); console.log(`  ${apply ? 'restore' : 'would restore'} ${b.id} (${c.customerName}) → Lead Type ${b.leadType}, Assigned Pro ${b.assignedPro?.length ? b.assignedPro.join(',') : '(none)'}`); }
  }

  if (!apply) { console.log(`\nPreview: ${restore.length} of ${data.leads.length} lead(s) would be restored. Re-run with --apply to do it.`); return; }

  await NisLeads.updateMany(restore.map(b => ({
    id: b.id,
    record: {
      assignedPro: b.assignedPro ?? [], dateAssigned: b.dateAssigned, lastAttempted: b.lastAttempted,
      assignmentStatus: b.assignmentStatus, leadType: b.leadType,
      // v1 undo data didn't record Status; leave it as is for those.
      ...('status' in b ? { status: b.status ?? null } : {}),
    },
  })));
  if (data.v < 2) console.log('Note: this entry predates Status in the undo data, so Status was left unchanged.');
  await AuditLog.create({ record: { actions: 'Undo lead load', details: `Undid ${restore.length} of ${data.leads.length} lead(s) from Audit Log ${auditId} (Pro ${data.proId})` } });
  console.log(`\nRestored ${restore.length} of ${data.leads.length} lead(s).`);
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
