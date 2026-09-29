# Post-migration verification checklist

Where the standalone app is most likely to differ from the Zite version, and
what to check locally. Ordered by how likely each item is to break. Everything
not listed here runs the same endpoint code against the same base and returned
correct data in read-only smoke tests on 2026-09-28.

Keep the API terminal (`npm run dev`) visible while testing. Every Airtable
error is logged there with the table, field and message.

## 1. Most likely to fail

- [ ] **Lead Details → "Reset Lead"** (`server/api/resetLead.ts`)
  Writes `true` to the NIS Leads field **Reset Lead**, which is an Airtable
  *button* field. The REST API rejects writes to button fields.
  *Fix:* add a checkbox field in Airtable, point the automation at it, and
  change the key written in `resetLead.ts`.

- [ ] **Team tab → "Load Leads"** (`server/api/triggerLoadLeadsForPro.ts`)
  Same problem: SHX Team **Load Leads** is a button field.
  *Fix:* same as above (`Skip Load Leads` is already a checkbox; a new
  `Load Leads Trigger` checkbox would be the clean option).

- [ ] **Self-Gen form / edit dialog with attachments**
  Uploads return a `http://localhost:3001/uploads/...` URL. Airtable cannot
  fetch localhost, so attaching a file fails locally. Test Self-Gen entries
  **without** files locally; attachments can only be verified once
  `PUBLIC_URL` is publicly reachable (or uploads move to S3/Supabase Storage).

- [ ] **Lead Details → AI Summary / Suggest Next Action**
  Requires `OPENAI_API_KEY` in `.env`. The code calls model `gpt-5.4`
  (`server/lib/openai.ts`). Confirm the key has access to that model or change
  the model id.

## 2. Likely to behave slightly differently

- [ ] **Admin tab → "Refresh stats"** (`server/api/refreshAdminStats.ts`)
  The raw-intake count assumes the first page of NIS Leads is newest-first.
  Queries run without a view, so Airtable returns default table order.
  Compare the refreshed number with the cached one shown before refreshing.
  *Fix if wrong:* add `sort: [{ field: 'dateAdded', direction: 'desc' }]` to
  that query.

- [ ] **Manager Leads / Closed Leads / Unassigned lists — order**
  Same ordering caveat. Records are identical; first-page order may differ
  from Zite. Decide whether that matters.

- [ ] **Login Report tab**
  Last-login dates come from Airtable and are correct. The 30-day login
  counts start from zero because Zite's `LoginEvents` history was not
  migrated. Counts are stored in SQLite (`data/app.sqlite`) until the
  planned move to Neon/Supabase.

- [ ] **Sign in / sign out / session expiry**
  `AUTH_MODE=email` shows an email form on the login card (same flow as Zite).
  Verified 2026-09-29 against the live roster: valid roster email → session;
  unknown email → "not found in the SHX Team roster"; Inactive email → "marked
  as Inactive"; bad address → validation message; 11th attempt in a minute →
  throttled. Re-check in the browser:
  - a roster email → dashboard
  - an email whose SHX Team status is `Inactive` → error under the form
  - an email not in SHX Team → error under the form
  When the session cookie expires the app drops to the login screen instead
  of refreshing a token in the background (`SESSION_TTL_HOURS`, default 168).

## 3. Worth a glance

- [ ] **Selects that write values** (status, activity type, time slot, close reason)
  Writes use Airtable `typecast: true`, so a value that does not match an
  existing option **creates a new option** instead of erroring. Confirm the
  saved values match existing choices.

- [ ] **Toasts** follow the OS theme (`packages/components/ui/sonner.tsx`),
  so on a dark desktop toasts appear dark while the app stays light.

- [ ] **Audit Log** entries (`logAuditEvent`) still write `Actions`,
  `Details`, `Assigned Pro`. Spot-check one after viewing/updating a lead.

## 4. Suggested walkthrough

1. `npm run dev`, sign in as yourself (Manager).
2. Leads tab: counts, filters, search, first-page order.
3. Open a lead: add, edit, delete an activity; change status; run Reset Lead.
4. Team, Compensation, Self-Gen (no files), Login Report, Admin tabs.
5. Sign out, sign in as a **Pro** email: confirm only that pro's leads,
   compensation and self-gen entries appear, and manager-only tabs are hidden.
6. Sign in as an Inactive email and a non-roster email: confirm both are blocked.

## 5. Still to decide before production (Vercel)

- Whether email-only sign-in is acceptable long term. It matches Zite but
  proves nothing about who is typing. Options: magic-link email, or
  `AUTH_MODE=oidc` (redirect URI `<PUBLIC_URL>/auth/callback`).
- Vercel function timeouts: `getLeadCount` (unassigned) and manager
  `getLeadStats` page through 40k+ NIS Leads rows at 5 req/s and will exceed
  `maxDuration` (60s in `vercel.json`). Read counts from Airtable
  rollups/Control Panel or precompute on a cron.
- Attachments on Vercel: `/tmp` is not public or persistent. Use Airtable's
  direct upload endpoint or Vercel Blob.
- Replace SQLite with Neon/Supabase Postgres (`server/lib/db.ts` is the only
  file to change) and import old `LoginEvents` rows if Zite can export them.
- Persist `DATA_DIR` and `UPLOAD_DIR` until those moves happen.

See also `MIGRATION.md` (what replaced what) and `README.md` (running and
deploying).
