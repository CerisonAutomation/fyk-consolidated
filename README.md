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
