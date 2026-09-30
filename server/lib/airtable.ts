/**
 * Thin Airtable REST adapter that reproduces the query surface the endpoints
 * were written against: findAll / findOne / create / update / delete with
 * camelCase keys and a small filter object language.
 *
 *   filters: {
 *     status: 'NEW',                      // equality
 *     status: { contains: 'CLOSED' },     // substring / array membership
 *     status: { not: 'Inactive' },        // inequality
 *     id: { in: ['rec1', 'rec2'] },       // record id set (chunked automatically)
 *     assignedPro: { contains: 'recXYZ' } // linked-record filter by record id
 *   }
 *
 * Linked-record filters by record id can't be expressed in an Airtable formula
 * (formulas only see the linked row's primary field), so they are resolved
 * through the inverse link on the other table and turned into an id set.
 */
import { env } from './env';
import { ALL_TABLES, BASE_ID, type FieldDef, type TableDef } from '../airtable/schema.generated';

const API_ROOT = 'https://api.airtable.com/v0';
const baseId = env.airtableBaseId || BASE_ID;
const tablesById = new Map(ALL_TABLES.map(t => [t.id, t]));

// ── Errors ──────────────────────────────────────────────────────────────────

export class AirtableError extends Error {
  status: number;
  type?: string;
  constructor(status: number, message: string, type?: string) {
    super(message);
    this.name = 'AirtableError';
    this.status = status;
    this.type = type;
  }
}

// ── Rate limiting (Airtable allows 5 requests / second / base) ──────────────

class RateLimiter {
  private timestamps: number[] = [];
  constructor(private readonly max: number, private readonly windowMs: number) {}

  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
      if (this.timestamps.length < this.max) {
        this.timestamps.push(now);
        return;
      }
      const wait = this.windowMs - (now - this.timestamps[0]) + 5;
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

const limiter = new RateLimiter(5, 1000);

async function request<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
  await limiter.acquire();
  const res = await fetch(`${API_ROOT}/${baseId}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.airtableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  const text = await res.text();
  let message = text;
  let type: string | undefined;
  try {
    const parsed = JSON.parse(text);
    if (parsed?.error) {
      type = parsed.error.type;
      message = parsed.error.message || parsed.error;
    }
  } catch {
    /* plain-text error body */
  }

  const retryable = res.status === 429 || res.status >= 500;
  if (retryable && attempt < 3) {
    const delay = res.status === 429 ? 2000 * (attempt + 1) : 500 * 2 ** attempt;
    await new Promise(r => setTimeout(r, delay));
    return request<T>(method, path, body, attempt + 1);
  }
  throw new AirtableError(res.status, `Airtable ${method} ${path} failed (${res.status}): ${message}`, type);
}

// ── Public option / result types ────────────────────────────────────────────

export type Primitive = string | number | boolean | null;
export type FilterCondition =
  | Primitive
  | undefined
  | { contains?: string; not?: Primitive; in?: Array<string | number> };
export type Filters = Record<string, FilterCondition>;

export interface FindAllOptions {
  filters?: Filters;
  /** Page size (max 100). */
  limit?: number;
  /** Opaque cursor from a previous result. */
  offset?: string;
  sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
  /**
   * Case-insensitive substring match across several fields at once, ANDed with
   * `filters`. Evaluated by Airtable, so a page of results is a page of
   * matches from the whole table rather than matches within the first page.
   */
  searchAny?: { fields: string[]; term: string };
}

export interface FindAllResult<T> {
  records: T[];
  offset?: string;
  hasMore: boolean;
}

interface RawRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

interface RawList {
  records: RawRecord[];
  offset?: string;
}

const RECORD_ID_RE = /^rec[A-Za-z0-9]{14}$/;

/** Airtable reports an unknown record id as 404, or as 403 "…or the requested model was not found". */
function isNotFound(err: unknown): boolean {
  if (!(err instanceof AirtableError)) return false;
  if (err.status === 404) return true;
  return err.status === 403 && /not found/i.test(err.message);
}
const ID_CURSOR_PREFIX = 'ids:';
const MAX_PAGE = 100;

function quote(v: string): string {
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function literal(v: Primitive): string {
  if (v === null) return 'BLANK()';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE()' : 'FALSE()';
  return quote(v);
}

function fieldRef(f: FieldDef): string {
  return `{${f.name}}`;
}

function fallbackKey(name: string): string {
  const words = name.replace(/['’]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  return words.map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join('') || name;
}

// ── Table client ────────────────────────────────────────────────────────────

export interface TableClient<T extends { id: string }> {
  readonly def: TableDef;
  findAll(options?: FindAllOptions): Promise<FindAllResult<T>>;
  findOne(options?: { id?: string; filters?: Filters }): Promise<T | null>;
  create(options: { record: Partial<Omit<T, 'id' | 'createdTime'>> & Record<string, unknown> }): Promise<T>;
  update(options: { id: string; record: Partial<Omit<T, 'id' | 'createdTime'>> & Record<string, unknown> }): Promise<T>;
  delete(options: { id: string }): Promise<{ id: string; deleted: boolean }>;
}

export function defineTable<T extends { id: string }>(def: TableDef): TableClient<T> {
  const byKey = new Map(def.fields.map(f => [f.key, f]));
  const byName = new Map(def.fields.map(f => [f.name, f]));
  const tablePath = encodeURIComponent(def.id);

  function fromAirtable(raw: RawRecord): T {
    const out: Record<string, unknown> = { id: raw.id, createdTime: raw.createdTime };
    for (const [name, value] of Object.entries(raw.fields || {})) {
      const f = byName.get(name);
      out[f ? f.key : fallbackKey(name)] = value;
    }
    return out as T;
  }

  function toAirtable(record: Record<string, unknown>): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record || {})) {
      if (value === undefined) continue;
      if (key === 'id' || key === 'createdTime') continue;
      const f = byKey.get(key);
      if (!f) throw new Error(`Unknown field key "${key}" for table "${def.name}". Run npm run schema:generate if the base changed.`);
      fields[f.name] = value;
    }
    return fields;
  }

  function requireField(key: string): FieldDef {
    const f = byKey.get(key);
    if (!f) throw new Error(`Unknown filter key "${key}" for table "${def.name}". Run npm run schema:generate if the base changed.`);
    return f;
  }

  /** Formula fragment for a single non-id, non-link-by-id condition. */
  function conditionFormula(f: FieldDef, cond: FilterCondition): string | null {
    if (cond === undefined) return null;
    const ref = fieldRef(f);
    if (cond === null) return `${ref} = BLANK()`;
    if (typeof cond === 'boolean') return cond ? `${ref}` : `NOT(${ref})`;
    if (typeof cond === 'string' || typeof cond === 'number') return `${ref} = ${literal(cond)}`;
    const parts: string[] = [];
    if (cond.contains !== undefined) {
      const haystack = f.multiValue ? `ARRAYJOIN(${ref})` : `${ref} & ""`;
      parts.push(`FIND(${quote(String(cond.contains))}, ${haystack}) > 0`);
    }
    if (cond.not !== undefined) {
      if (typeof cond.not === 'boolean') parts.push(cond.not ? `NOT(${ref})` : `${ref}`);
      else if (cond.not === null) parts.push(`${ref} != BLANK()`);
      else parts.push(`${ref} != ${literal(cond.not)}`);
    }
    if (cond.in !== undefined) {
      parts.push(cond.in.length ? `OR(${cond.in.map(v => `${ref} = ${literal(v)}`).join(', ')})` : 'FALSE()');
    }
    if (!parts.length) return null;
    return parts.length === 1 ? parts[0] : `AND(${parts.join(', ')})`;
  }

  /** Fetch the ids linked from `recordId` on the other table back into this one. */
  async function idsLinkedFrom(f: FieldDef, recordId: string): Promise<string[]> {
    const linked = f.linkedTableId ? tablesById.get(f.linkedTableId) : undefined;
    if (!linked || !f.inverseFieldName) {
      throw new Error(`Cannot filter "${def.name}.${f.key}" by record id: no inverse link field is known.`);
    }
    try {
      const raw = await request<RawRecord>('GET', `${encodeURIComponent(linked.id)}/${recordId}`);
      const v = raw.fields?.[f.inverseFieldName];
      return Array.isArray(v) ? (v as string[]) : v ? [v as string] : [];
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }

  interface Compiled {
    formulaParts: string[];
    /** null = no id restriction; [] = nothing can match */
    idSet: string[] | null;
  }

  async function compileFilters(filters: Filters | undefined): Promise<Compiled> {
    const formulaParts: string[] = [];
    let idSet: string[] | null = null;
    const intersect = (ids: string[]) => {
      idSet = idSet === null ? Array.from(new Set(ids)) : idSet.filter(id => ids.includes(id));
    };

    for (const [key, cond] of Object.entries(filters || {})) {
      if (cond === undefined) continue;

      if (key === 'id') {
        if (cond === null || typeof cond !== 'object') {
          intersect([String(cond)]);
        } else {
          if (cond.in !== undefined) intersect(cond.in.map(String));
          if (cond.not !== undefined) formulaParts.push(`RECORD_ID() != ${literal(cond.not)}`);
          if (cond.contains !== undefined) formulaParts.push(`FIND(${quote(cond.contains)}, RECORD_ID()) > 0`);
        }
        continue;
      }

      const f = requireField(key);

      if (f.type === 'multipleRecordLinks') {
        // Linked-record filter by record id → resolve through the inverse link.
        const asIds = (v: unknown): string | null => (typeof v === 'string' && RECORD_ID_RE.test(v) ? v : null);
        if (typeof cond === 'string' && asIds(cond)) {
          intersect(await idsLinkedFrom(f, cond));
          continue;
        }
        if (cond && typeof cond === 'object') {
          const rest: { contains?: string; not?: Primitive; in?: Array<string | number> } = { ...cond };
          if (rest.contains !== undefined && asIds(rest.contains)) {
            intersect(await idsLinkedFrom(f, rest.contains));
            delete rest.contains;
          }
          if (rest.in !== undefined && rest.in.length && rest.in.every(v => asIds(v))) {
            const sets = await Promise.all(rest.in.map(v => idsLinkedFrom(f, String(v))));
            intersect(sets.flat());
            delete rest.in;
          }
          const formula = conditionFormula(f, rest);
          if (formula) formulaParts.push(formula);
          continue;
        }
      }

      const formula = conditionFormula(f, cond);
      if (formula) formulaParts.push(formula);
    }

    return { formulaParts, idSet };
  }

  /**
   * `OR(FIND(...), ...)` over several fields. The term is lowercased in JS and
   * each field is wrapped in LOWER() so the match is case-insensitive, which
   * keeps it consistent with the in-memory search helpers.
   */
  function searchAnyFormula(search: FindAllOptions['searchAny']): string | null {
    const term = search?.term?.trim().toLowerCase();
    if (!term || !search?.fields.length) return null;
    const needle = quote(term);
    const parts = search.fields.map(key => {
      const f = requireField(key);
      const ref = f.multiValue ? `ARRAYJOIN(${fieldRef(f)})` : `${fieldRef(f)} & ""`;
      return `FIND(${needle}, LOWER(${ref})) > 0`;
    });
    return parts.length === 1 ? parts[0] : `OR(${parts.join(', ')})`;
  }

  function joinAnd(parts: string[]): string | undefined {
    if (!parts.length) return undefined;
    return parts.length === 1 ? parts[0] : `AND(${parts.join(', ')})`;
  }

  async function listPage(params: {
    filterByFormula?: string;
    pageSize: number;
    offset?: string;
    sort?: FindAllOptions['sort'];
  }): Promise<RawList> {
    const body: Record<string, unknown> = { pageSize: params.pageSize };
    if (params.filterByFormula) body.filterByFormula = params.filterByFormula;
    if (params.offset) body.offset = params.offset;
    if (params.sort?.length) {
      body.sort = params.sort.map(s => ({ field: requireField(s.field).name, direction: s.direction || 'asc' }));
    }
    return request<RawList>('POST', `${tablePath}/listRecords`, body);
  }

  async function findAll(options: FindAllOptions = {}): Promise<FindAllResult<T>> {
    const pageSize = Math.max(1, Math.min(options.limit ?? MAX_PAGE, MAX_PAGE));
    const { formulaParts, idSet } = await compileFilters(options.filters);

    const searchFormula = searchAnyFormula(options.searchAny);
    if (searchFormula) formulaParts.push(searchFormula);

    // Plain query: Airtable's own cursor is the offset.
    if (idSet === null) {
      const page = await listPage({ filterByFormula: joinAnd(formulaParts), pageSize, offset: options.offset, sort: options.sort });
      return { records: page.records.map(fromAirtable), offset: page.offset, hasMore: Boolean(page.offset) };
    }

    if (idSet.length === 0) return { records: [], offset: undefined, hasMore: false };

    // Id-set query: OR(RECORD_ID()=…) in chunks of 100, cursor = "ids:<chunk>:<airtableOffset>".
    const chunks: string[][] = [];
    for (let i = 0; i < idSet.length; i += MAX_PAGE) chunks.push(idSet.slice(i, i + MAX_PAGE));

    let chunkIndex = 0;
    let innerOffset: string | undefined;
    if (options.offset) {
      if (!options.offset.startsWith(ID_CURSOR_PREFIX)) throw new Error(`Invalid cursor for id-set query: ${options.offset}`);
      const [, idx, inner] = options.offset.split(':');
      chunkIndex = Number(idx) || 0;
      innerOffset = inner || undefined;
    }
    if (chunkIndex >= chunks.length) return { records: [], offset: undefined, hasMore: false };

    const idFormula = `OR(${chunks[chunkIndex].map(id => `RECORD_ID() = ${quote(id)}`).join(', ')})`;
    const page = await listPage({
      filterByFormula: joinAnd([idFormula, ...formulaParts]),
      pageSize,
      offset: innerOffset,
      sort: options.sort,
    });

    let next: string | undefined;
    if (page.offset) next = `${ID_CURSOR_PREFIX}${chunkIndex}:${page.offset}`;
    else if (chunkIndex + 1 < chunks.length) next = `${ID_CURSOR_PREFIX}${chunkIndex + 1}:`;

    return { records: page.records.map(fromAirtable), offset: next, hasMore: Boolean(next) };
  }

  async function findOne(options: { id?: string; filters?: Filters } = {}): Promise<T | null> {
    if (options.id) {
      try {
        const raw = await request<RawRecord>('GET', `${tablePath}/${encodeURIComponent(options.id)}`);
        return fromAirtable(raw);
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    }
    // Walk pages until something matches (an id-set query may have empty leading chunks).
    let offset: string | undefined;
    for (let i = 0; i < 50; i++) {
      const page = await findAll({ filters: options.filters, limit: 1, offset });
      if (page.records.length) return page.records[0];
      if (!page.hasMore || !page.offset) return null;
      offset = page.offset;
    }
    return null;
  }

  async function create(options: { record: Record<string, unknown> }): Promise<T> {
    const raw = await request<RawRecord>('POST', tablePath, { fields: toAirtable(options.record), typecast: true });
    return fromAirtable(raw);
  }

  async function update(options: { id: string; record: Record<string, unknown> }): Promise<T> {
    const raw = await request<RawRecord>('PATCH', `${tablePath}/${encodeURIComponent(options.id)}`, {
      fields: toAirtable(options.record),
      typecast: true,
    });
    return fromAirtable(raw);
  }

  async function del(options: { id: string }): Promise<{ id: string; deleted: boolean }> {
    return request<{ id: string; deleted: boolean }>('DELETE', `${tablePath}/${encodeURIComponent(options.id)}`);
  }

  return { def, findAll, findOne, create: create as TableClient<T>['create'], update: update as TableClient<T>['update'], delete: del };
}
