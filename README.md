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
```

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
| `pnpm test` | Run tests |
| `pnpm typecheck` | Type check |
| `pnpm db:generate` | Generate a Drizzle SQL diff from `drizzle/schema.ts` |
| `pnpm db:push` | Apply the Drizzle schema to `DATABASE_URL` |
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
