/**
 * Local SQLite store for data that used to live in the hosted platform DB.
 * Today that is only login events (used by the manager Login Report).
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { env } from './env';

mkdirSync(env.dataDir, { recursive: true });
export const db = new DatabaseSync(join(env.dataDir, 'app.sqlite'));

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

export interface LoginEventInput {
  userEmail: string;
  userName: string;
  airtableRecordId: string;
  loggedInAt: string;
  role: string;
}

const insertLogin = db.prepare(
  `INSERT INTO login_events (user_email, user_name, airtable_record_id, role, logged_in_at) VALUES (?, ?, ?, ?, ?)`,
);
const countSince = db.prepare(
  `SELECT airtable_record_id AS airtableRecordId, COUNT(*) AS cnt FROM login_events WHERE logged_in_at >= ? GROUP BY airtable_record_id`,
);

export const loginEvents = {
  create(record: LoginEventInput): void {
    insertLogin.run(record.userEmail, record.userName, record.airtableRecordId, record.role, record.loggedInAt);
  },
  countsSince(isoTimestamp: string): Array<{ airtableRecordId: string; cnt: number }> {
    return countSince.all(isoTimestamp) as Array<{ airtableRecordId: string; cnt: number }>;
  },
};
