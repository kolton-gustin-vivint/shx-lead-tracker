import { writeFileSync } from 'node:fs';
import { loadLeadsForPro } from '../server/leadLoader/loadForPro';
const OUT = process.argv[2];
const PRO = 'recoGS5krxqNkDyzc';
const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver' }).format(new Date());
const actor = { id: 'recBrwhYpX8HOtwzZ', name: 'Kolton Gustin', email: 'kolton.gustin@vivint.com' };
const raw = async (id: string) => (await fetch(`https://api.airtable.com/v0/apphPJFvk2oPNeJK9/tblm2jOl13AAWpvOy/${id}`, { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } })).json();
(async () => {
  const preview = await loadLeadsForPro({ proId: PRO, cap: 1, localDate, dryRun: true, actor, action: 'Load NEW CAP' });
  if (preview.status !== 'preview' || preview.leads?.length !== 1) { console.log('ABORT, unexpected preview:', JSON.stringify(preview)); return; }
  const lead = preview.leads[0];
  const snapshot = await raw(lead.id);
  writeFileSync(`${OUT}/live-snapshot-${lead.id}.json`, JSON.stringify(snapshot, null, 2));
  const f = snapshot.fields;
  console.log(`preview picked ${lead.id} — ${lead.customerName} (${lead.city}, ${lead.bucket})`);
  console.log(`BEFORE: Lead Type ${f['Lead Type']} | Assigned Pro ${JSON.stringify(f['Assigned Pro'] ?? null)} | Status ${f['Status'] ?? '∅'} | Assignment Status ${f['Assignment Status'] ?? '∅'} | Assignment Needed ${f['Assignment Needed'] ?? false} | Date Assigned ${f['Date Assigned'] ?? '∅'} | Last Attempted ${f['Last Attempted'] ?? '∅'}`);
  if (String(f['Status'] ?? '').toUpperCase().includes('CLOSED')) { console.log('ABORT: lead Status contains CLOSED — the Traffic Controller would close it'); return; }

  const res = await loadLeadsForPro({ proId: PRO, cap: 1, localDate, dryRun: false, actor, action: 'Load NEW CAP' });
  console.log(`\nREAL RUN: ${res.status} — ${res.message} | assigned ${JSON.stringify(res.leads?.map(l => l.id))} | audit ${res.auditLogId}`);
  writeFileSync(`${OUT}/live-result.json`, JSON.stringify({ leadId: lead.id, res }, null, 2));
  if (res.leads?.[0]?.id !== lead.id) console.log('!! real run assigned a different lead than previewed — that one has no full snapshot (audit log still has undo data)');
})().catch(e => { console.error('FAILED', e); process.exit(1); });
