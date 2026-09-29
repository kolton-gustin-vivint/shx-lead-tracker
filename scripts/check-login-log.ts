/**
 * Verifies the login-event log end to end, without needing to sign in.
 *
 *   npm run db:check          inspect the table and show recent rows
 *   npm run db:check -- --write   also insert a test row, read it back, delete it
 *
 * Needs DATABASE_URL (copy it from the Neon dashboard into .env). The --write
 * pass exercises exactly the same insert the app runs on sign-in, so if it
 * succeeds, a real login will too.
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';

const TABLE = process.env.LOGIN_EVENTS_TABLE || 'login_events';
const WRITE = process.argv.includes('--write');

const EXPECTED = ['id', 'user_email', 'user_name', 'airtable_record_id', 'logged_in_at', 'role'];

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    fail('DATABASE_URL is not set. Copy the connection string from the Neon dashboard into .env');
  }

  const sql = neon(url);

  // ── 1. Connection ─────────────────────────────────────────────────────────
  const [{ db, now }] = (await sql`SELECT current_database() AS db, now() AS now`) as Array<{
    db: string;
    now: Date;
  }>;
  console.log(`✓ Connected to "${db}" (server time ${new Date(now).toISOString()})`);

  // ── 2. Table exists, with the columns the app writes ──────────────────────
  const columns = (await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${TABLE}
    ORDER BY ordinal_position
  `) as Array<{ column_name: string; data_type: string }>;

  if (columns.length === 0) {
    const others = (await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `) as Array<{ table_name: string }>;
    fail(
      `No table named "${TABLE}" in this database.\n` +
        `  Tables found: ${others.map(t => t.table_name).join(', ') || '(none)'}\n` +
        `  If yours has a different name, set LOGIN_EVENTS_TABLE to it.`,
    );
  }

  console.log(`✓ Table "${TABLE}" has ${columns.length} columns:`);
  for (const c of columns) console.log(`    ${c.column_name.padEnd(20)} ${c.data_type}`);

  const names = columns.map(c => c.column_name);
  const missing = EXPECTED.filter(c => !names.includes(c));
  if (missing.length) {
    fail(`The app writes columns that this table does not have: ${missing.join(', ')}`);
  }
  console.log('✓ All columns the app writes are present');

  // ── 3. Round-trip a row through the exact insert the app uses ─────────────
  if (WRITE) {
    const id = randomUUID();
    const marker = `db-check-${Date.now()}@example.invalid`;
    try {
      await sql.query(
        `INSERT INTO ${TABLE} (id, user_email, user_name, airtable_record_id, logged_in_at, role)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, marker, 'DB Check', 'recTESTONLY', new Date(), 'Pro'],
      );
      console.log(`✓ Inserted test row ${id}`);

      const back = (await sql.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id])) as Array<
        Record<string, unknown>
      >;
      if (back.length !== 1) fail('Inserted a row but could not read it back.');
      console.log('✓ Read it back:', JSON.stringify(back[0]));
    } finally {
      const removed = (await sql.query(`DELETE FROM ${TABLE} WHERE id = $1 RETURNING id`, [id])) as unknown[];
      console.log(removed.length ? '✓ Test row deleted' : '⚠ Test row could not be deleted — remove it by hand');
    }
  } else {
    console.log('\n(run with --write to insert and delete a test row)');
  }

  // ── 4. What is actually in there ──────────────────────────────────────────
  const [{ total }] = (await sql.query(`SELECT COUNT(*)::int AS total FROM ${TABLE}`)) as Array<{
    total: number;
  }>;
  console.log(`\nRows in "${TABLE}": ${total}`);

  if (total > 0) {
    const recent = (await sql.query(
      `SELECT user_email, user_name, role, logged_in_at
       FROM ${TABLE} ORDER BY logged_in_at DESC LIMIT 5`,
    )) as Array<Record<string, unknown>>;
    console.log('Most recent:');
    for (const r of recent) {
      console.log(`    ${String(r.logged_in_at)}  ${String(r.user_email)}  (${String(r.role)})`);
    }
  }

  console.log('\n✓ Login log is wired up correctly.');
}

main().catch(err => {
  console.error('\n✗ Check failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
