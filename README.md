# SHX Leads Tracker

Next.js app backed by the **SHX Leader Dash** Airtable base. This replaced the
Zite-hosted app; the UI and the endpoint logic are unchanged, only the runtime
underneath them is ours.

> ⚠️ **There is no authentication yet.** Every request is served as the single
> team member named by `APP_USER_EMAIL`, so anyone who can reach the server has
> that person's access. Keep this to local development until auth is added —
> see *Adding authentication* below.

```
app/
  layout.tsx             root layout, global CSS, Speed Insights
  page.tsx               the app
  api/[name]/route.ts    endpoint dispatch — POST /api/<name>
  api/upload/route.ts    Self-Gen attachment uploads
  uploads/[...path]/     serves uploaded attachments back to Airtable
src/
  AppRoot.tsx            client entry: error boundary + React Query
  App.tsx                roster/role gating, then the dashboard
  components/            the dashboard UI
  lib/api.ts             typed client, one function per endpoint
server/
  api/*.ts               one endpoint per file (business logic)
  api/index.ts           registry — add new endpoints here
  airtable/              typed table clients + generated schema
  lib/airtable.ts        Airtable REST adapter
  lib/session.ts         resolves the current user — where auth belongs
  lib/db.ts              SQLite (node:sqlite) for login events
packages/components/     shared shadcn/ui components
scripts/generate-airtable-schema.ts   regenerates the Airtable schema
```

## Running it

```bash
cp .env.example .env     # fill in AIRTABLE_API_KEY and APP_USER_EMAIL
npm install
npm run dev              # http://localhost:3000
```

`APP_USER_EMAIL` must match an email in the **SHX Team** table. That row's Role
decides whether the manager-only tabs appear. If it matches nothing, the app
shows an Access Denied screen naming the misconfiguration.

Add `OPENAI_API_KEY` for the AI summary and next-action features.

| Script | What it does |
| --- | --- |
| `npm run dev` | Next dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serves the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run schema:generate` | Re-reads the base schema from Airtable |

## Adding authentication

All of it goes in one place: `requestUser()` in `server/lib/session.ts`. Today
it returns a user built from `APP_USER_EMAIL`. Replace it so the email comes
from whoever is signed in, and throw `ApiError` with code `UNAUTHORIZED` when
nobody is. Both route handlers already call it through `requireUser()`, which
is async so a real lookup drops straight in.

Nothing else has to change. Endpoints call `enrichCurrentUser`, which looks the
SHX Team row up by email and supplies `role`, `status` and `assignedLeads1`, so
authorization keeps working the way it always has: identity decides who you
are, the roster decides what you may see.

Two pieces of UI were removed along with the old sign-in and will need adding
back: the Sign Out control in the sidebar and mobile menu, and a sign-in screen
if the chosen method needs one.

## Deploying to Vercel

Next.js on Vercel is zero-config — there is no `vercel.json`. Environment
variables to set:

| Variable | Value |
| --- | --- |
| `AIRTABLE_API_KEY` | token with `data.records:read` + `data.records:write` |
| `AIRTABLE_BASE_ID` | `apphPJFvk2oPNeJK9` |
| `APP_USER_EMAIL` | an email in the SHX Team table |
| `OPENAI_API_KEY` | only for the AI summary / next-action features |

**Do not deploy this publicly while `APP_USER_EMAIL` is the only thing
identifying the user.** Until auth exists, keep it behind Vercel's deployment
protection or run it locally.

Two things still need follow-up on Vercel's read-only filesystem: login-event
history (SQLite falls back to `/tmp`, so 30-day counts reset) should move to
Neon or Supabase Postgres, and attachment uploads (also `/tmp`) need Airtable's
direct upload endpoint or blob storage. Long paginating endpoints can also
exceed the function timeout. See `VERIFICATION.md`.

## How the Airtable layer works

Endpoints use camelCase keys (`record.customerName`, `filters: { status: 'NEW' }`).
`schema.generated.ts` maps each key to the exact Airtable field name using the
same convention the old runtime used (`"# Assigned Leads"` → `assignedLeads`,
`"Assigned Leads"` → `assignedLeads1`, `"Completed?"` → `completed`).

| Filter | Airtable formula |
| --- | --- |
| `status: 'NEW'` | `{Status} = "NEW"` |
| `status: { contains: 'CLOSED' }` | `FIND("CLOSED", {Status} & "") > 0` |
| `status: { not: 'Inactive' }` | `{Status} != "Inactive"` |
| `completed: false` | `NOT({Completed?})` |
| `id: { in: [...] }` | `OR(RECORD_ID() = "…", …)` in chunks of 100 |
| `assignedPro: { contains: 'rec…' }` | resolved via the inverse link into an id set |

Airtable formulas cannot see linked record ids, so link filters by id are
resolved through the inverse link field on the other table. Pagination cursors
for id-set queries look like `ids:<chunk>:<airtableOffset>`; everything else
uses Airtable's own offset. Requests are throttled to Airtable's 5 requests per
second and retried on 429/5xx.

If a field is renamed or added in Airtable, run `npm run schema:generate`
(needs a token with `schema.bases:read`) and commit the result.
