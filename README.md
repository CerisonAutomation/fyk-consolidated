# FYK — Find Your King

Premium LGBTQ+ dating platform. Enterprise hexagonal architecture.

## Quick Start

```bash
# Install
pnpm install

# Setup database — Supabase first, then the Drizzle schema
cp .env.example .env.local
# Edit .env.local: SUPABASE_URL / SUPABASE_ANON_KEY (browser), and
# DATABASE_URL (the *API's* connection, via the transaction pooler, `prepare: false`).
# SUPABASE_JWT_SECRET is optional but it is what lets a page render decide who is
# asking (see Deployment notes below); without it, verification calls GoTrue.
supabase db push                                  # applies supabase/migrations/*.sql
pnpm db:migrate:sql                               # or: psql "$DATABASE_URL" -f each file
pnpm db:generate                                  # Drizzle diff from drizzle/schema.ts, if you changed it
pnpm db:seed                                      # demo rows only; the app works without them

# Development
pnpm dev

# Build
pnpm build

# Test
pnpm test

# Check your own work before pushing (format, lint, imports)
pnpm check --write
```

Everything above runs offline. `pnpm check --write` is what a contributor needs: it is the
Biome gate for the files you name, and CI blocks on the same rules for *changed* files
(`pnpm lint:changed`) and on the API/integration/lib scope outright (`pnpm lint:code`). The
repo-wide `pnpm lint` still reports ~314 pre-existing errors in screen components and exits
1 — see AUDIT.md §2.18 for why that is a ledger, not a to-do you must finish first.

## Architecture

```
drizzle/schema.ts   The API's schema: written from supabase/migrations, no codegen
src/db.ts           postgres.js pool (`prepare: false`), created per process on first query
src/schema.ts       server-only re-export of the above (`#/schema`)

src/core/
├── domain/      — Pure types + business logic (no I/O)
├── ports/       — Interface contracts
├── application/ — Use cases
└── api/         — Unified HTTP client + the React Query hooks the screens use

src/routes/api/  — JSON API (TanStack Start server routes): the only writer for
                   money, privilege, presence and cross-user edges
src/integrations/supabase/ — browser reads, guarded by row-level security
src/components/  — UI components
src/domains/     — AI, demo, grid, economy modules
src/lib/         — Utilities (`economy.ts` is the shop/pricing/quota authority)
supabase/migrations/ — the SQL that decides what a browser token may do
```

There is deliberately no ORM-side migration history for the tables the browser
reads: `drizzle-kit push` would `drop` what this schema does not model, so
`supabase/migrations` is the only place a column is created, and
`drizzle/schema.ts` follows it. See `AUDIT.md`.

## Supabase Features

- Auth (JWT + custom claims + rate limiting)
- Realtime (messages + notifications + typing + presence)
- Vector Search (pgvector 384-dim)
- Storage (6 buckets with RLS)
- Edge Functions (AI, embedding, notify, moderate, cleanup)

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm test` | Run tests (unit, no network) |
| `pnpm typecheck` | Type check |
| `pnpm verify` | `typecheck` + `test` + `build` + `lint:code`, the whole pre-push gate |
| `pnpm check` / `pnpm format` | Biome check (lint + format + import order) / format only. Pass paths — bare means the repo |
| `pnpm lint` | `biome lint`, repo-wide. **Exits 1 on ~314 grandfathered errors** by design; use the two below |
| `pnpm lint:code` | Zero-tolerance lint of the API/integration/lib/schema scope. Blocking |
| `pnpm lint:changed` | Blocking gate for the diff against `main`, checked against `lint-baseline.json` (a changed file may not exceed its recorded count per rule) |
| `pnpm lint:baseline` | Regenerate `lint-baseline.json` after fixing violations, in the same commit as the fix |
| `pnpm icons:build` | Regenerate `public/icons/*.png`, `apple-touch-icon-180.png` and `manifest.webmanifest` from the `src/styles.css` tokens and `public/logo-square.svg` |
| `pnpm push:vapid-keys` | Print a fresh VAPID key pair and the two internal function tokens (nothing is written to disk) |
| `pnpm generate-routes` | `tsr generate` — re-run after adding or renaming a route file, or `tsc` will not know it exists |
| `pnpm db:generate` | Generate a Drizzle SQL diff from `drizzle/schema.ts` |
| `pnpm db:push` | Apply the Drizzle schema to `DATABASE_URL` |
| `pnpm db:migrate:sql` | Run every `supabase/migrations/*.sql` in filename order with `ON_ERROR_STOP=1`. Prefer `supabase db push` for a real project: the legacy `002_rls`/`003_storage`/`004_functions` files sort *after* `0024`, and the numbered chain is written to be idempotent but ordered |
| `pnpm db:studio` | Browse the database (Drizzle Studio) |
| `pnpm test:e2e` | Playwright suite in `e2e/` (boots the dev server) |
| `pnpm db:seed` | Seed database |

## Tech Stack

- React 19 + TypeScript 6
- TanStack Start + Router + Query
- Drizzle ORM over `postgres.js` (server) — no Prisma, no engine binaries at build time
- Supabase (Auth, Realtime, Storage, Edge Functions) + row-level security
- Tailwind CSS 4
- Vite 8
- Vitest + Playwright
- Docker + GitHub Actions CI/CD

## Push, install and offline

The app is an installable web app: a manifest and icons generated from the design tokens, a
service worker that adds an offline notice and receives push, and a home-screen badge that tracks
unread activity. All of it is asserted by `src/lib/app-shell.test.ts`, which reads the files
rather than the bundle — these artefacts have no compiler and no browser in CI.

```bash
pnpm icons:build      # regenerate public/icons/*.png + manifest.webmanifest from src/styles.css
pnpm push:vapid-keys  # mint a VAPID key pair and the two internal tokens (prints, never writes)
```

Push needs four things to line up, because the browser verifies the *sender*, not the app:

1. `VITE_VAPID_PUBLIC_KEY` in the browser env — without it the UI says "push is not configured"
   and never asks for permission (that is the intended default, not a bug).
2. `supabase secrets set VAPID_PRIVATE_KEY=… VAPID_SUBJECT=… PUSH_INTERNAL_TOKEN=… CRON_INTERNAL_TOKEN=…`
3. `supabase functions deploy notify cron-cleanup` — both are configured `verify_jwt = false` in
   `supabase/config.toml` because their callers are Postgres and a scheduler, and both **refuse to
   run** unless their `x-fyk-*-token` header matches the secret. `notify` also requires that the
   caller is the database: it never writes to `notifications`, it only delivers what is already there.
4. `alter role authenticated set fyk.push_notify_url = 'https://<ref>.functions.supabase.co/v1/notify'`
   and `fyk.push_notify_token = '<PUSH_INTERNAL_TOKEN>'`. While either is unset the trigger does
   nothing, so a half-configured project silently sends no push instead of failing user writes.

Then point something at `POST /v1/cron-cleanup` with `x-fyk-cron-token` (or let `pg_cron` run the
two SQL jobs 0023 schedules) — expired sessions, stories and MeetNow rows are deleted nowhere else.

Enable notifications from the Activity screen (`/notifications`): the button there asks for
permission, and nothing asks on page load. On iPhone, web push is delivered only to an installed app, so add FYK
to the Home Screen first — the screen says so rather than failing quietly. The service worker is
registered only in a production build (`pnpm build && pnpm start`), because a caching worker in
front of Vite's dev server makes hot reload undebuggable.

## Privacy controls are server-owned

The switches that decide what other people see — online status, last online, distance, ghost mode,
hide-from-search, read receipts, and every notification category — are columns on `users` written
through `PUT /api/settings`, not `localStorage`. `src/lib/settings-map.ts` is the only place a
screen's vocabulary maps onto a column; `src/lib/settings-map.test.ts` checks that map against
`drizzle/schema.ts` and against the endpoint's allow-lists, so a switch cannot be re-pointed at the
browser store without failing CI. (It used to be, which is how "Hide my online status" could render
"Saved ✓" while presence kept broadcasting.)

Two rules the database enforces, because a client cannot be trusted with either:

- `0026_privacy_controls.sql` makes the push trigger consult `users.notif_prefs` and `dnd_mode`, and
  exempts `check_in`/`check_in_resolved`/`check_in_overdue` from Do Not Disturb — a mute for dinner
  is not consent to miss an alarm. An absent preference means *deliver*: no migration turns "never
  opened Settings" into "no notifications".
- ghost mode is applied by `GET /api/profile/{id}` inside the `insert … select` that records a
  visit, so the test cannot be skipped by calling a different endpoint or raced by toggling the
  switch mid-request.

Device-local by design (and not a stub): units, background-presence (`stayOnline`, which
`src/domains/presence/heartbeat.ts` reads), auto-updating location, the grid's geohash and its
filter state.

## Deployment notes

Four things a reviewer asks about, answered where they will be read:

- **Sessions are cookies.** `@supabase/ssr`'s browser client persists
  `sb-<ref>-auth-token`, which is what allows `GET /settings` to be answered with a
  redirect instead of the settings screen (AUDIT §2.16). They are *not* `HttpOnly` —
  the browser client has to read them — so cross-site *use* is refused by
  `assertSameOrigin` on every `/api/*` method, and the remaining XSS exposure is
  tracked in §3.4/§3.19. A browser that was signed in before this change signs in once
  more; the old `localStorage` key is not read.
- **`supabase db push` applies `supabase/migrations/*.sql` in version order, each file in
  one transaction, and stops at the first error.** That is why `0009` contains only what is
  valid at its point in the sequence and `0023` carries the rest (§2.15): a file that opens
  with `ALTER SYSTEM` aborts every migration after it, quietly.
- **`SUPABASE_JWT_SECRET` is the offline verification switch**, and the reason the API and
  the HTML document can share one session check.
- **Push is opt-in at the database.** `0023`'s `enqueue_push_notification()` fires only
  when `fyk.push_notify_url` is set *and* `pg_net` exists; `cron-cleanup` is scheduled only
  when `pg_cron` is installed. Deploying `supabase/functions/notify` and `cron-cleanup`
  without those means the code is present and inert, which is the state to avoid.
