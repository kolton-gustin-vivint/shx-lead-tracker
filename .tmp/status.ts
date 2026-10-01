import { NisLeads } from '../server/airtable/index';
(async () => {
  const r: any = await NisLeads.update({ id: 'recrZMEbZgt4x6IVM', record: { status: null } });
  console.log('Status restored to snapshot value (blank):', JSON.stringify(r.status ?? null));
})().catch(e => { console.error('FAILED', e); process.exit(1); });
