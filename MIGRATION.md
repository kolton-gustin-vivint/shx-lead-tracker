# Zite → standalone migration notes

What was replaced and where the seams are.

| Zite module | Replacement |
| --- | --- |
| `zitejs/backend` `createEndpoint`, `ZiteError` | `server/lib/endpoint.ts` (`createEndpoint`, `ApiError`; `ZiteError` alias kept) |
| `zitejs/integrations` table clients + record types | `server/airtable/index.ts` + `schema.generated.ts` (generated from the live base) |
| `zitejs/api` typed client | `src/lib/api.ts` (types inferred from `server/api`) |
| `zitejs/auth` `useAuth`, `loginWithRedirect`, `logout` | `src/lib/auth.ts` + `server/lib/auth.ts` — `AUTH_MODE=email` checks the address against SHX Team (no password, like the original), `AUTH_MODE=oidc` for a real identity provider |
| `zitejs/upload` `uploadFile` | `src/lib/upload.ts` + `server/lib/upload.ts` (local disk, public URL) |
| `zitejs/db` (`zite.loginEvents`, `zite.sql`) | `server/lib/db.ts` (SQLite via `node:sqlite`) |
| `context.user` enrichment | unchanged: `server/lib/currentUser.ts` still copies the SHX Team row onto `context.user` |
| `ZITE_OPENAI_ACCESS_TOKEN` | `OPENAI_API_KEY` (old name still read as a fallback) |

Files moved out of `src/` because they only run on the server:
`src/api/*` → `server/api/*`, `src/lib/currentUser.ts`, `src/lib/openai.ts` →
`server/lib/`, `src/utils/leadUtils.ts` → `server/utils/`.

## Things to verify against the old app

- **Button fields.** `resetLead` (NIS Leads → "Reset Lead") and `loadLeads`
  (SHX Team → "Load Leads") are *button* fields in Airtable. The endpoints
  write `true` to them, as they did before. Airtable's REST API does not accept
  writes to button fields, so if these actions error, the fix is to point the
  automation trigger at a checkbox field and update the two endpoints.
- **Record order.** Queries run without a view, so Airtable returns records in
  the table's default order. `refreshAdminStats` assumes the first page of NIS
  Leads is newest-first when counting raw intake. If that count looks wrong,
  add `sort: [{ field: 'dateAdded', direction: 'desc' }]` to that query.
- **Attachment URLs.** Uploads are stored under `UPLOAD_DIR` and must be public
  long enough for Airtable to fetch them. Behind a VPN-only host, use an object
  store (S3/GCS) in `server/lib/upload.ts` instead.
- **Login history.** Login events start fresh in SQLite; the old platform DB's
  history is not migrated.
- **Session length.** `SESSION_TTL_HOURS` (default 7 days) replaces the
  platform's token refresh.
- **Email-only sign-in is not authentication.** Anyone who knows a roster
  email can sign in as that person. Sign-in attempts are throttled per IP
  (10/minute) to slow roster enumeration. The upgrade path that keeps the
  same form is a magic link: email a signed one-time URL and set the session
  when it is opened. `AUTH_MODE=oidc` is the stronger option.
