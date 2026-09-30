/**
 * Login-event log, stored in Neon (Postgres).
 *
 * Every sign-in appends a row; the manager Login Report reads them back as
 * per-person counts over the last 30 days.
 *
 * This replaced a SQLite file, which could never work on Vercel: each
 * serverless instance got its own copy under /tmp and it vanished between
 * requests, so the report always read zero.
 *
 * Expected table (LOGIN_EVENTS_TABLE, default `login_events`):
 *   id                  text       uuid, generated here
 *   user_email          text
 *   user_name           text
 *   airtable_record_id  text
 *   logged_in_at        timestamp
 *   role                text
 */
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

/**
 * `logged_in_at` is `timestamp without time zone`, and we keep it as UTC wall
 * time. Passing a JS Date would be serialised in the *machine's* local zone
 * (so a laptop in UTC-6 would store times 6 hours early), so times are sent as
 * ISO strings and converted to UTC inside SQL instead.
 */
const UTC_PARAM = (n: number) => `($${n}::timestamptz AT TIME ZONE 'UTC')`;

/** Only a plain identifier, since the table name is interpolated into SQL. */
function safeTableName(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid LOGIN_EVENTS_TABLE "${name}" — must be a plain identifier.`);
  }
  return name;
}

const TABLE = safeTableName(process.env.LOGIN_EVENTS_TABLE || 'login_events');

type SqlClient = ReturnType<typeof neon>;

let client: SqlClient | null | undefined;

/**
 * Resolves the Neon client lazily, so a missing DATABASE_URL degrades to
 * "login history unavailable" rather than breaking every endpoint that
 * happens to import this module.
 */
function db(): SqlClient | null {
  if (client !== undefined) return client;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (!url) {
    console.warn('[db] DATABASE_URL is not set; login events will not be recorded.');
    client = null;
    return client;
  }
  try {
    client = neon(url);
  } catch (err) {
    console.warn('[db] Could not connect to Neon; login events will not be recorded:', (err as Error).message);
    client = null;
  }
  return client;
}

export interface LoginEventInput {
  userEmail: string;
  userName: string;
  airtableRecordId: string;
  loggedInAt: string;
  role: string;
}

export const loginEvents = {
  /**
   * Appends one login event. Never throws: failing to write the log should
   * not stop somebody signing in, so problems are logged and swallowed.
   */
  async create(record: LoginEventInput): Promise<void> {
    const sql = db();
    if (!sql) return;
    try {
      await sql.query(
        `INSERT INTO ${TABLE} (id, user_email, user_name, airtable_record_id, logged_in_at, role)
         VALUES ($1, $2, $3, $4, ${UTC_PARAM(5)}, $6)`,
        [
          randomUUID(),
          record.userEmail,
          record.userName,
          record.airtableRecordId,
          record.loggedInAt,
          record.role,
        ],
      );
    } catch (err) {
      console.error('[db] Failed to record login event:', (err as Error).message);
    }
  },

  /**
   * Whether this person already has a login event at or after `sinceIso`.
   * Compared inside SQL so the `timestamp` (no time zone) column is never
   * parsed back into a JS Date. Fails open (false) so a database problem
   * never stops a login from being recorded.
   */
  async hasLoginSince(airtableRecordId: string, sinceIso: string): Promise<boolean> {
    const sql = db();
    if (!sql) return false;
    try {
      const rows = await sql.query(
        `SELECT EXISTS (
           SELECT 1 FROM ${TABLE} WHERE airtable_record_id = $1 AND logged_in_at >= ${UTC_PARAM(2)}
         ) AS found`,
        [airtableRecordId, sinceIso],
      );
      return Boolean((rows as Array<{ found: boolean }>)[0]?.found);
    } catch (err) {
      console.error('[db] Failed to check recent logins:', (err as Error).message);
      return false;
    }
  },

  /** Login counts per Airtable record id since the given time. */
  async countsSince(isoTimestamp: string): Promise<Array<{ airtableRecordId: string; cnt: number }>> {
    const sql = db();
    if (!sql) return [];
    try {
      const rows = await sql.query(
        `SELECT airtable_record_id AS "airtableRecordId", COUNT(*)::int AS cnt
         FROM ${TABLE}
         WHERE logged_in_at >= ${UTC_PARAM(1)}
         GROUP BY airtable_record_id`,
        [isoTimestamp],
      );
      return rows as Array<{ airtableRecordId: string; cnt: number }>;
    } catch (err) {
      console.error('[db] Failed to read login counts:', (err as Error).message);
      return [];
    }
  },
};
