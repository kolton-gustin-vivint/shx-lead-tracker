/**
 * Loads leads onto one Pro — the server-side version of the Airtable
 * "Single-Pro Loader" (Load Leads) and "Load New Cap" button scripts (see
 * matching.ts for the ported logic). The only difference between the two is
 * the daily cap: the Pro's Daily New Lead Cap, or a one-off value.
 *
 * `dryRun` computes everything (capacity, candidates, buckets, the exact leads
 * that would be assigned) without writing. A real run repeats the work with
 * fresh data, re-checks each chosen lead is still unassigned right before
 * writing, and records an Audit Log entry including each lead's previous
 * values so a load can be undone (scripts/undo-lead-load.ts).
 */
import { NisLeads, ShxTeam, AuditLog } from '../airtable/index';
import { airtableString as q } from '../lib/airtable';
import { ApiError } from '../lib/endpoint';
import {
  BUCKET_LABELS, BUCKET_ORDER, DEFAULT_DAILY_CAP, DEFAULT_TOTAL_CAP, MAX_LEAD_AGE_DAYS, STATE_NAME_BY_ABBR,
  bucketize, filterCandidates, shortfallReasons, territoryOf, type BucketName, type LeadFields,
} from './matching';

export interface LoadOptions {
  proId: string;
  /** One-off daily cap (Load NEW CAP). Omit to use the Pro's Daily New Lead Cap (Load Leads). */
  cap?: number;
  /** The manager's local date, YYYY-MM-DD — written as Date Assigned and used for "today's" count. */
  localDate: string;
  dryRun: boolean;
  /** Who is running it, for the audit log. */
  actor: { id: string; name: string; email: string };
  /** Audit Log "Actions" value, e.g. 'Load NEW CAP'. */
  action: string;
}

export interface QueuedLead { id: string; customerName: string; opportunityName: string; city: string; state: string; bucket: string }

export interface LoadResult {
  status: 'preview' | 'assigned' | 'nothing-to-do' | 'skipped';
  message: string;
  pro: { id: string; name: string };
  capacity?: { cap: number; capSource: 'override' | 'Daily New Lead Cap' | 'default'; today: number; active: number; activeCap: number; needed: number };
  territory?: { states: string[]; districts: string[]; homeStateSource: string };
  filtering?: { considered: number; passed: number; worked: number; tooOld: number };
  buckets?: Array<{ name: string; count: number }>;
  available?: number;
  shortfall?: string[];
  leads?: QueuedLead[];
  assigned?: number;
  /** Leads chosen in the preview step but claimed by someone else before writing. */
  skippedAlreadyTaken?: number;
  auditLogId?: string;
}

const LEAD_FIELDS = [
  'leadType', 'originalAssignedPro', 'closeReason', 'opportunityCreated',
  'customerState', 'customerCity', 'customerZipAi', 'customerDistrict',
  'customerName', 'opportunityName',
];

type Lead = LeadFields & { customerName?: string; opportunityName?: string };

async function findEvery<T>(fetchPage: (offset?: string) => Promise<{ records: T[]; offset?: string; hasMore: boolean }>): Promise<T[]> {
  const out: T[] = [];
  let offset: string | undefined;
  do {
    const page = await fetchPage(offset);
    out.push(...page.records);
    offset = page.hasMore ? page.offset : undefined;
  } while (offset);
  return out;
}

/** Fresh counts straight from the Pro's leads (Airtable's count fields can lag a moment). */
async function currentCounts(repId: string, localDate: string): Promise<{ active: number; today: number }> {
  const linked = `FIND(${q(`|${repId}|`)}, '|' & ARRAYJOIN({Assigned Pro}, '|') & '|')`;
  const formula = `AND(${linked}, OR({Lead Type} = 'Active', DATETIME_FORMAT({Date Assigned}, 'YYYY-MM-DD') = ${q(localDate)}))`;
  const rows = await findEvery(offset => NisLeads.findAll({ formula, fields: ['leadType', 'dateAssigned'], offset, limit: 100 }));
  return {
    active: rows.filter(r => r.leadType === 'Active').length,
    today: rows.filter(r => r.dateAssigned === localDate).length,
  };
}

/** Airtable-side prefilter: a SUPERSET of the script's candidate filter (the exact filter runs after). */
function candidateFormula(states: Set<string>, districts: Set<string>): string {
  const place: string[] = [];
  for (const st of states) {
    place.push(`UPPER(TRIM({Customer State} & '')) = ${q(st)}`);
    if (STATE_NAME_BY_ABBR[st]) place.push(`TRIM({Customer State} & '') = ${q(STATE_NAME_BY_ABBR[st])}`);
  }
  for (const d of districts) place.push(`LOWER(TRIM({Customer District} & '')) = ${q(d)}`);
  return [
    'AND(',
    `{Lead Type} = 'Ready to Assign',`,
    `LEN(TRIM({Original Assigned Pro} & '')) = 0,`,
    // +2 days of slack; the exact 75-day cutoff is applied in filterCandidates.
    `IS_AFTER({Opportunity Created}, DATEADD(TODAY(), -${MAX_LEAD_AGE_DAYS + 2}, 'days')),`,
    `OR(${place.join(', ')})`,
    ')',
  ].join(' ');
}

export function assertLocalDate(localDate: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new ApiError({ code: 'BAD_REQUEST', message: 'localDate must be YYYY-MM-DD' });
  const diff = Math.abs(Date.parse(`${localDate}T12:00:00Z`) - Date.now());
  if (!(diff < 36 * 3600 * 1000)) throw new ApiError({ code: 'BAD_REQUEST', message: "localDate isn't today's date" });
}

export async function loadLeadsForPro(o: LoadOptions): Promise<LoadResult> {
  assertLocalDate(o.localDate);

  const pro = await ShxTeam.findOne({ id: o.proId });
  if (!pro) throw new ApiError({ code: 'NOT_FOUND', message: 'Rep not found' });
  const p = pro as Record<string, any>;
  const proInfo = { id: pro.id, name: String(p.displayName || p.proName || p.repId) };

  // 1. Eligibility (same rule as the script)
  if (p.role !== 'Pro' || p.status !== 'Active' || p.skipLoadLeads) {
    return { status: 'skipped', pro: proInfo, message: `Not eligible: Role ${p.role ?? '—'}, Status ${p.status ?? '—'}${p.skipLoadLeads ? ', Skip Load Leads is checked' : ''}.` };
  }

  // 2. Territory & capacity
  const t = territoryOf(p);
  const territory = { states: [...t.allowedStates], districts: [...t.districts], homeStateSource: t.homeStateSource };
  if (t.allowedStates.size === 0) {
    return { status: 'skipped', pro: proInfo, territory, message: 'No states assigned (SHX State Abbreviation, SHX State (AI) and Territory Override are all blank).' };
  }

  const activeCap: number = p.activeLeadCap ?? DEFAULT_TOTAL_CAP;
  const dailyCap: number = o.cap ?? p.dailyNewLeadCap ?? DEFAULT_DAILY_CAP;
  const capSource = o.cap != null ? 'override' : p.dailyNewLeadCap != null ? 'Daily New Lead Cap' : 'default';
  let counts = await currentCounts(String(p.repId), o.localDate);
  const capacityOf = (c: typeof counts) => ({ cap: dailyCap, capSource, today: c.today, active: c.active, activeCap, needed: Math.min(dailyCap - c.today, activeCap - c.active) }) as const;
  let capacity = capacityOf(counts);
  if (capacity.needed <= 0) {
    const reason = dailyCap - counts.today <= 0
      ? `daily cap reached (${counts.today}/${dailyCap})`
      : `active lead cap reached (${counts.active}/${activeCap})`;
    return { status: 'nothing-to-do', pro: proInfo, territory, capacity, message: `Capacity reached — ${reason}.` };
  }

  // 3. Candidates (newest first, like the script)
  const formula = candidateFormula(t.allowedStates, t.districts);
  const raw = await findEvery(offset =>
    NisLeads.findAll({ formula, fields: LEAD_FIELDS, sort: [{ field: 'opportunityCreated', direction: 'desc' }], offset, limit: 100 }),
  ) as Lead[];
  const { candidates, stats } = filterCandidates(raw, t);
  const filtering = { considered: stats.considered, passed: stats.passed, worked: stats.worked, tooOld: stats.tooOld };

  // 4. Buckets
  const buckets = bucketize(candidates, t);
  const bucketOf = new Map<string, BucketName>();
  for (const b of BUCKET_ORDER) for (const l of buckets[b]) bucketOf.set(l.id, b);
  const available = BUCKET_ORDER.reduce((n, b) => n + buckets[b].length, 0);
  const queue = BUCKET_ORDER.flatMap(b => buckets[b]).slice(0, capacity.needed);
  const shortfall = queue.length < capacity.needed ? shortfallReasons(buckets, t, capacity.needed, stats) : [];
  const describe = (l: Lead): QueuedLead => ({
    id: l.id,
    customerName: String(l.customerName ?? ''),
    opportunityName: String(l.opportunityName ?? ''),
    city: String(l.customerCity ?? ''),
    state: String(l.customerState ?? ''),
    bucket: BUCKET_LABELS[bucketOf.get(l.id)!],
  });
  const summary = {
    pro: proInfo, territory, capacity, filtering, available, shortfall,
    buckets: BUCKET_ORDER.map(b => ({ name: BUCKET_LABELS[b], count: buckets[b].length })),
  };

  if (o.dryRun) {
    return {
      ...summary, status: 'preview', leads: queue.map(describe),
      message: queue.length ? `Would assign ${queue.length} of ${capacity.needed} needed lead(s).` : 'No matching leads to assign.',
    };
  }
  if (queue.length === 0) {
    return { ...summary, status: 'nothing-to-do', leads: [], message: 'No matching leads to assign.' };
  }

  // 5. Re-check right before writing: fresh capacity, and each lead still unclaimed.
  counts = await currentCounts(String(p.repId), o.localDate);
  capacity = capacityOf(counts);
  const fresh = await NisLeads.findAll({
    filters: { id: { in: queue.map(l => l.id) } as any },
    fields: ['leadType', 'assignedPro', 'dateAssigned', 'lastAttempted', 'assignmentStatus', 'status'],
    limit: 100,
  });
  const freshById = new Map(fresh.records.map(r => [r.id, r as Record<string, any>]));
  const stillFree = queue.filter(l => {
    const f = freshById.get(l.id);
    return f && f.leadType === 'Ready to Assign' && !(f.assignedPro ?? []).length;
  });
  const toAssign = stillFree.slice(0, Math.max(0, capacity.needed));
  const skippedAlreadyTaken = queue.length - stillFree.length;
  if (toAssign.length === 0) {
    return { ...summary, capacity, status: 'nothing-to-do', leads: [], skippedAlreadyTaken, message: 'Nothing assigned — the chosen leads were taken, or the Pro reached capacity, since the preview.' };
  }

  // 6. Write, 10 per request. Keep each lead's previous values for undo —
  // including Status, which an Airtable automation sets to NEW on activation.
  const before = toAssign.map(l => {
    const f = freshById.get(l.id)!;
    return { id: l.id, assignedPro: f.assignedPro ?? null, dateAssigned: f.dateAssigned ?? null, lastAttempted: f.lastAttempted ?? null, assignmentStatus: f.assignmentStatus ?? null, leadType: f.leadType ?? null, status: f.status ?? null };
  });
  const now = new Date().toISOString();
  let written = 0;
  let failure: unknown = null;
  for (let i = 0; i < toAssign.length; i += 10) {
    const chunk = toAssign.slice(i, i + 10);
    try {
      await NisLeads.updateMany(chunk.map(l => ({
        id: l.id,
        record: { assignedPro: [o.proId], dateAssigned: o.localDate, lastAttempted: now, assignmentStatus: null, leadType: 'Active' },
      })));
      written += chunk.length;
    } catch (err) {
      failure = err;
      break;
    }
  }

  // 7. Audit log — always, including a partial failure, so it can be undone.
  const writtenBefore = before.slice(0, written);
  const details = [
    `${o.action} via Manager View${failure ? ' — STOPPED EARLY (error)' : ''}`,
    `Pro: ${p.repId} (${o.proId})`,
    `By: ${o.actor.name} <${o.actor.email}>`,
    `Cap ${capacity.cap} | Today ${capacity.today} | Active ${capacity.active}/${capacity.activeCap} | Needed ${capacity.needed}`,
    `Assigned ${written} lead(s)${skippedAlreadyTaken ? `; ${skippedAlreadyTaken} skipped (already taken)` : ''}`,
    `Date Assigned ${o.localDate} | Last Attempted ${now}`,
    `UNDO-DATA ${JSON.stringify({ v: 2, proId: o.proId, leads: writtenBefore })}`,
  ].join('\n');
  let auditLogId: string | undefined;
  try {
    const entry = await AuditLog.create({ record: { actions: o.action, assignedPro: [o.actor.id], details } });
    auditLogId = entry.id;
  } catch (err) {
    console.error('[loadLeadsForPro] audit log write failed', err, details);
  }

  if (failure) {
    throw new ApiError({
      code: 'INTERNAL',
      message: `Stopped after assigning ${written} of ${toAssign.length} leads: ${failure instanceof Error ? failure.message : String(failure)}${auditLogId ? ` (Audit Log ${auditLogId} has the undo data)` : ''}`,
    });
  }

  return {
    ...summary, capacity, status: 'assigned', leads: toAssign.map(describe), assigned: written, skippedAlreadyTaken, auditLogId,
    message: `Assigned ${written} lead(s) to ${proInfo.name}.`,
  };
}
