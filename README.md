# FYK — Find Your King

Premium LGBTQ+ dating platform. Enterprise hexagonal architecture.

## Quick Start

```bash
# Install
pnpm install

# Setup database
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
DATABASE_URL="postgresql://..." npx prisma generate
pnpm db:push
pnpm db:seed

# Development
pnpm dev

# Build
pnpm build

# Test
pnpm test
```

## Architecture

```
src/core/
├── domain/      — Pure types + business logic (no I/O)
├── ports/       — Interface contracts
├── application/ — Use cases
└── api/         — Unified HTTP client

src/adapters/
├── prisma/      — Database implementations
└── browser/     — Browser API implementations

src/components/  — UI components
src/routes/      — TanStack Router routes
src/domains/     — AI, economy, pet, social modules
src/lib/         — Utilities
```

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
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to DB |
| `pnpm db:seed` | Seed database |

## Tech Stack

- React 19 + TypeScript 6
- TanStack Start + Router + Query
- Prisma 7 + PostgreSQL
- Supabase (Auth, Realtime, Storage, Edge Functions)
- Tailwind CSS 4
- Vite 8
- Vitest + Playwright
- Docker + GitHub Actions CI/CD
