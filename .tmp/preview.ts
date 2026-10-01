import { loadLeadsForPro } from '../server/leadLoader/loadForPro';
import { ShxTeam } from '../server/airtable/index';
const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver' }).format(new Date());
const actor = { id: 'recBrwhYpX8HOtwzZ', name: 'Kolton Gustin', email: 'kolton.gustin@vivint.com' };
(async () => {
  const all = (await ShxTeam.findAll({ filters: { role: 'Pro', status: 'Active' }, fields: ['proName', 'shxStateAi', 'assignedActiveLeads', 'activeLeadCap', 'todaysLeads', 'dailyNewLeadCap'], limit: 100 })).records as any[];
  const st = (r: any) => r.shxStateAi?.value ?? r.shxStateAi;
  const underCap = all.filter(r => (r.assignedActiveLeads ?? 0) < (r.activeLeadCap ?? 150));
  const picks = [
    { id: 'recoGS5krxqNkDyzc', cap: 10, why: 'test Pro (UT)' },
    ...underCap.filter(r => st(r) === 'TX').slice(0, 2).map(r => ({ id: r.id, cap: (r.dailyNewLeadCap ?? 10) + 5, why: 'TX, under cap' })),
    ...underCap.filter(r => st(r) && st(r) !== 'TX').slice(0, 2).map(r => ({ id: r.id, cap: (r.dailyNewLeadCap ?? 10) + 5, why: `${st(r)}, under cap` })),
    ...all.filter(r => (r.assignedActiveLeads ?? 0) >= (r.activeLeadCap ?? 150)).slice(0, 1).map(r => ({ id: r.id, cap: 20, why: 'at active cap' })),
  ];
  console.log(`local date ${localDate}\n`);
  for (const p of picks) {
    const t0 = performance.now();
    const r = await loadLeadsForPro({ proId: p.id, cap: p.cap, localDate, dryRun: true, actor, action: 'Load NEW CAP' });
    const ms = Math.round(performance.now() - t0);
    console.log(`── ${r.pro.name} (${p.why}) — ${ms} ms — ${r.status}: ${r.message}`);
    if (r.capacity) console.log(`   capacity: cap ${r.capacity.cap}, today ${r.capacity.today}, active ${r.capacity.active}/${r.capacity.activeCap} → needed ${r.capacity.needed}`);
    if (r.territory) console.log(`   territory: ${r.territory.states.join(',')}${r.territory.districts.length ? ' | districts ' + r.territory.districts.join(',') : ''} (${r.territory.homeStateSource})`);
    if (r.filtering) console.log(`   candidates: ${r.filtering.considered} fetched → ${r.filtering.passed} eligible (worked ${r.filtering.worked}, too old ${r.filtering.tooOld})`);
    if (r.buckets) console.log(`   buckets: ${r.buckets.filter(b => b.count).map(b => `${b.name} ${b.count}`).join(' · ') || 'none'} | available ${r.available}`);
    if (r.leads?.length) console.log(`   would assign: ${r.leads.slice(0, 4).map(l => `${l.customerName} (${l.city}, ${l.bucket})`).join('; ')}${r.leads.length > 4 ? ` … +${r.leads.length - 4}` : ''}`);
    for (const s of r.shortfall ?? []) console.log(`   shortfall: ${s}`);
  }
})().catch(e => { console.error('FAILED', e); process.exit(1); });
