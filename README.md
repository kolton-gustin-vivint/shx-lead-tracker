# SHX Leads Tracker

React + Vite frontend with an Express API that talks to the **SHX Leader Dash**
Airtable base. This is the standalone replacement for the Zite-hosted app; the
UI and endpoint logic are unchanged, only the runtime underneath them is ours.

```
src/                 React app (Vite, Tailwind, shadcn/ui)
  lib/api.ts         typed client — one function per endpoint, POST /api/<name>
  lib/auth.ts        useAuth / loginWithRedirect / logout (session cookie)
  lib/upload.ts      uploadFile → /api/upload
packages/components  shared shadcn/ui components (@project/components/*)
server/
  app.ts             Express app: auth, uploads, endpoint dispatch
  index.ts           local/VM entry (listens, serves dist/ in production)
api/index.ts         Vercel serverless entry (same Express app)
  api/*.ts           one endpoint per file (unchanged business logic)
  api/index.ts       registry — add new endpoints here
  airtable/          typed table clients + generated schema
  lib/airtable.ts    Airtable REST adapter (findAll/findOne/create/update/delete)
  lib/auth.ts        email-roster sign-in (default) or OIDC
  lib/db.ts          SQLite (node:sqlite) for login events
scripts/generate-airtable-schema.ts   regenerates server/airtable/schema.generated.ts
```

## Running locally

```bash
cp .env.example .env        # fill in AIRTABLE_API_KEY (and OPENAI_API_KEY for AI features)
npm install
npm run dev                 # web on http://localhost:5173, API on http://localhost:3001
```

Sign-in (`AUTH_MODE=email`, the default) is an email form in the app. The
address must exist in the **SHX Team** table and not be `Inactive`; there is no
password, matching the original app. Role gating still comes from that table.
`AUTH_MODE=oidc` swaps the form for a Sign In button that goes to Google
Workspace / Microsoft Entra / Okta.

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run typecheck` | Type-checks web, server and config |
| `npm run build` | Builds the SPA into `dist/` |
| `npm start` | Serves API + built SPA on one port (`NODE_ENV=production`) |
| `npm run schema:generate` | Re-reads the base schema from Airtable's Metadata API |

## Deploying to Vercel

`vercel.json` builds the SPA into `dist/` and routes `/api/*`, `/auth/*` and
`/uploads/*` to one serverless function, `api/index.ts`, which wraps the same
Express app. Set these environment variables in the Vercel project:

| Variable | Value |
| --- | --- |
| `AIRTABLE_API_KEY` | token with `data.records:read` + `data.records:write` |
| `AIRTABLE_BASE_ID` | `apphPJFvk2oPNeJK9` |
| `SESSION_SECRET` | long random string |
| `AUTH_MODE` | `email` (or `oidc` + the `OIDC_*` variables) |
| `OPENAI_API_KEY` | only for the AI summary / next-action features |
| `ALLOWED_EMAIL_DOMAINS` | optional, e.g. `vivint.com` |

`PUBLIC_URL` defaults to the production domain Vercel provides. Two things do
not work on Vercel's read-only filesystem and need follow-up:
login-event history (SQLite falls back to `/tmp`, so 30-day counts reset) →
move to Neon/Supabase; and attachment uploads (also `/tmp`) → use Airtable's
direct upload endpoint or blob storage. Long paginating endpoints
(`getLeadCount`, `getLeadStats` for managers) can exceed the function timeout
on large tables; see `VERIFICATION.md`.

## Production checklist (any host)

1. Pick `AUTH_MODE`. With `oidc`, set `OIDC_ISSUER`, `OIDC_CLIENT_ID`,
   `OIDC_CLIENT_SECRET` and register `<PUBLIC_URL>/auth/callback` with the
   provider. For Microsoft Entra use the tenant-specific issuer
   (`https://login.microsoftonline.com/<tenant-id>/v2.0`).
2. `SESSION_SECRET` set to a long random value. `PUBLIC_URL` and `WEB_URL` set
   to the public origin (they are the same when the API serves the SPA).
3. `PUBLIC_URL` must be reachable from the internet: Airtable downloads
   Self-Gen attachments from `<PUBLIC_URL>/uploads/...`.
4. On a VM/container, persist `DATA_DIR` (SQLite login events) and `UPLOAD_DIR`.
5. Optional: `ALLOWED_EMAIL_DOMAINS=vivint.com`.

## How the Airtable layer works

Endpoints use camelCase keys (`record.customerName`, `filters: { status: 'NEW' }`).
`schema.generated.ts` maps each key to the exact Airtable field name using the
same convention the old runtime used (`"# Assigned Leads"` → `assignedLeads`,
`"Assigned Leads"` → `assignedLeads1`, `"Completed?"` → `completed`).

Filters:

| Filter | Airtable formula |
| --- | --- |
| `status: 'NEW'` | `{Status} = "NEW"` |
| `status: { contains: 'CLOSED' }` | `FIND("CLOSED", {Status} & "") > 0` |
| `status: { not: 'Inactive' }` | `{Status} != "Inactive"` |
| `completed: false` | `NOT({Completed?})` |
| `id: { in: [...] }` | `OR(RECORD_ID() = "…", …)` in chunks of 100 |
| `assignedPro: { contains: 'rec…' }` | resolved via the inverse link (`SHX Team → Assigned Leads`) into an id set |

Airtable formulas cannot see linked record ids, so link filters by id are
resolved through the inverse link field on the other table. Every link field
the app filters on has one. Pagination cursors for id-set queries look like
`ids:<chunk>:<airtableOffset>`; everything else uses Airtable's own offset.

Requests are throttled to Airtable's 5 requests/second and retried on 429/5xx.

If a field is renamed or added in Airtable, run `npm run schema:generate`
(needs a token with `schema.bases:read`) and commit the result.
