// Utility functions copied VERBATIM from "Load New Cap (GRID BUTTON) v1.9"
const stateMap = {"Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY"};
function asText(val) { if (!val) return ''; if (typeof val === 'string') return val; if (typeof val === 'object' && typeof val.name === 'string') return val.name; if (typeof val === 'object' && typeof val.value === 'string') return val.value; return '' + val; }
function trimmed(val) { return (val === null || val === undefined) ? '' : val.toString().trim(); }
function normalizeState(inputState) { if (Array.isArray(inputState)) inputState = inputState[0]; const s = asText(inputState).trim(); if (!s) return ''; if (s.length === 2) return s.toUpperCase(); return (stateMap[s] || '').toUpperCase(); }
function normalizeDistrict(inputDistrict) { if (Array.isArray(inputDistrict)) inputDistrict = inputDistrict[0]; return asText(inputDistrict).replace(/ /g, ' ').trim().toLowerCase(); }
function normalizeZip(inputZip) {
  if (inputZip === null || inputZip === undefined || inputZip === '') return '';
  if (typeof inputZip === 'number') return String(Math.trunc(inputZip)).padStart(5, '0');
  const s = asText(inputZip).trim();
  if (!s) return '';
  const m = s.match(/\d{5}/);
  return m ? m[0] : '';
}
function normalizeCity(inputCity) { if (!inputCity) return ''; if (Array.isArray(inputCity)) inputCity = inputCity[0]; let s = asText(inputCity).replace(/ /g, ' ').trim().toLowerCase(); if (!s) return ''; return s.split(',')[0].trim().replace(/\./g, '').replace(/\s+/g, ' ').trim(); }
function normalizeStatesFromCell(cellVal) {
  const out = []; const seen = new Set();
  function pushState(maybeState) { const st = normalizeState(maybeState); if (st && !seen.has(st)) { seen.add(st); out.push(st); } }
  if (!cellVal) return out;
  if (Array.isArray(cellVal)) { for (const opt of cellVal) pushState(opt?.name || opt); }
  else if (typeof cellVal === 'object' && cellVal.name) { pushState(cellVal.name); }
  else { pushState(cellVal); }
  return out;
}
function parseCityWithRequiredState(token) {
  let t = (token || '').toString().trim(); if (!t) return null;
  let m = t.match(/^([A-Za-z]{2})\s*:\s*(.+)$/) || t.match(/^(.+?)\s*\(\s*([A-Za-z]{2})\s*\)\s*$/) || t.match(/^(.+?),\s*([A-Za-z]{2})\s*$/);
  if (m) {
    const isStateFirst = t.includes(':');
    const st = normalizeState(isStateFirst ? m[1] : m[2]);
    const city = normalizeCity(isStateFirst ? m[2] : m[1]);
    if (st && city) return { state: st, city };
  }
  return null;
}
function parseCityStateMapRequired(raw) {
  const map = new Map(); if (!raw) return map;
  let text = asText(raw).trim(); if (!text) return map;
  text = text.replace(/,\s*(?=[A-Za-z]{2}\s*:)/g, '\n');
  text = text.replace(/,\s*([A-Za-z]{2})\b/g, '<<STATECOMMA>>$1');
  const parts = text.split(/[\n;|]+/g).map(s => s.trim()).filter(Boolean).map(s => s.replace(/<<STATECOMMA>>/g, ', '));
  for (const p of parts) {
    const parsed = parseCityWithRequiredState(p);
    if (parsed) { if (!map.has(parsed.state)) map.set(parsed.state, new Set()); map.get(parsed.state).add(parsed.city); }
  }
  return map;
}
module.exports = { asText, trimmed, normalizeState, normalizeDistrict, normalizeZip, normalizeCity, normalizeStatesFromCell, parseCityStateMapRequired };
