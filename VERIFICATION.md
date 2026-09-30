# Post-migration verification checklist

Where the app is most likely to differ from the Zite version, and what to
check. Ordered by how likely each item is to break.

Updated 2026-09-29 for the Next.js migration. The endpoint layer was
re-verified against the live base afterwards: profile, leads, closed leads,
activities, reps, status options, admin stats, self-gen, compensation and the
login report all returned correct data; input validation returned 400; unknown
endpoints 404; uploads stored and served; path traversal blocked.

**The app has no authentication.** Every request is served as `APP_USER_EMAIL`.
Treat that as the top item on this list — nothing else here matters if the app
is reachable by people who should not see the data.

Keep the `npm run dev` terminal visible while testing. Every Airtable error is
logged there with the table, field and message.

## 1. Most likely to fail

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

- [ ] **Manager Leads / Closed Leads lists — order**
  Same ordering caveat. Records are identical; first-page order may differ
  from Zite. Decide whether that matters.

- [ ] **Login history (Neon)**
  The Login Report tab has moved out of this app (it will live in SHX-Admin),
  but `recordLogin` still writes to the `login_events` table in Neon. Counts
  start from zero because Zite's `LoginEvents` history was not migrated.
  Verify a row actually lands: open the app in a fresh tab, then query the
  table (`npm run db:check`). Refreshing the page must NOT add a row.

- [ ] **Who the app runs as.** Confirm `APP_USER_EMAIL` matches the SHX Team
  row you expect, and that its Role gives the right tabs. Check all three
  outcomes: a valid active row → dashboard; a row marked `Inactive` → Access
  Denied; an email not in the table → Access Denied naming the config problem.
  With a Pro row, confirm only that pro's leads, compensation and self-gen
  entries appear and the manager-only tabs are hidden.

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
3. Open a lead: add, edit, delete an activity; change status.
4. Closed, Compensation and Self-Gen (no files) tabs.
5. Sign out, sign in as a **Pro** email: confirm only that pro's leads,
   compensation and self-gen entries appear, and manager-only tabs are hidden.
6. Sign in as an Inactive email and a non-roster email: confirm both are blocked.

## 5. Still to decide before production (Vercel)

- **Authentication.** Nothing should be deployed publicly until
  `requestUser()` in `server/lib/session.ts` derives the user from a real
  sign-in. Until then, keep the deployment behind Vercel's deployment
  protection.
- Vercel function timeouts: `getLeadCount` (unassigned) and manager
  `getLeadStats` page through 40k+ NIS Leads rows at 5 req/s. Confirmed
  2026-09-29: a manager-view `getLeadStats` call ran past 7 minutes locally, so
  it will exceed any Vercel function timeout. Read counts from Airtable
  rollups/Control Panel or precompute on a cron.
- Attachments on Vercel: `/tmp` is not public or persistent. Use Airtable's
  direct upload endpoint or Vercel Blob.
- Import old `LoginEvents` rows into Neon if Zite can still export them.
- Persist `UPLOAD_DIR`, or move attachments off local disk.

See also `MIGRATION.md` (what replaced what) and `README.md` (running and
deploying).
