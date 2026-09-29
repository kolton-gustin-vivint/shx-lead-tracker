/**
 * Checks the SHX Team roster gate — the rule that decides who may use this
 * app once Magistrate has proved who they are.
 *
 *   npm run auth:check                        a sample of real roster cases
 *   npm run auth:check -- a@vivint.com b@…    specific emails
 *
 * Read-only: it looks rows up in Airtable and reports what the gate would
 * decide. Nothing is written, and no sign-in is needed.
 */
import 'dotenv/config';
import { requireRosterUser } from '../server/lib/roster';
import { ShxTeam } from '../server/airtable/index';
import { ApiError } from '../server/lib/endpoint';

async function decide(email: string): Promise<void> {
  const label = (email || '(empty)').padEnd(34);
  try {
    const user = await requireRosterUser({ email });
    const role = String(user.role ?? '?');
    const status = String(user.status ?? '?');
    console.log(`  ALLOWED  ${label} id=${user.id}  role=${role}  status=${status}`);
  } catch (err) {
    if (err instanceof ApiError) {
      console.log(`  REFUSED  ${label} ${err.code} — ${err.message}`);
    } else {
      console.log(`  ERROR    ${label} ${(err as Error).message}`);
    }
  }
}

/** Picks real emails out of the table so the sample reflects actual data. */
async function sampleCases(): Promise<Array<[string, string]>> {
  const cases: Array<[string, string]> = [];

  const active = await ShxTeam.findOne({ filters: { status: 'Active' } });
  if (active?.email) cases.push(['active roster member', active.email]);

  const inactive = await ShxTeam.findOne({ filters: { status: 'Inactive' } });
  if (inactive?.email) cases.push(['Inactive roster member', inactive.email]);

  cases.push(['signed in, not on roster', 'definitely.not.on.roster@vivint.com']);
  cases.push(['no email on the session', '']);

  return cases;
}

async function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));

  if (args.length > 0) {
    console.log('Roster gate decisions:\n');
    for (const email of args) await decide(email);
  } else {
    console.log('Roster gate decisions for a sample of real rows:\n');
    for (const [label, email] of await sampleCases()) {
      console.log(`${label}:`);
      await decide(email);
    }
  }

  console.log(
    '\nALLOWED means the app serves them. REFUSED means every API call returns 403\n' +
      'and the browser shows Access Denied with that message.',
  );
}

main().catch(err => {
  console.error('\nCheck failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
