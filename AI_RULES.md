# AI_RULES.md — FYK Consolidated Project

## Project Overview

FYK (Find Your King) is an LGBTQ+ dating and social platform built with TanStack Start. This document defines the authoritative rules for AI coding assistants working on this codebase.

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | TanStack Start | 1.168.x | Full-stack React framework with SSR |
| UI Library | React | 19.x | Component rendering |
| Language | TypeScript | 6.x | Type safety (strict mode) |
| Build Tool | Vite | 8.x | Dev server and bundler |
| Database ORM | Drizzle ORM | 0.45.x | Type-safe SQL for the JSON API (`drizzle/schema.ts`) |
| Database | PostgreSQL (Supabase) | 15+ | Primary data store |
| Auth | Supabase Auth (GoTrue) | — | `@supabase/supabase-js` in the browser; token/cookie verification on the server |
| Styling | Tailwind CSS | 4.x | Utility-first CSS via `@tailwindcss/vite` |
| UI Components | shadcn/ui (new-york, zinc) | latest | Radix-based primitives |
| Linting/Formatting | Biome | 2.x | NOT Prettier, NOT ESLint |
| Testing | Vitest | 3.x | Unit and integration tests |
| E2E Testing | Playwright | 1.62.x | End-to-end browser tests |
| State (server) | TanStack Query | 5.x | Server-state management |
| State (client) | TanStack Store | 0.11.x | Lightweight client-only global state |
| AI Integration | TanStack AI | 0.48.x | Multi-provider AI (Anthropic, OpenAI, Gemini, Ollama) |
| Maps | MapLibre GL / Leaflet | 6.x / 1.9.x | Map rendering |
| Real-time | Socket.IO | 4.x | WebSocket communication |
| Payments | Stripe | 9.x | Billing and subscriptions |
| Email | Resend | 6.x | Transactional email |
| Rate Limiting | Upstash Redis | 1.x | Rate limits and caching |
| Observability | Sentry | 10.x | Error tracking |
| Analytics | PostHog | 1.x | Product analytics |
| Validation | Zod | 4.x | Runtime schema validation |
| Forms | react-hook-form + @hookform/resolvers | 7.x / 5.x | Form state and validation |
| Animations | Framer Motion | 13.x | Declarative animations |
| Icons | Lucide React | 0.577.x | Icon library |

---

## Library Usage Rules

### USE These Libraries

| Task | Library | Import Pattern |
|------|---------|---------------|
| Routing | `@tanstack/react-router` | `createFileRoute`, `Link` |
| Data Fetching | `@tanstack/react-query` | `useQuery`, `useMutation`, `useSuspenseQuery` |
| Client State | `@tanstack/store` | `Store`, `useStore` |
| Forms | `react-hook-form` + `zod` | `useForm`, `zodResolver` |
| UI Components | `src/components/ui/*` (shadcn/ui) | Direct imports |
| Icons | `lucide-react` | `import { Icon } from 'lucide-react'` |
| Styling | Tailwind CSS 4 | Utility classes, `var(--token)` |
| Validation | `zod` | `z.object({...})`, `z.infer<typeof schema>` |
| Database (server) | Drizzle | `import { db } from '#/db'` + `import { users } from '#/schema'` |
| Database (browser) | `@supabase/supabase-js` | `getSupabase()` — RLS enforces access |
| Auth (client) | Supabase | `getSupabase().auth` / `useSupabaseSession()` |
| Auth (server) | Supabase | `getCaller(request)` from `#/lib/supabase-auth.server` |
| AI (server) | `@tanstack/ai` | `chat`, `toServerSentEventsResponse` |
| AI (client) | `@tanstack/ai-react` | `createChatClientOptions`, `useChat` |
| AI Providers | `@tanstack/ai-anthropic`, `@tanstack/ai-openai`, `@tanstack/ai-gemini`, `@tanstack/ai-ollama` | Adapter imports |
| Tables | `@tanstack/react-table` | `useReactTable`, `getCoreRowModel` |
| Maps | `maplibre-gl`, `leaflet` | Dynamic imports |
| Tooltips | `@radix-ui/react-tooltip` | Via shadcn/ui Tooltip |
| Dialogs | `@radix-ui/react-dialog` | Via shadcn/ui Dialog |
| Toasts | `sonner` | `toast()` from `sonner` |
| Utilities | `tailwind-merge`, `clsx`, `cva` | `cn()` from `#/lib/utils` |
| Rate Limiting | `@upstash/ratelimit` + `@upstash/redis` | Server-side only |
| Payments | `@stripe/stripe-js`, `stripe` (server) | Server + client |
| Email | `resend` | Server-side only |
| Image Processing | `sharp` | Server-side only |
| Sanitization | `dompurify` | Client-side HTML sanitization |
| Search | `fuse.js` | Client-side fuzzy search |
| Logger | `pino` | `import { logger } from '#/lib/logger'` |
| Geospatial | `h3-js` | Client-side hex indexing |

### DO NOT Use These Libraries

| Never Use | Why | Use Instead |
|-----------|-----|-------------|
| `next` / `@next/*` | This is NOT a Next.js project | TanStack Start |
| `@tanstack/router-devtools` (in prod) | Dev-only, strip from builds | Conditional import |
| `zustand` | Conflicts with TanStack Store | `@tanstack/store` |
| `redux` / `react-redux` | Overkill, wrong paradigm | `@tanstack/store` |
| `@emotion/*` | Conflicts with Tailwind | Tailwind utility classes |
| `styled-components` | Conflicts with Tailwind | Tailwind utility classes |
| `moment` / `dayjs` | Use native `Intl.DateTimeFormat` | Native Date APIs |
| `axios` | Unnecessary, use `fetch` | Native `fetch` |
| `lodash` | Bundle bloat | Native JS methods or targeted imports |
| `formik` | Use react-hook-form | `react-hook-form` |
| `@mui/*` | Conflicts with shadcn/ui | shadcn/ui components |
| `react-bootstrap` / `bootstrap` | Conflicts with Tailwind | Tailwind CSS |
| `eslint` (new config) | Biome handles linting | `pnpm check` |
| `prettier` | Biome handles formatting | `pnpm format` |
| `console.log` in production | Information leak, noise | `pino` logger |
| `any` type | Defeats TypeScript | Specific types or `unknown` |
| `@ts-ignore` / `@ts-expect-error` | Hides real errors | Fix the root cause |
| `require()` | ESM project | `import` syntax |
| `react-query` (v3) | Deprecated | `@tanstack/react-query` v5 |

---

## Code Style Rules

### TypeScript

```typescript
// GOOD: Explicit types, no any
interface UserProfile {
  id: string;
  displayName: string;
  age: number;
}

function getProfile(id: string): Promise<UserProfile> {
  return getDb().query.users.findFirst({ where: eq(users.id, id) });
}

// BAD: Using any
function getProfile(id: any): any {
  return getDb().select().from(users).where(eq(users.id, id));
}
```

- **No `any`** — use `unknown` and narrow with type guards
- **No `@ts-ignore`** — fix the actual type issue
- **No non-null assertions (`!`)** — use `??`, optional chaining, or explicit checks
- **Export types alongside implementations** — use `export type` for type-only exports
- **Use path aliases** — `#/` maps to `src/` (preferred), `@/` also works

### Formatting (Biome)

- **Indentation**: Tabs (not spaces)
- **Quotes**: Double quotes (not single)
- **Semicolons**: Always
- **Trailing commas**: Always
- Run `pnpm check` before committing

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files (components) | PascalCase | `UserProfile.tsx` |
| Files (hooks) | camelCase with `use` prefix | `useProfile.ts` |
| Files (utils) | camelCase | `formatDate.ts` |
| Files (types) | camelCase with `.types.ts` | `profile.types.ts` |
| Files (routes) | kebab-case matching URL | `profile.$id.tsx` |
| React components | PascalCase | `function UserProfile() {}` |
| React hooks | camelCase with `use` prefix | `function useProfile() {}` |
| TypeScript interfaces | PascalCase, no `I` prefix | `interface UserProfile {}` |
| TypeScript types | PascalCase | `type ProfileId = string` |
| Constants | UPPER_SNAKE_CASE | `const MAX_PHOTO_SIZE = 5_000_000` |
| Database tables | snake_case | `profile_photos` |
| Database columns | snake_case | `created_at` |
| CSS classes | Tailwind utilities | `className="flex items-center"` |
| CSS custom properties | kebab-case with prefix | `--sea-ink`, `--chip-bg` |

### Imports

```typescript
// 1. External packages
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

// 2. Internal aliases (preferred: #/)
import { db } from "#/db";
import { getSupabase } from "#/integrations/supabase/client";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

// 3. Relative imports (only for same-directory)
import { formatDate } from "./format-date";
```

---

## Architecture Patterns

### Domain-Driven Structure

```
src/
  routes/          # File-based routing (TanStack Router)
  components/      # Shared React components
    ui/            # shadcn/ui primitives (NEVER modify directly)
    layout/        # App shell, nav, sidebar
    features/      # Feature-specific compound components
  domains/         # Domain modules (self-contained business logic)
    profile/       # Profile domain
      profile.types.ts
      profile.queries.ts    # TanStack Query hooks
      profile.mutations.ts  # TanStack Query mutations
      profile.utils.ts      # Domain-specific utilities
    matching/      # Matching/likes domain
    messaging/     # Chat/messaging domain
    events/        # Events domain
    board/         # Community board domain
    auth/          # Authentication domain
  core/            # Core infrastructure
    api/           # API client and types
    db.ts          # Drizzle + postgres.js singleton (server only)
    schema.ts      # re-export of drizzle/schema.ts (server only)
    middleware.ts  # withSecurity: CSRF, size cap, session, rate limit
    lib/
      security.ts  # security response headers (single source of truth)
  hooks/           # Shared custom hooks
  lib/             # Utility functions
    utils.ts       # cn() and other helpers
    logger.ts      # Pino logger (server only)
      api-helpers.ts # requireCaller, readJson, publicProfile, asStringArray
      supabase-auth.server.ts # verifies the Supabase access token / cookie
    redis.ts       # Upstash Redis client
    stripe.ts      # Stripe client
    resend.ts      # Resend email client
    posthog.ts     # PostHog analytics
  integrations/    # External service wiring
    supabase/      # Supabase client config
    tanstack-query/ # Query client provider
  data/            # Static data and constants
  styles.css       # Global styles and CSS custom properties
```

### Query Hooks Pattern

```typescript
// domains/profile/profile.queries.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { prisma } from "#/db";

export function profileKeys() {
  return {
    all: ["profiles"] as const,
    detail: (id: string) => ["profiles", id] as const,
    byHandle: (handle: string) => ["profiles", "handle", handle] as const,
  };
}

export function useProfile(id: string) {
  return useQuery({
    queryKey: profileKeys.detail(id),
    queryFn: () => fetchProfile(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.detail(variables.id) });
    },
  });
}
```

### Server Functions Pattern

```typescript
// Use createServerFn for server-side operations
import { createServerFn } from "@tanstack/react-start";

export const getProfile = createServerFn({ method: "GET" })
  .validator(z.uuid())
  .handler(async ({ data: id }) => {
    return db.query.users.findFirst({ where: eq(users.id, id) });
  });
```

### Route Definition Pattern

```typescript
// src/routes/profile.$id.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profile/$id")({
  loader: async ({ params }) => {
    return getProfile({ data: params.id });
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { id } = Route.useParams();
  const { data: profile } = Route.useLoaderData();
  // ...
}
```

### Middleware Composition

```typescript
// Middleware is applied at the route level
export const Route = createFileRoute("/dashboard")({
  beforeLoad: [requireAuth, requireOnboarding],
  component: DashboardPage,
});
```

---

## File Organization Rules

1. **Routes** go in `src/routes/` — file-based routing, never manual route tree edits
2. **UI primitives** go in `src/components/ui/` — managed by shadcn/ui, never hand-edit
3. **Feature components** go in `src/components/features/` — compound component patterns
4. **Domain logic** goes in `src/domains/` — each domain is self-contained
5. **Shared hooks** go in `src/hooks/` — reusable across domains
6. **Utility functions** go in `src/lib/` — no business logic, pure utilities
7. **Generated files** are NEVER edited: `routeTree.gen.ts`, `src/generated/`
8. **Demo files** (prefixed `demo`) can be safely deleted

---

## Database Rules

### Drizzle (canonical for the JSON API)

- Import the singleton: `import { db } from "#/db"` and tables from `"#/schema"`
- `drizzle/schema.ts` is written **from the SQL in `supabase/migrations/`**: every
  column needs the explicit `text("snake_case")` name — do not rely on a name match
- `pnpm db:generate` writes a SQL diff; review it and land it as a numbered
  `supabase/migrations/00NN_*.sql`, because that folder is what deploys apply
- Never `drizzle-kit push` at production: the two user tables (§3.2 of `AUDIT.md`)
  mean a generated diff would drop columns the browser still reads
- `postgres.js` must keep `prepare: false` (Supabase transaction pooler) and the
  pool must stay bounded (`DATABASE_POOL_MAX`)
- `prisma/schema.prisma` remains only for `prisma/seed*`; if you change a column,
  change both files or delete the Prisma model

### Errors reaching clients

- `#/middleware` `jsonError(message, status, error?)`: `details` are for logs and
  are never serialised; unexpected errors become
  `500 {"error":"Something went wrong. Please try again."}`
- Map constraint violations explicitly (`isMissingProfileError` → `409`), never by
  forwarding a driver message

### Supabase

- Supabase owns auth and storage; the server API reads/writes through Drizzle
- RLS policies enforce row-level security — do NOT bypass with service role in client code
- Storage buckets: `avatars-public`, `photos-public`, `albums-private`, `chat-media-private`, `event-media-public`
- Private data uses signed URLs, never raw file access

---

## Auth Rules

- Client: `getSupabase().auth` (supabase-js persists the session); never build a
  second token store — `#/lib/client` reads the bearer from the live session on
  every API call, which is what makes sign-out actually sign out
- Server: `await getCaller(request)` inside `withSecurity` handlers; `auth:
  "required"` is the default for POST/PATCH/PUT/DELETE
- `GET /api/auth/me` is the shell's identity probe; anonymous traffic must get
  `200 {user:null}`, not `401`, so the client can distinguish signed-out from
  "needs onboarding"
- `password_hash` on `public.users` is legacy: Supabase verifies credentials, so
  the column is never read or written
- Prefer httpOnly cookie sessions for anything that must be gated during SSR
  (see `AUDIT.md` §3.3); until then no `loader` may return private data
- Age verification is enforced at the database level (18+ constraint)

---

## Security Rules

1. **Never expose `SUPABASE_SERVICE_ROLE_KEY`** to client code
2. **Never store API keys in client-side code** — use server functions
3. **Validate all inputs** with Zod before processing
4. **Use RLS** — do not bypass with service role in client components
5. **Sanitize user HTML** with DOMPurify before rendering
6. **Rate limit** sensitive endpoints with Upstash Redis
7. **Log security events** to audit_events table (service-role only)
8. **Never self-grant premium** — entitlements table has no client write policy

---

## Testing Rules

- **Unit tests**: Vitest — test domain logic, utilities, hooks
- **E2E tests**: Playwright — test critical user flows
- **Test file location**: `*.test.ts` or `*.spec.ts` alongside source files
- **Run tests**: `pnpm test`
- **Verify all**: `pnpm verify` (typecheck + test + build)

---

## Performance Rules

1. **Lazy load** heavy components (maps, editors) with `React.lazy`
2. **Use `useSuspenseQuery`** for data that blocks rendering
3. **Preload routes** with `<Link preload>` for navigation
4. **Image optimization**: Use `sharp` server-side, serve WebP/AVIF
5. **Code splitting**: Vite handles this automatically — do NOT manually split
6. **Bundle analysis**: Check bundle size before adding new dependencies

---

## Git Rules

- Commit messages: imperative mood, lowercase, max 72 chars
  - `feat: add profile photo upload`
  - `fix: resolve match notification race condition`
  - `refactor: extract messaging domain logic`
- Branch naming: `feat/feature-name`, `fix/bug-description`
- Never commit: `.env.local`, `node_modules`, `dist/`, `*.tsbuildinfo`
