import { createRequire } from 'node:module';
import * as ported from '../server/leadLoader/matching';
import { ShxTeam, NisLeads } from '../server/airtable/index';
const orig = createRequire(import.meta.url)('./original.js');
const ser = (v: any): string => JSON.stringify(v, (_k, x) => x instanceof Map ? [...x].map(([k, s]) => [k, [...s]]) : x instanceof Set ? [...x] : x);
(async () => {
  const pros: any[] = []; let off: string | undefined;
  do { const p = await ShxTeam.findAll({ fields: ['shxStateAbbreviation','shxStateAi','territoryOverride','district','shxCity','additionalCities','nearbyCities','shxZip','nearbyZips'], offset: off, limit: 100 }); pros.push(...p.records); off = p.offset; } while (off);
  const leads: any[] = []; off = undefined;
  for (let i = 0; i < 6 && (i === 0 || off); i++) { const p = await NisLeads.findAll({ fields: ['customerState','customerCity','customerZipAi','customerDistrict','originalAssignedPro','closeReason'], offset: off, limit: 100 }); leads.push(...p.records); off = p.offset; }
  let checks = 0, diffs: string[] = [];
  const cmp = (label: string, a: any, b: any) => { checks++; if (ser(a) !== ser(b)) diffs.push(`${label}: original=${ser(a)} ported=${ser(b)}`); };
  for (const p of pros) {
    for (const f of ['shxStateAbbreviation','shxStateAi'] as const) cmp(`state ${f}`, orig.normalizeState(p[f]), ported.normalizeState(p[f]));
    cmp('override', orig.normalizeStatesFromCell(p.territoryOverride), ported.normalizeStatesFromCell(p.territoryOverride));
    for (const f of ['additionalCities','nearbyCities'] as const) cmp(`map ${f} ${p.id}`, orig.parseCityStateMapRequired(p[f] || ''), ported.parseCityStateMapRequired(p[f] || ''));
    for (const v of (p.shxCity ?? [])) cmp('city', orig.normalizeCity(v), ported.normalizeCity(v));
    for (const v of (p.shxZip ?? [])) cmp('zip', orig.normalizeZip(v), ported.normalizeZip(v));
    for (const v of (p.district ?? [])) cmp('district', orig.normalizeDistrict(v), ported.normalizeDistrict(v));
    cmp('nearbyZips', orig.asText(p.nearbyZips), ported.asText(p.nearbyZips));
  }
  for (const l of leads) {
    cmp('lead state', orig.normalizeState(l.customerState), ported.normalizeState(l.customerState));
    cmp('lead city', orig.normalizeCity(l.customerCity), ported.normalizeCity(l.customerCity));
    cmp('lead zip', orig.normalizeZip(l.customerZipAi), ported.normalizeZip(l.customerZipAi));
    cmp('lead district', orig.normalizeDistrict(l.customerDistrict), ported.normalizeDistrict(l.customerDistrict));
    cmp('lead worked', orig.trimmed(l.originalAssignedPro).length > 0 || orig.trimmed(l.closeReason).length > 0, ported.trimmed(ported.asText(l.originalAssignedPro)).length > 0 || ported.trimmed(ported.asText(l.closeReason)).length > 0);
  }
  // edge cases the real data may not contain
  const edge = ['UT: Provo, UT: Orem', 'Provo, UT; Orem (UT)\nSt. George, UT', 'tx:  San  Antonio , TX: El Paso', 'Salt Lake City, Utah', { state: 'generated', value: 'UT: Lehi, UT: Draper', isStale: false }, '', null];
  for (const e of edge) cmp(`edge map ${JSON.stringify(e)}`, orig.parseCityStateMapRequired(e), ported.parseCityStateMapRequired(e));
  for (const z of [501, 84059, '84059-1234', ' 00501 ', 'abc', null, 1e5 + 0.7]) cmp(`edge zip ${z}`, orig.normalizeZip(z), ported.normalizeZip(z));
  const withData = { pros: pros.length, additional: pros.filter(p => p.additionalCities).length, nearbyCities: pros.filter(p => p.nearbyCities).length, nearbyZips: pros.filter(p => p.nearbyZips).length, override: pros.filter(p => p.territoryOverride).length };
  console.log('real data used:', JSON.stringify(withData), `| ${leads.length} leads`);
  console.log(`${checks} comparisons, ${diffs.length} differences`);
  for (const d of diffs.slice(0, 10)) console.log('  DIFF', d);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
