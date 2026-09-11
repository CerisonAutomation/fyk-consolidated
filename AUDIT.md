# FYK Consolidated — Audit and Corrections

Date: 2026-09-11 · Branch: `arena/01a09011-fyk-consolidated` · Scope: whole repository, read then fixed.

The repo is a **TanStack Start (Vite 8) + Supabase** app that still contained a
complete, unbuilt **Next.js** layer, a second auth system that could never
authenticate, an ORM whose schema disagreed with the database, and deployment
files that could not start. Almost every finding below is therefore "the code
describes one architecture, the runtime is another".

Everything marked **fixed** is implemented as complete files in this working
tree, verified by the commands in §1. Items in §3 are defects that need a
product/schema decision and are documented instead of guessed at.

---

## 1. Verification

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | 0 errors (baseline: 11 errors, plus 5 more introduced by the Next→Start import fixes) |
| `npx vitest run` | **163 passed** (baseline 123; +40 new tests for security headers, middleware, api-helpers, rate limiting) |
| `npx vite build` | success (baseline: **failed**) — server chunk 682 kB → 176 kB after dropping Prisma from the SSR graph |
| `npx biome check` on touched files | clean (repo-wide baseline: 851 errors / 234 warnings, left alone) |
| `GET /api/health` | `200` + full security-header set, `public, max-age=5` |
| `GET /api/health?deep=1` (DB unreachable) | `503 {"status":"degraded","checks":{"auth":"configured","database":"unreachable"}}` |
| `GET /api/auth/me` (anonymous) | `200 {"user":null,"profile":null}` + `no-store` |
| `GET /api/auth/me` (valid HS256 token, DB down) | `500 {"error":"Something went wrong. Please try again."}` — no driver details, host or port leaked |
| `POST /api/events` (no `Origin`, no token) | `403 {"error":"Missing origin information"}` |
| `POST /api/events` (same-origin, no token) | `401 {"error":"Sign in to continue"}` |
| `POST /api/events` (`startsAt:"tomorrow"`, short title) | `400 {"error":"title: use at least 3 characters"}` |
| `GET /api/notifications` (anonymous) | `200 {"notifications":[],"unread":0}` + `public, max-age=30` (no `Pragma`/`Vary: Cookie` contradiction) |
| `GET /api/meetnow` (anonymous) | `401 {"error":"Sign in to continue"}` + `private, no-store` |
| `POST /api/push/subscribe` (`endpoint:"http://x"`) | `400 {"error":"endpoint: Too small: expected string to have >=20 characters"}` |
| `POST /api/events` with `Content-Type: text/plain` | `415 {"error":"Content-Type must be application/json"}` |
| `GET /`, `GET /discover` (production build, SSR) | `200 text/html` with CSP, HSTS, `X-Frame-Options`, `Permissions-Policy` and `private, no-store` |
| `GET /does-not-exist` | `404` + the router's not-found document (not a redirect, not a 500) |

Every row above was captured from a running container-equivalent (`vite preview` over the built
`dist/`), not asserted from source. Runtime smoke was run against `vite preview` (the production command) with
`NODE_ENV=production`, a `DATABASE_URL` pointing at a closed port and a forged
Supabase-shaped HS256 token, which is what exercises token verification, the
CSRF gate, validation, cache policy and error sanitisation without a database.

---

## 2. Fixed

### 2.1 Authentication: two systems, neither working (P0)

`src/routes/api/**` resolved identity with **better-auth** (`auth.api.getSession()`)
while the browser authenticated with **Supabase**. better-auth had **no database
adapter configured**, so it could not have issued or read a session: every
`POST /api/events`, `/api/meetnow`, `/api/notifications` and
`/api/push/subscribe` answered `401` for a signed-in user, and every `GET`
silently treated them as anonymous (`attending: null`, empty inbox). The
`src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/routes/api/auth/$.ts` and
`src/integrations/better-auth/` surface is gone, along with the
`better-auth`, `@simplewebauthn/*`, `bcryptjs`-based passkey/WebAuthn and
`@supabase/auth-helpers-nextjs`/`@supabase/middleware` dependencies.

- **`src/lib/supabase-auth.server.ts` (new)** — verifies the credential the
  client actually holds: `Authorization: Bearer <access token>`, or the
  `sb-*-auth-token` cookie. With `SUPABASE_JWT_SECRET` set it verifies HS256
  locally (`timingSafeEqual`, `exp`, rejects `role: anon`); otherwise it
  introspects `GET /auth/v1/user` with a 5 s timeout. Results (including
  *rejections*) are cached 30 s keyed by a SHA-256 of the token, so replaying a
  bad token is not an amplification vector against GoTrue.
- **`src/lib/client.ts` (rewritten)** — `api<T>()`/`post<T>()` read the bearer
  token *live* from `getSupabase().auth.getSession()` on every call (never
  persisted to a second store), 15 s `AbortController` timeout,
  `credentials: "same-origin"`, and one `refreshSession()` retry on `400/401`.
  The old `setSessionToken`/`getSessionToken` module-level token cache (which
  survived sign-out) is deleted with no remaining callers.
- **`src/routes/__root.tsx`** — mounts `SupabaseSessionProvider`, which every
  consumer of `useSupabaseSession()` needed: without the provider they all saw
  `user: null` even when signed in.
- **`src/routes/api/auth/me/index.ts` (new endpoint)** — `#/components/auth-gate.tsx`
  and the shell needed "who am I, is my profile provisioned, am I suspended".
  It did not exist, so the gate spun on "Signing you in…" forever. The route now
  returns `200 {user:null}` for anonymous traffic instead of `401`, because an
  error response cannot distinguish *signed out* from *needs onboarding*.
  Suspended accounts are collapsed to anonymous. `passwordHash`, `appleId`,
  `googleId` and precise coordinates are never in the payload.

### 2.2 The Next.js layer that was never built (P0)

`next.config.ts`, `server.js`, `src/next-compat/*`, `src/app/global-error.tsx`,
`src/app/globals.css` were deleted (verified: nothing imported them; `next` was
**never in `package.json`** — the code typechecked only because pnpm hoisting
made `node_modules/next` resolvable). Nine files imported `next/link`,
`next/navigation`, `next/image` or `next/headers`, which cannot work at runtime
in Vite; all now use TanStack Router (`Link`, `useNavigate`) — `grep -rn 'from
"next/' src/` returns nothing.

`@/components/ui/avatar` (lowercase) did not exist on a case-sensitive
filesystem — `#/components/ui/Avatar` does; 10 call sites plus the barrel fixed.
`tsconfig.json`'s Next-only `paths`/`exclude` entries and the `@next/next/*`
eslint-disable comments went with them, as did `eslint` itself (no config file
existed; AI_RULES mandates Biome).

### 2.3 Data layer: Prisma → Drizzle, and `#/db` crashing SSR (P0)

- `src/db.ts` instantiated the driver adapter **at module scope** and
  `getDatabaseUrl()` threw when `DATABASE_URL` was unset. A throw while
  importing `#/db` propagates out of the SSR entry, so a container booted
  without that variable returned `500` for *every* route — including `/` and
  `/about`, which never touch the database — as an opaque `HTTPError`. The
  client is now built on first query, with the readable message thrown per
  request; `GET /api/health?deep=1` reports `unconfigured` vs `unreachable`.
- **Prisma replaced by Drizzle** for the API (`drizzle/schema.ts`, `src/schema.ts`,
  `drizzle.config.ts`). Prisma's committed schema disagreed with the SQL that
  creates the database: `User.name`/`handle`/`bio` had no `@map` while the
  columns are `pseudo`/`nick`/`description`; `User.position` was `String` over
  a `jsonb` array; `User.avatar` did not exist as a column; `showDistance`/
  `showOnline` were declared where the columns are `hide_distance`/`hide_online`
  (inverted); `contentRating` defaulted to `"safe"` while the domain is
  `clean|mature|explicit`. Those read as 500s on a freshly migrated project and
  cannot be caught by `tsc`. The remaining Prisma schema (used by `prisma/seed*`)
  was corrected in place: the missing `@map`s, `Json` types and the inverted
  visibility flags are fixed there too.
- `postgres.js` runs with `prepare: false` and a bounded pool (`DATABASE_POOL_MAX`,
  default 5): Supabase's transaction pooler (port 6543) does not support prepared
  statements, and the old per-import `new PrismaClient()` would have opened a new
  pool per module graph.
- `isMissingProfileError` now matches Postgres codes `23503`/`23505` instead of
  Prisma's `P2003`/`P2002` (which no longer surface at all), and callers turn
  them into `409 Finish onboarding first` rather than a raw driver error.

### 2.4 API correctness and abuse controls (P0/P1)

All five routes plus the new `me` route run through **`withSecurity`**
(`src/middleware.ts`, rewritten): CSRF binding → body-size cap → session →
rate limit → handler, with sanitised JSON on every failure path.

| Defect (before) | Now |
| --- | --- |
| No CSRF defence: `POST` accepted any cross-site, cookie-authenticated request | `assertSameOrigin`: bearer-authed traffic is exempt by construction; otherwise `Sec-Fetch-Site`, then `Origin`, then `Referer`, compared against `new URL(request.url).origin` (never a client header). Missing information on a mutating request is a `403` |
| `await request.json()` unguarded — an 8 MB body was accepted | `readBodyCapped` counts streamed bytes (a lying `Content-Length` or chunked upload cannot pass), `parseJsonBody` rejects non-JSON with `415`, and `readJson(request, schema, maxBytes)` puts Zod at the edge |
| Rate limiter keyed `api:${pathname}` — one global bucket, so one script locked every user out of an endpoint; no `Retry-After` | `src/lib/rate-limit.ts`: Upstash when configured, in-process fallback otherwise, per-caller-or-per-IP keys chosen per route, `RateLimit-Limit/Remaining/Reset` + `Retry-After` on both the pass-through and the `429` |
| `notifications` `markRead`/`hide` filtered by `id` only → any user could flip or delete another user's rows (IDOR) | every statement carries `userId = caller.id`; `hide` is a soft `hidden = true` (read_at/hidden added by `0015`) so moderation history survives, and `clear` only removes *read* rows so an inbox clear cannot swallow unread safety alerts |
| `meetnow` GET was public (live positions of real users) and `POST` stored `lat: 0, lng: 0` for everyone | GET requires a session and is `private`; coordinates are stored as supplied and only ever emitted when present; `expiresInHours` clamped to 0.25–24 server-side so a client cannot mint a permanent "here now" row; a new post supersedes the author's live one *before* the insert (after it, the sweep switched the fresh post off in the same request) |
| `meetnow join` read-then-write on `taps`, so two devices produced duplicate taps and duplicate notifications | one `INSERT … ON CONFLICT (tapper_id, tapped_id) DO UPDATE` + notification, in one transaction |
| `events` RSVPs: no capacity enforcement, `upsert` on a non-unique pair, host RSVP in a second round trip, `include: { rsvps }` per event to count attendees, `startsAt` from an unvalidated string | create + host RSVP in one transaction; capacity checked against `count(*)` with an explicit "advisory, see `event_waitlist`" comment; `ON CONFLICT (event_id, profile_id)`; counts via `GROUP BY`; ISO-8601 + lat/lng ranges + `endsAt > startsAt` validated by schema; cursor is now a `(starts_at, id)` keyset instead of `id > cursor` on a UUID |
| `push/subscribe` accepted 1000-character junk in all three fields, raced into duplicate rows, grew unboundedly | endpoint must be an `https:` URL ≤ 512 chars with a host, `p256dh`/`auth` base64url-capped; delete+insert in one transaction under `UNIQUE(user_id, endpoint)` (`0014`); pruned to the newest 20 |
| `toSafeError`/errors: raw Prisma and network messages reached clients | `jsonError` never echoes `details`; unhandled → `500 Something went wrong. Please try again.` and the original goes to the log |

### 2.5 Response headers, transport, deployment (P0)

- **Security headers existed only in dead config.** `next.config.ts` (never read)
  and a root `server.js` (never started by any script) declared a CSP/HSTS
  policy while production sent nothing. Single source of truth is now
  `src/lib/security.ts`, applied in two places that actually run: `headers()`
  on the root route (Start merges it into the SSR document) and `json()`/
  `jsonError()` for API responses. `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, COOP/CORP, `Permissions-Policy` allowing
  `camera/microphone/geolocation` for `(self)` only (the deleted config had
  disabled all three — the map and voice features need them), HSTS only in
  production, `'unsafe-eval'` only outside production, and `private, no-store`
  on every document (a response with no `Cache-Control` at all gets heuristic
  caching, which is how one user's shell leaks into a shared browser profile).
- **`Dockerfile`** probed `http://localhost:3000/health`, a route that does not
  exist (`/api/health` does) → every container was permanently *unhealthy* and
  an orchestrator restarted it forever; and `CMD ["node", "dist/server.js"]`
  pointed at the wrong path **and** at an SSR build that exports a `fetch`
  handler without a listener, so the process exited immediately after a
  successful build. Healthcheck is now `/api/health` (liveness; `?deep=1`
  documented for readiness), the command is the server that actually serves
  `dist/client` + SSR/API, `VITE_*` values are build args (they are inlined at
  build time — the previous file only accepted them at runtime, so the browser
  bundle got empty strings), `pnpm install --frozen-lockfile` no longer needs a
  Prisma engine download, and `.dockerignore` exists (`.env*` was otherwise
  copied into the image, `node_modules` included).
- **`vite.config.ts`** bound to `localhost` only, so `docker run -p` and every
  tunnel/preview silently failed: `host: true` for dev and preview, `port` from
  `$PORT`, and `allowedHosts` relaxed **only outside production** (Vite's Host
  check is DNS-rebinding protection; production must list exact domains via
  `ALLOWED_HOSTS`). Verified in both directions here: with `NODE_ENV=production`
  and an empty allowlist the preview host got `403 Blocked request`, and it was
  accepted once listed — the knob works as documented.
- **`package.json`** had no `packageManager` field while CI uses
  `pnpm/action-setup@v2` with no `version` input (the action requires one of the
  two) → the install step fails before anything else runs. Added `packageManager`
  + `engines`, plus `test:e2e` and Drizzle's `db:*` scripts; `clean` deleted
  `.next`/`out` (not this project's outputs); `depcheck` (npx-fetch at review
  time) removed. `playwright.config.ts` **added**: `e2e/app.spec.ts` and three
  Playwright packages existed with no config, so the runner used the repository
  root as `testDir` and `page.goto("/")` failed on a missing `baseURL`.
- **`.env.example`** rewritten for this stack: `VITE_SUPABASE_*` vs
  `SUPABASE_*`, `SUPABASE_JWT_SECRET`, `DATABASE_URL` (pooler, `prepare: false`
  note), `DATABASE_POOL_MAX`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`,
  `UPSTASH_REDIS_REST_*`, PostHog/error-sink keys, `LOG_LEVEL`.

### 2.6 Frontend modules that could not run (P1)

- **`src/lib/monitoring.ts`** read `process.env.NEXT_PUBLIC_POSTHOG_KEY` (no
  `process` in a browser bundle, and no `NEXT_PUBLIC_*` in a Vite app — the key
  was always empty) and lazy-imported `@sentry/nextjs`, which cannot run outside
  a Next.js runtime. It is now Vite-env driven (`src/lib/monitoring.ts`),
  PostHog-only, with a pluggable `VITE_ERROR_REPORT_ENDPOINT` sink
  (`sendBeacon`, `fetch(keepalive)` fallback) and DOM-replay deliberately off for
  a dating app. It was imported by nothing; `#/components/ErrorBoundary` now
  reports through it (and the boundary no longer writes user content to the
  console outside dev).
- `src/components/{auth-gate,sidebar,topbar,mobile-nav,Header}.tsx` were
  rewritten onto TanStack Router + the new API contract. `Header.tsx` previously
  fetched `/api/notifications` and read fields that endpoint does not return
  (`type/title/body/read/created_at/href` are the real ones now, with an icon map
  and relative timestamps); mark-all-read uses `useMutation` so the bell updates
  without a manual invalidation.

---

### 2.7 Second pass: the missing endpoints (P1 → implemented)

`main` moved during this work (`7a0b2fd`, "fix: MVP audit") and was merged in;
their functional fixes were kept (grid/board on `profiles`, catch-all realtime
subscription, emoji reaction mapping, WS exponential backoff, safety check-ins,
`0014_security_rls.sql`, the theme tokens, the Zustand auth-store sync) and this
branch's architecture was kept (Supabase-only identity, Drizzle, `withSecurity`,
no Next layer). Where both sides fixed the same thing, the duplicate was dropped
rather than stacked: `main` added `AbortSignal.timeout(30_000)` to the old
token-persisting API client (this branch's `#/lib/client` has its own
`AbortController` and never persists a token), and `main`'s rate-limit
expired-entry sweep was already implemented here as `pruneExpired`.

`main` deleted `src/routes/onboarding/index.tsx` (407 lines) while
`#/components/auth-gate` still redirects a signed-in user with no profile row to
`/onboarding`; that segment would have hit a 404 page. The route is restored as a
wrapper over the existing `OnboardingFlow` component.

Then the endpoints the UI already called were implemented on Drizzle, so eight
failing screens became working ones:

| Endpoint | Backed by | Notes |
| --- | --- | --- |
| `GET/POST /api/discover` | `users`, `taps`, `matches`, `notifications` | only `visible AND NOT hidden AND NOT is_suspended`, never the caller, already-tapped excluded, `age > 17` enforced in SQL, distance from `lat_coarse`/`lng_coarse` only, `hide_distance`/`hide_online` honoured, mutual tap writes one canonical `matches` row + one notification each |
| `GET /api/interest/stats` | `taps`, `favorites`, `footprints`, `matches` | one source for the counters *and* the lists, so "3 likes" can no longer sit above an empty tab |
| `GET /api/interest/{likes,matches,visitors,favourites,notes}` | same | one route, validated tab, `cardSelection` only (no email/phone/precise fix/`password_hash`), relation order preserved |
| `POST /api/interest/like`, `POST /api/interest/favourite` | `taps`, `favorites` | idempotent per the unique constraints; notification only on a genuinely new like |
| `GET/POST /api/social` | `favorites`, `private_albums`, `private_album_items` | toggle derived from delete-then-insert (the client sends no intent) with `UNIQUE(user_id,target_id)` making it race-safe; `?view=albums` returns real album rows with item counts |
| `POST/DELETE /api/notes` | `user_notes` | one row per pair via `onConflictDoUpdate`; the subject of a note can never read it |
| `GET/POST /api/conversations` | `conversations`, `conversation_members`, `messages`, `users` | membership joins every read; `member_key` + a unique partial index (`0016`) stop two clients minting two threads for the same pair |
| `GET/POST /api/conversations/{id}/messages` | `messages`, `conversations` | the send path `chat-view` already called (its optimistic UI made failures look delivered); membership-gated, `unsent_at` and expired `expires_at` rows filtered, `char_length(body) <= 4000` mirrored, `ephemeral` turned into `expires_at` server-side, reply text run through the local `moderateContent` so `verdict === "ambiguous"` works |
| `POST /api/ai` | `users`, `conversation_members`, `messages` | dispatches the eight actions the UI sends to `#/domains/ai/heuristic` — deterministic, offline, no provider key, no prompt-injection surface, nothing persisted; `chatHealth`/`summary` verify membership first |

Verified live (production build, DB unreachable, forged HS256 token): anon →
`401`; authenticated reads → `500 {"error":"Something went wrong…"}` and never a
`404`; `bioWriter`/`photoRanker`/`datePlanner`/`replies` → `200` with real
heuristic output; bad action/tab → `400`/`404` with the expected-value message;
`/onboarding` → `200` SSR.

## 3. Open findings — real defects, deliberately not "fixed" by invention

These need a product or schema decision. Inventing an implementation is how a
second, worse truth gets committed, so each entry says what to decide instead.

1. **Still-missing endpoints** (each is a `404` in a reachable screen):
   `/api/boost` (`#/lib/store.ts` fires it on a timer and swallows the error, so
   "boost" currently does nothing), `/api/ai/warmup` (same fire-and-forget),
   `/api/users` and `/api/profile` (onboarding's profile save posts to
   `/api/profile`, which is why finishing onboarding cannot work end-to-end
   today), `/api/safety/reports` (the report button in the deck modal),
   `/api/messages/*` and `/api/discover` variants the dead demo screens call.
   `wallet` and `pet` are *not* gaps: `#/integrations/supabase/{wallet,king-pet}.ts`
   replaced those calls with direct Supabase reads, so the endpoints should stay
   deleted and the old comments in those modules are the accurate record.
   2. **Two user tables, no bridge.** `0000_profiles.sql` creates
   `public.profiles` (`pseudo`→`display_name`, RLS enabled, `age between 18 and
   120` DB check, `lat_coarse/lng_coarse` only) while `0010_remaining_tables.sql`
   creates `public.users` (`pseudo`/`nick`, `lat`/`lng` precise, no RLS) and
   points `taps`/`favorites`/`meetnow_posts`/`notifications`/`push_subscriptions`/
   `sessions` at *that*. `src/integrations/supabase/types.ts` declares both,
   which is why `tsc` never complained. Consequences today: the browser and the
   API read different rows for the same person, and nothing links `users.id` to
   `auth.users.id`. `0015_server_canonical.sql` adds the missing FK
   (`users.id → auth.users(id) on delete cascade`, guarded so it is a no-op when
   already present) plus the columns the API reads, but *choosing* the survivor
   (and backfilling) is a migration with data loss risk: recommend making Drizzle
   the single schema, generating diffs with `pnpm db:generate`, and retiring the
   hand-written table SQL rather than maintaining both.
3. **No SSR-level authorisation.** Auth is client-side (`AuthGate`, `auth-guard`)
   on purpose for now, so `/grid`, `/profile`, `/chat` etc. are protected only
   after hydration — the document and any `loader` data are reachable without a
   session. It cannot be fixed in `withSecurity` alone because the *document* is
   not an API route; it needs Supabase cookie sessions (`@supabase/ssr`
   `createServerClient` with a `getAll/setAll` cookie bridge, `createServerClient`
   in `server.middleware`/`createStart`, `await getUser()` in a route `beforeLoad`)
   so the session exists while SSR is rendering. `bearerToken()` in
   `#/lib/supabase-auth.server` already reads that cookie format for the API, so
   this is the same session, one step further up.
4. **`script-src 'unsafe-inline'` is still required** because TanStack Start
   inlines the hydration payload. Nonces + `'strict-dynamic'` (or a
   hashed-per-response payload) is the follow-up; until then a stored XSS in a
   bio can execute inline. `style-src 'unsafe-inline'` is likewise forced by
   runtime-injected styles and is not a comparable risk.
5. **Three static `innerHTML` sinks**: `src/components/map/FYKMap.tsx:273`,
   `:303` and `src/components/map/MapPicker.tsx:87` interpolate strings into
   `innerHTML`. They are map *popups*, currently fed by mapbox feature fields, and
   `src/integrations/supabase/client.ts` explicitly asserts "no HTML injection
   sinks" in a comment — an invariant a future contributor will trust and break.
   Either build the popups with `textContent`/elements, or route the strings
   through DOMPurify (already a dependency, currently imported by nothing) and
   delete that comment.
6. **`src/routes/test.tsx`, `src/routes/platform/index.tsx`,
   `src/lib/r2-upload.ts`, `src/components/providers.tsx`, `src/utils/cn.ts`,
   `src/domains/auth/test-accounts.ts`, `src/lib/crypto.ts`** are reachable
   modules with production consequences (public debug routes, an R2 uploader with
   credentials from env, a hand-rolled `crypto.ts` next to `node:crypto` usage)
   and no owner. They need an explicit "delete or finish" decision; a route file
   named `test.tsx` is also a live URL.
7. **~57% of `src/` is unreachable from any route** (212 of 370 files by import
   graph, computed during the audit) and `pnpm-workspace.yaml` carries ~900 lines
   of `allowBuilds` noise. Both make every review slower than the code deserves.
   `src/domains/demo`, `src/core/**` (which *is* tested) and the `*-store.ts`
   modules are the interesting parts of that set: prune with the tests as the
   guide, not the graph alone.
8. **Seeds write `password_hash` with bcryptjs** (`prisma/seed.ts`,
   `prisma/seed-sql.ts`) for accounts that then cannot sign in, because Supabase
   Auth — not `public.users` — verifies credentials. Seeding must go through
   `supabase auth admin` (`POST /auth/v1/admin/users`) or the seed data is
   decoration. `bcryptjs` is kept only for those scripts.

## 4. Minimal assumptions

- The deployment is `vite build` + the SSR/API handler serving `dist/client`
  (no separate Nitro/edge target is configured), so `vite preview` is a valid
  production command at this stage; `AUDIT.md` §3.3 and the Dockerfile comment
  record the tradeoff instead of inventing a hand-rolled Node listener.
- Supabase Auth owns credentials; `public.users.password_hash` is legacy and is
  never read or written by application code (`0015` relaxes its `NOT NULL` so the
  sign-up flow can insert at all).
- `users.id` equals `auth.users.id` (the only way a token subject can key an app
  row) — `0015` turns that convention into a foreign key rather than assuming it.
- Row Level Security stays the browser's boundary: nothing here adds a
  service-role call to a request path.
- The Prisma schema remains only for the seed scripts; the API contract is
  `drizzle/schema.ts`.

## 5. Suggested order for the next pass

1. Decide §3.1 endpoint-by-endpoint (implement on Drizzle or delete the caller).
2. Decide §3.2 (one user table), then regenerate `src/integrations/supabase/types.ts`
   from the winning schema so the browser and API cannot drift again.
3. Cookie sessions (§3.3) → then an SSR guard, then tighten `Cache-Control` on
   documents that become personalised.
4. CSP nonces (§3.4) and the map popup sinks (§3.5).
5. Prune §3.6–3.7, and replace `pnpm-workspace.yaml` noise with a real
   `onlyBuiltDependencies` list.

Run `pnpm verify` (typecheck → tests → build → `biome check` on the API/lib
surface) before and after each step; `pnpm test:e2e` now boots its own server.
