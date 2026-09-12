# AI_RULES.md — FYK Consolidated

Authoritative rules for anyone (human or agent) editing this codebase. They exist
because this repo previously accumulated a second identity system, a second ORM, a
third router layer and ~30 screens that were CSS-only. Every rule below is there to
make that class of drift expensive.

## What FYK is

A gay social/dating app for men: nearby discovery, a live Board, real 1:1 chat,
member-hosted events, block/report, and a moderation queue a human works through.
Adults only. The product is deliberately small: **a feature that is visible must
work**, otherwise it is removed or truthfully disabled.

## Stack (verified against package.json)

| Layer | Technology |
|---|---|
| Framework | TanStack Start (Vite 8, React 19, file-based routes) |
| Styling | Tailwind v4 via `@tailwindcss/vite`; tokens in `src/styles.css` |
| Server API | One dispatcher: `src/server/router.ts`, entered at `src/routes/api/$.ts` |
| Data + auth | Supabase Postgres + GoTrue via `@supabase/ssr`; session in httpOnly cookies |
| Authorization | Row-level security and triggers in `supabase/migrations/0001-0007` |
| Client state | Zustand (only for the toast queue) |
| Server state | TanStack Query |
| Validation | Zod, on the server for every body/query and on the client for UX only |
| Tests | Vitest (unit + contract), Playwright (browser smoke, `pnpm test:e2e`) |
| Format/lint | Biome. Not Prettier, not ESLint |

There is no Prisma, no Drizzle, no better-auth, no Next.js, no shadcn/Radix, no
Sentry/PostHog, no Redis/Upstash, no AI SDK, no maps library. If you are about to
add one, stop and check whether the feature needs to exist at all.

## Architecture

```
src/
  routes/            file routes; each page owns its queries
    api/$.ts         the ONLY API entry: forwards Request to handleApi()
  server/
    router.ts        route table (method, pattern, handler, limit tier)
    context.ts       RequestCtx: request id, caller, readJson/readQuery, success()
    errors.ts        ApiFailure, redact(), dbFailure(), failureResponse()
    rate-limit.ts    Postgres fixed window + labelled in-memory fallback
    supabase-server.ts  caller-scoped client + cookie sink (serializeCookie)
    data/profiles.ts  column projections, public-profile mapper, presence, coarse geo
    handlers/*.ts     one file per bounded context; no DB client outside this layer
  lib/
    client.ts        api.get/post/patch/del — cookies, retry rules, envelope unwrap
    api-types.ts     the client-side mirror of server projections
    geo.ts           haversine, grid snap, per-pair jitter, fuzzPin
    toast.ts         the whole global state budget
  components/        EntryShell (auth gate), AppShell (nav), ui/ primitives
```

### Hard rules

1. **Never hand the browser a privileged client.** Handlers build a caller-scoped
   client with the request's cookies (`createUserClient(headers)`); there is no
   service-role key in this app and `/api/health` reports one if it appears in env.
2. **Authorization lives in SQL.** A new table needs RLS enabled *and* its policies
   in the same change. Capability checks (`profiles.role`, 18+, suspended) are read
   from the database; nothing trusts a header, a cookie flag or a client assertion.
3. **Errors are shaped in one place.** Throw `badRequest/conflict/notFound/
   forbidden/dbFailure/...`; `redact()` strips tokens, keys, uuids, storage paths,
   connection strings and Postgres detail lines. A raw error message, stack trace,
   SQLSTATE or `PGRST…` code must never reach a screen.
4. **Rate limiting is pre-handler.** Register a `limit` tier in the route table; the
   key is `rateBucket(tier, userId ?? ip, method, pattern)`. The limiter runs before
   the DB call and before the handler, so cost and abuse surface scale together.
5. **Every route validates its input** with a Zod schema via `readJson`/`readQuery`.
   Schemas are exported from the handler and covered in
   `src/server/handlers/contracts.test.ts`, because the UI quotes their limits.
6. **Response shapes are mirrored** in `src/lib/api-types.ts`. If a handler changes a
   projection, that file changes in the same commit; pages must not invent fields.
7. **No fake capability claims.** A page that needs a table checks
   `useShell().capable("chat")` and renders `StateBlock kind="disabled"` with the
   real reason. No "coming soon", no disabled-button-that-actually-does-nothing,
   no mock data, no demo accounts, no seeded content behind a marketing label.
8. **Privacy math is server-side.** Locations are snapped to the ~250 m grid before
   storage (and `snap()` must stay idempotent — there is a test), distances are
   jittered per viewer/target pair, and read-only projections never expose raw
   coordinates, ids of other viewers, or account state that a blocked member
   should not learn.
9. **Migrations are append-only and ordered.** `supabase/migrations/0001…0007`;
   read `supabase/migrations/README.md` first. SQL that has not been executed
   against a real database must be described as unverified, never as done.
10. **Deletion beats scaffolding.** If a system loses its last caller, delete the
    code, the routes, the schema, the env vars and the copy that advertises it.
    `premium_entitlements`, the AI voice stack, the god-store and the King Pet
    table were removed this way.

## Commands

```bash
pnpm dev              # vite dev, port 3000
pnpm typecheck        # tsc --noEmit — must be 0
pnpm test             # vitest run
pnpm test:e2e         # playwright (needs `pnpm exec playwright install chromium`)
pnpm build            # vite build (client + SSR bundles)
pnpm verify           # all three gates that a claim of "done" depends on
pnpm generate-routes  # tsr generate, if routeTree.gen.ts is stale
```

`pnpm verify` passing is the minimum bar before saying a change works. A green type
check is not proof the feature works against real data — say what you actually ran.
