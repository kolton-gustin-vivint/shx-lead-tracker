/**
 * Local SQLite store for data that used to live in the hosted platform DB.
 * Today that is only login events (used by the manager Login Report).
 *
 * Opened lazily so a read-only filesystem (Vercel) or a Node build without
 * node:sqlite degrades to "login counts unavailable" instead of crashing the
 * whole API. On Vercel the file lives in /tmp and does not persist between
 * instances — move this to Postgres (Neon/Supabase) for real history.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { env } from './env.js';

type Stmt = { run: (...args: unknown[]) => unknown; all: (...args: unknown[]) => unknown[] };
type Db = { exec: (sql: string) => void; prepare: (sql: string) => Stmt };

let handle: { insert: Stmt; countSince: Stmt } | null | undefined;

function open(): { insert: Stmt; countSince: Stmt } | null {
  if (handle !== undefined) return handle;
  try {
    const require = createRequire(import.meta.url);
    const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => Db };
    mkdirSync(env.dataDir, { recursive: true });
    const db = new DatabaseSync(join(env.dataDir, 'app.sqlite'));
    db.exec(`
      CREATE TABLE IF NOT EXISTS login_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        user_name TEXT NOT NULL DEFAULT '',
        airtable_record_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT '',
        logged_in_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_login_events_record_time ON login_events (airtable_record_id, logged_in_at);
    `);
    handle = {
      insert: db.prepare(
        `INSERT INTO login_events (user_email, user_name, airtable_record_id, role, logged_in_at) VALUES (?, ?, ?, ?, ?)`,
      ),
      countSince: db.prepare(
        `SELECT airtable_record_id AS airtableRecordId, COUNT(*) AS cnt FROM login_events WHERE logged_in_at >= ? GROUP BY airtable_record_id`,
      ),
    };
  } catch (err) {
    console.warn('[db] SQLite unavailable; login events will not be recorded:', (err as Error).message);
    handle = null;
  }
  return handle;
}

export interface LoginEventInput {
  userEmail: string;
  userName: string;
  airtableRecordId: string;
  loggedInAt: string;
  role: string;
}

export const loginEvents = {
  create(record: LoginEventInput): void {
    open()?.insert.run(record.userEmail, record.userName, record.airtableRecordId, record.role, record.loggedInAt);
  },
  countsSince(isoTimestamp: string): Array<{ airtableRecordId: string; cnt: number }> {
    return (open()?.countSince.all(isoTimestamp) ?? []) as Array<{ airtableRecordId: string; cnt: number }>;
  },
};
