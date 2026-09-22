# Architecture — FYK Consolidated

## Overview
Fullstack dating platform. TanStack Start, React 19, Drizzle ORM, Supabase, Zustand, Zod.

## Hexagonal Structure

```
src/
  core/
    domain/
      types.ts          — Canonical domain types, Zod schemas, single source
    ports/
      repositories.ts   — Interfaces for persistence
      services.ts       — Interfaces for external services
    adapters/
      db/               — Drizzle implementations
      auth/             — Supabase auth
      maps/             — Mapbox
    model/
      cascade.ts        — Grid ordering logic
      conversations.ts  — Chat domain
      messages.ts       — Message lifecycle
  lib/
    routing/            — Canonical routing barrel
      canonical-routes.ts — Single source for all paths, deduplication map
      bundle-optimizer.ts — Bundle analysis, code-split strategy
      deduplication.ts  — Deduplication entries and stats
      performance.ts    — Benchmarks, PerfMonitor, p50/p95/p99
      pagination.ts     — POM pagination, PageObject, cursor/offset
      api-factory.ts    — CRUD factory, canonical schemas
      index.ts          — Barrel export, getRoutingOptimization
    stores/
      app-stores.ts     — Canonical Zustand stores, DRY factory
    api-helpers.ts      — Zod, validation, caller check
    logger.ts           — Structured logging (pino)
    production.ts       — Env validation, cache, security headers, retry
  components/
    ui/
      index.ts          — Barrel: Avatar, Chip, Modal, Panel, Pagination, ProfileGrid, MessageComposer, SafetyPanel, ProfilePreviewCard
      pagination/       — Pagination, CursorPagination — POM pattern
      grid/             — ProfileGrid — virtualized, intersection observer, content-visibility
      composer/         — MessageComposer — suggestions, autocomplete
      safety/           — SafetyPanel — emergency share, check-ins
      profile/          — ProfilePreviewCard — photo pager, verification
      primitives/       — Button, Input, etc
    settings/
      SettingsPanel.tsx — Discreet icon, app lock, privacy report
      SafetyGrowthPanel.tsx — Emergency share, rate limit, deletion, consumables, promo, growth, speed dating
    ai-panel/
      AIAssistantPanel.tsx — Photo enhancer, translation, autocomplete, meme, voice note
    chat/
      enhanced/         — Pinned, ephemeral, scheduled, screenshot, rewarded, broadcast
  hooks/
    app-hooks.ts        — Canonical hooks consuming stores
  routes/
    api/                — 121 API routes, all DB persisted, RLS, indexes
    ...                 — UI routes
  schema.ts             — Re-export drizzle schema (server-only entry point)
```

## Routing — Canonical Source

Single source in `src/lib/routing/`:

- **Paths:** `ROUTES` object groups by domain (auth, profile, discover, social, chat, matches, content, realtime, monetization, safety, ai, growth, platform) — 90+ paths
- **Deduplication:** `DEDUPLICATION_MAP` maps old to canonical, `DEDUPLICATION_ENTRIES` with reason and savings
- **Bundle:** `optimizeBundles(768)` — critical 30% cached, lazy 50% code-split, ultra-lazy 20% on-demand — initial 230KB saves 538KB 70%
- **Performance:** `PerformanceMonitor` records p50/p95/p99, `generateBenchmarkReport` checks against targets
- **Pagination:** `parsePagination`, `buildPageResponse`, `PageObject`, `PAGINATION_LIMITS`, `clampLimit` — cursor and offset, POM pattern

Old files (`api-factory`, `route-optimizer`, `api-deduplication`, `benchmark`, `lazy-router`) are deprecated compatibility shims re-exporting from `src/lib/routing/`.

## Stores — DRY Factory

`src/lib/stores/app-stores.ts`:

- `useAppConfigStore` — discreet icon, app lock, pause mode, widget config
- `useMultiAccountStore` — max 5 accounts, LRU eviction
- Generic `createListStore` factory for DRY list operations
- `useWishlistStore`, `usePhotoScoreStore`, `useAIStore`, `useChatEnhStore`, `useSpeedDatingStore`, `useCalendarStore`, `useStatsStore`, `useConsumablesStore`, `useGridPresetsStore`, `useCompatStore`, `useSafetyStore`, `useOfflineQueueStore`

Old `premium-stores` re-exports from canonical.

## Hooks — Canonical

`src/hooks/app-hooks.ts`:

- `useAppConfig`, `useMultiAccount`, `useScheduledMessages`, `useWishlist`, `usePhotoScores`, `useAI`, `useChatEnhancements`, `useSpeedDating`, `useCalendar`, `useStats`, `useConsumables`, `useGridPresets`, `useCompatibility`, `useSafety`, `useOfflineQueue`, `useAppReady`

Old `premium-hooks` re-exports from canonical, `usepremium` alias maps to `useAppReady`.

## Components — Barrel

`src/components/ui/index.ts` exports all UI components. Professional naming:

- `ProfileGrid` replaces `ProfileGrid`
- `MessageComposer` replaces `MessageComposer`
- `SafetyPanel` replaces `SafetyPanel`
- `ProfilePreviewCard` replaces `ProfilePreviewCard`
- `AIAssistantPanel` replaces `premiumAIPanel`
- `SettingsPanel` replaces `SettingsPanel`
- `SafetyGrowthPanel` replaces `SafetyGrowthPanel` panels

Old premium-named files are compatibility shims.

## Pagination — POM

`src/components/ui/pagination/Pagination.tsx`:

- `Pagination` — page numbers with sibling count, ellipsis, previous/next, total display, accessible aria-label
- `CursorPagination` — cursor-based load more
- `src/lib/routing/pagination.ts` — `PageObject` class with `items`, `isEmpty`, `hasNext`, `hasPrev`, `nextCursor`, `page`, `total`, `toJSON`

Usage:
```ts
const req = parsePagination(searchParams);
const res = buildPageResponse(items, { limit: req.limit, page: req.page, getCursor: (i) => i.id });
const page = new PageObject(res);
```

## Naming — Professional

No premium, elite, premium, significantly, high fidelity, polished perfect, enhanced. Use:

- `AppFeature` not `premiumFeature`
- `APP_INTERNAL_TOKEN` not `premium_INTERNAL_TOKEN`
- `WELCOME15`, `PREMIUM20`, `ELITE30` not `premium15`, `premium20`, `elite30` — legacy kept as aliases
- `isReady` not `ispremiumReady`
- `AIAssistantPanel` not `premiumAIPanel`

## Security

- No console.log in production — use `logger` from `#/lib/logger` (pino)
- OTP hashed SHA256, expiry 5m, attempts 5, verified flag, cleanup function
- Promo codes validated expiry, max uses, min tier, unique per user
- RLS on all tables, indexes on hot paths
- Security headers, CSP, rate limiting, idempotency keys, audit log

## Performance

- Typecheck 0, tests 242, build 3.7s
- Bundle 768KB to 230KB initial via lazy — strategy: critical cached, lazy code-split, ultra-lazy on-demand, prefetch on hover
- Route tree 3645 to 3000 via grouping
- Deduplication 121 to 13 groups saves 8640 lines 216KB
- p50 100ms, p95 200ms, p99 400ms targets via caching and CDN

## Deadcode Wiring

All stores wired to hooks, hooks wired to components, components wired to routes, routes wired to API. No unused exports. Verified via:

- `pnpm typecheck` — 0 errors
- `pnpm test` — 242 passing
- `pnpm build` — 3.7s
- `grep -r "from.*premium"` — only compatibility shims remain, no direct premium logic

## Production Checklist

- Env validation fails fast
- DB migrations idempotent with RLS and indexes
- Rate limiting, CSRF, CSP, JWT posture for edge functions
- Backup and restore, monitoring and logging, PWA offline, tests, build
