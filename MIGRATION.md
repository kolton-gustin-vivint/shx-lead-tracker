# Migration notes

Two migrations happened. **Zite → standalone** (2026-09-28) replaced the hosted
Zite runtime with our own code. **Vite/Express → Next.js** (2026-09-29)
replaced the framework.

Authentication was removed in the second migration and has not been replaced —
see *Authentication* at the end.

## Zite → standalone

What was replaced and where the seams are.

| Zite module | Replacement |
| --- | --- |
| `zitejs/backend` `createEndpoint`, `ZiteError` | `server/lib/endpoint.ts` (`createEndpoint`, `ApiError`; `ZiteError` alias kept) |
| `zitejs/integrations` table clients + record types | `server/airtable/index.ts` + `schema.generated.ts` (generated from the live base) |
| `zitejs/api` typed client | `src/lib/api.ts` (types inferred from `server/api`) |
| `zitejs/auth` `useAuth`, `loginWithRedirect`, `logout` | nothing — the app has no sign-in (see below) |
| `zitejs/upload` `uploadFile` | `src/lib/upload.ts` + `server/lib/upload.ts` (local disk, public URL) |
| `zitejs/db` (`zite.loginEvents`, `zite.sql`) | `server/lib/db.ts` — SQLite at first, now Neon Postgres |
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
- **Login history.** Login events now go to a `login_events` table in Neon
  (`DATABASE_URL`). They began in SQLite, which could not work on Vercel — each
  serverless instance had its own copy under `/tmp`. The old platform DB's
  history was never migrated, so counts start from the Neon switch.
## Vite/Express → Next.js

Everything that held business logic moved unchanged: the 31 endpoint files,
the Airtable adapter and generated schema, the SHX Team roster and role gating,
and the whole dashboard UI. What changed is the shell around them.

| Before | After |
| --- | --- |
| Vite dev server + `index.html` + `src/main.tsx` | Next App Router: `app/layout.tsx`, `app/page.tsx` |
| Express app (`server/app.ts`, `server/index.ts`, `api/index.ts`) | Route handlers under `app/api/` |
| Express dispatcher for `POST /api/:name` | `app/api/[name]/route.ts` (same contract) |
| `express.static` for `/uploads` | `app/uploads/[...path]/route.ts` |
| Home-grown email sign-in (`server/lib/auth.ts`, `src/components/LoginScreen.tsx`) | removed — no sign-in |
| Signed session cookie (`server/lib/session.ts`) | `session.ts` now builds `context.user` from `APP_USER_EMAIL` |
| `vercel.json` rewrites to one Express function | none — Next on Vercel is zero-config |
| React 18 | React 19 |

Notes on the seams:

- **`context.user` is unchanged in shape.** `APP_USER_EMAIL` supplies the
  email; `enrichCurrentUser` still copies the SHX Team row on top, so
  `context.user.id` is the Airtable record id and `role` works as before.
- **Roster gating still lives in the app.** The configured email must exist in
  SHX Team and not be Inactive, or the app shows Access Denied — which now
  reads as a configuration error rather than a rejected sign-in.
- **Node ESM `.js` import extensions were removed** from `server/**`. They were
  needed when the server ran under `tsx`; Next bundles it instead.
- **`AUTH_MODE`, `SESSION_SECRET`, `SESSION_TTL_HOURS`, `WEB_URL` and the
  `OIDC_*` variables are gone**, replaced by `APP_USER_EMAIL`.
- **The Sign Out control was removed** from the sidebar and mobile menu, since
  there is no session to end.

## Authentication

Sign-in is Magistrate (Field Pro Mobile Okta). Authorization is separate and
lives in `server/lib/roster.ts`: `requireRosterUser` refuses any session whose
email is not an active row in the SHX Team table, and both route handlers call
it before dispatch. Endpoints therefore receive a `context.user` that already
carries the roster row, and `enrichCurrentUser` is now a no-op in that path —
it is kept so the endpoint files stay unchanged.

### Previously (removed)

There is none. `requestUser()` in `server/lib/session.ts` returns a user built
from `APP_USER_EMAIL`, so every request is served as that one person and anyone
who reaches the server gets their access.

That function is the whole seam. Replace it so the email comes from whoever is
signed in and throw `ApiError` `UNAUTHORIZED` otherwise; `requireUser()` is
already async and both route handlers already call it. Authorization does not
move — `enrichCurrentUser` keeps deriving role and assigned leads from the SHX
Team row.

Magistrate (`@FO-Enablement-Vivint/magistrate`, Field Pro Mobile Okta) was
wired up and then removed before it could be tested. If it comes back, note
that it requires Next.js and React 19 (both already in place), a GitHub token
with `read:packages` to install, and authorization from the Enablement team
before sign-in works. It ships no logout and its sessions are fixed at 8 hours.
