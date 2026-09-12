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
| `npx tsc --noEmit`, §2.9–2.10 pass | 0 errors — after the projection revoke, `src/domains/grid`, `src/components/explore`, `EntryShell` and both repointed screens type-check against `profiles` |
| `npx vitest run`, §2.9–2.10 pass | **149 passed** (11 files; +9 for `src/lib/compatibility.ts`. The count is lower than §2.8's 163 because the deleted Prisma-era domain modules took their unit tests with them — reported, not hidden) |
| `npx vite build`, §2.9–2.10 pass | success; `dist/server/server.js` 64 kB |
| `GET /api/settings`, `/api/settings?view=export`, `/api/profile`, `/api/conversations`, `/api/discover`, `/api/social`, `/api/boost` (anonymous) | `401 {"error":"Sign in to continue"}` — none of them answers with the SPA document |
| `PUT`/`DELETE` on `/api/wallet`, `/api/safety/*` (anonymous) | `405 application/json` with `allow:` set; `GET /api/nope` → `404 application/json` since §2.14's splat, though an *undeclared verb on a declared route* still falls through (next row, and §3.10) |
| `GET /api/taps` (anonymous) | `200 text/html` — TanStack has no handler for a method a route does not declare, so an unmatched verb on an API path falls through to the router. Known and recorded in §3.9 rather than papered over with a dead GET. |
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
| `tsc --noEmit` / `vitest run` / `vite build`, §2.15–§2.21 pass | 0 errors · **196 passed (15 files)** · build success. `pnpm verify` cannot be run as one command in this sandbox (`pnpm` is absent from `PATH` inside the corepack shim's child env), so the four steps were run directly |
| `src/lib/migration-invariants.test.ts` (new) | 14 pass; two rules found real defects on their first run (the 0009 abort, the `meetnow` CHECK violation) and each was then proved non-vacuous by planting the violation |
| `biome check` on every file this pass edited | clean, and `pnpm lint:code` (the scope this repository owns outright) is **zero-error** / 55 warnings / 1 info after 8 `useIterableCallbackReturn` sites were braced. Repo-wide `biome lint src drizzle` still exits 1 with **314 errors / 125 warnings / 6 infos** over ~56 screen files — now a *ledger* rather than noise (§2.18) |
| `node scripts/lint-gate.mjs` (new, §2.18) | four behaviours exercised: clean run exit 0; planted 4th `useIterableCallbackReturn` in `CallOverlay.tsx` (allowance 3) fails naming rule+file+allowance; a stale ledger under `--strict-baseline` fails asking for a shrink; `LINT_BASE` overrides the base. `biome lint --changed --since=<ref>` was tried and **rejected**: empty diff ⇒ "The list is empty." + exit 1, so docs-only PRs would fail CI |
| `pnpm install --frozen-lockfile` after `.npmrc` gained `auto-install-peers=false` | passes; `node_modules/prisma` no longer exists; `pnpm-lock.yaml` −1257/+28 lines (§2.20) |
| guarded-document headers, `GET /settings` `/safety` `/notifications` with a valid session | `200` + `cache-control: private, no-store, max-age=0, must-revalidate`, `pragma: no-cache`, `vary: Cookie, Authorization` — the SSR document is not CDN-cacheable, which is what makes §2.16's "server never writes a cookie" safe to keep |
| guard probe after §2.21 (configured `SUPABASE_JWT_SECRET`, **no** database) | valid `200`, chunked `200`, expired `200`, forged `307 → /auth/sign-in`, no cookie `307 → /auth/sign-in`, `/discover` `200`, `/onboarding` `200` (no loop) |
| reachability re-measured after the `src/components/discover` deletion | **160 of 364** non-test source files (43%) unreachable; the script and the exclusions are recorded in §2.19 |
| `pnpm install --frozen-lockfile` | passes after §2.17's lockfile regeneration; it *failed* on every commit since the Prisma removal, which is what `Dockerfile:27` and `ci.yml:31` run |
| `GET /settings`, `GET /safety` with `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_JWT_SECRET` set to a non-existent project | `307 → /auth/sign-in` with no cookie; `200` with a valid session cookie *and* with the same session split across `sb-*-auth-token.0/.1`; `200` for an expired-but-signed token; `307` for a forged signature, for an anon-role token, and for a forged signature reassembled from chunks (full table in §2.16) |
| the same routes with the env removed | `200` — `unconfigured` is fail-open for a document and the preview is unaffected |
| `POST /api/safety/check-in` with a valid session **cookie** and no / cross-site `Origin` | `403` both — the same-origin gate is what makes the new cookie credential safe |
| `curl` sweep at `2cb75ad` (pre-§2.17) | pages `200`; `/api/health` `200` JSON; `/api/nope` `404` JSON; `/api/safety/contacts` `401`; `DELETE /api/safety/check-in` `405` + `allow: GET, POST`; `PUT /api/wallet` `405` |

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

### 2.8 Third pass: every feature reachable, nothing stubbed

The rule for this pass: no dead endpoint, no invented field, no success path that
ignores its own failure. Method was mechanical, not impressionistic — every
`/api/*` string literal in `src/**` (template segments normalised to `*`) was
matched against the generated route tree, then every response mapper was read for
constants that a row could already answer. Each hit below is either implemented,
proven already correct, or deleted.

Implemented (previously a `404` inside a `catch {}`, i.e. a button that looked
like it worked):

| Endpoint | Backed by | Notes |
| --- | --- | --- |
| `POST/DELETE /api/taps` | `taps`, `matches`, `notifications`, `blocks` | `discover-client.tsx` and `profile/user-profile-client.tsx` both post here and read `{ isMatch }`; the decision logic moved to `#/lib/tap.server` so `/api/discover` and `/api/taps` share one engine (the old copy in the deck route is gone), blocks in either direction now stop a tap becoming a match, `DELETE`/`action:"unswipe"` removes the row instead of resetting client state |
| `POST/GET /api/boost` | `consumables_inventory`, `users.boost_expires_at` | a boost *costs* a booster (quantity decremented inside the transaction, `409` when the account has none) and *does* something: `/api/discover` ranks a live boost above recency, and `GET` reports the window; `BOOST_MINUTES` is server-side, so a client cannot ask for a permanent boost or a free one |
| `POST/GET /api/safety/check-in/resolve` | `notifications` (`type = check_in`) | a check-in is a notification row whose JSON body carries `{ contact_id, place, due_at, status }` (that is what `#/integrations/supabase/safety.ts` writes — there is no separate table), so resolving one is an update plus an insert *for another user*, which browser code cannot do under RLS; the contact is taken from the stored body, never from the request, and the HUD's countdown is replayable through `GET` |
| `GET/PUT /api/profile` | `users` | onboarding's `PUT` was posting to a route that did not exist; `profile_complete` is recomputed from the merged row server-side, `onboarding_done` is refused below 60, and `role`/`tier`/`verification`/precise location cannot be set from the body |
| `POST/GET /api/safety/reports` | `public.reports` | self-report refused, target must exist, an open duplicate is folded into `details`, 5 per hour / 15-minute spacing; `GET` returns only the caller's own reports |
| `PATCH /api/messages/{id}`, `POST /api/messages/{id}/react` | `messages`, `message_reactions` + `0017` | `pin`/`unpin`/`edit`/`recall` all reach real columns (`is_pinned`, `pinned_at`, `unsent_at`), membership is joined for every mutation and ownership is required for `edit`/`recall`; `react` toggles against the same five-emoji `CHECK` set `0000_profiles.sql` defines |

Invented values removed (each one used to render something false):

- `isFavourite: false` in `/api/discover` — now from `favorites`, so a saved
  profile looks saved in the deck.
- `matchScore` — the deck copy promises "ranked by 5-dimension compatibility" and
  the client filters on `filters.minMatch`; the score is now computed from
  tribes/interest/intent/distance/recency and used for ordering, so the slider
  changes the deck. Missing coordinates or empty tags score 0 on that term rather
  than receiving a flattering default.
- `meta.online` / `meta.verified` / `meta.newCount` / `meta.vibes` — the client
  typed them and they were never sent, which left the AI strip and the two filter
  chips permanently blank. They are counted over the page that is actually shown,
  and `hide_online` is honoured in the count.
- `coverUrl: null` in `/api/social?view=albums` — now the lowest-positioned
  `private_album_items` row; an empty album still has no cover, which is a
  different fact from a made-up one.
- `unread_count` in `/api/conversations` — counted every non-self message ever, so
  every thread looked unread; now joined against `conversation_members.last_read_at`.
- `media_url` in the message list — there is no public bucket, and
  `media_access_policy` (`timed`/`view_once`/`open_count`) means any URL the server
  hands out unsigned would break its own expiry rules; the response carries
  `storage_path` and `#/integrations/supabase/chat.ts` signs it per viewer.
- recalled messages — the list used to filter them out, which made a recall
  invisible to the other side; rows now come back with `content: ""` and
  `is_recalled: true`, which is what `chat-view.tsx` already renders.

Deleted because it was pure noise: the `api("/api/ai/warmup").catch(() => {})` call
in `#/lib/store.ts`. The palette command it served is labelled "Load the on-device
AI model", so `warmUpAi` now actually loads it through
`#/domains/ai/ml/bootstrap` `loadExtractor()` (WebGPU → WASM fallback, cached
singleton) and reports both outcomes as a toast.

Silent failures made visible in the same place: `boost()` and `resolveCheckIn()`
used to discard everything; both now toast the server's answer, including
"no boosts left" and "your emergency contact was not notified".

Schema: `supabase/migrations/0017_message_actions.sql` adds
`messages.is_pinned`/`pinned_at` (+ partial indexes), `users.boost_expires_at`
(+ index), `message_reactions`/`message_reads` parity with `0000`, and drops the
`NOT NULL` from `users.email` — a phone-only Supabase session could not create its
own profile row at all, because `0010` declared `email text UNIQUE NOT NULL`.

Verified live against a production build with an unreachable DB and no session:
`/api/taps`, `/api/boost`, `/api/profile`, `/api/safety/reports`,
`/api/safety/check-in/resolve`, `/api/messages/{id}` all answer `401` (reads) or
`403` (writes, missing `sec-fetch-site`), while `/api/nonexistent-route` answers
`404` — the routes exist and are gated, which is the distinction that was missing.
`tsc` 0 errors, 163 tests pass, `vite build` OK, `biome check` unchanged on
everything this pass touched.

Still unreferenced, and needing a delete-or-keep decision (they are dead code, not
stubs — nothing in the route tree imports them): `src/core/api/hooks/use-auth.ts`
and `src/core/api/client/api-client.ts` call `/api/auth/{login,logout,state,session-health}`,
which do not exist and must not be built (Supabase owns the session);
`src/components/topbar.tsx` is an unreferenced duplicate of
`src/components/layout/topbar.tsx`; `/api/users` is only mentioned by
`src/core/domain/__tests__/errors.test.ts` as a fixture URL.

### 2.9 The browser stops being a database client: settings, profile, onboarding

`settings-client.tsx`, `profile-client.tsx` and `EntryShell` each held a
hand-built query layer over `public.users`: `select("*")`, a whole-row
`update`, a refetch to confirm the write, and an export view that dumped every
column — including `lat`, `lng`, `password_hash`'s successors, `role`, `tier`,
`trust_score` and `is_suspended` — into a downloadable JSON file.

Now:

- **`GET /api/settings[?view=prefs|export]`** — prefs returns the twelve
  preference columns in the snake_case the screen already mapped, and export
  returns an explicit `EXPORT_COLUMNS` projection: a data-export of *what a
  profile is*, not of the moderation and geo columns around it.
- **`PUT /api/settings`** — a `.strict()` allow-list. The `notif_prefs` and
  `ai_prefs` jsonb bags enumerate every key the UI can toggle, and the two
  bags are **merged** with the stored row because the switch component sends
  one key per toggle: replacing the column would have turned every other
  switch off. `role`, `tier`, `verification`, `trust_score` and `is_suspended`
  are rejected with a `400` naming the field, not silently dropped.
- **Profile load/save** — `GET /api/profile` then one `PUT /api/profile`;
  the `select("*") + update + refetch` trio is gone. Photo upload still calls
  `supabase.storage` directly, which is the native path for Storage and was
  never the problem.
- **`EntryShell`** — `updateProfile` and the two-step onboarding write went
  from `from("profiles").upsert(...)` to the API, because §2.10 makes
  `profiles` a projection the database owns. `PUT /api/profile` gained
  `dob`, `incognito` and `exposure_level`: the birth date is written to
  `profile_private`, the age is *recomputed from it*, and `age_verified_at`
  is stamped server-side, so an 18+ gate is not a value a client can assert.
  Fields the API does not accept are reported back to the user instead of
  being dropped in translation.
- A latent bug surfaced on the way: the colour-blind preset wrote the
  **string** `"protanopia"` into `colorblind_mode`, a boolean column — every
  save of that setting threw, and the screen re-read the old value and looked
  like it had worked. It now writes `id !== "off"`.

The onboarding gate itself was a false deadlock: `onboarding_done` required
`profile_complete >= 60`, i.e. a photo and a bio, while the gate that *shows*
onboarding only needs name, handle, age and city — so a new account with no
photos was told to finish onboarding by an endpoint that refused to let it.
The completion rule now accepts the gate fields (the 60% score stays what it
always measured: profile quality).

---

### 2.10 `profiles` is the browser's only table; nothing is invented any more

`0018_supabase_canonical.sql` finishes the split that §3.2 describes:
`auth.users ──1:1── public.users ──trigger── public.profiles`. The mirror
computes `discoverable = visible AND NOT hidden AND NOT is_suspended AND NOT
incognito`, derives a legal `handle`, clamps the age into the projection's
18–120 check, projects only the coarsened fix, and `revoke insert, update,
delete on table public.users from anon, authenticated` closes the side door.
A guard function refuses direct writes to `profiles` unless the mirror trigger
set its `fyk.profile_projection` flag, so no screen can quietly write the
projection instead of the row.

Because the revoke would otherwise break the last two browser readers, they
moved in the same change set: `src/components/explore/explore-client.tsx`
(city counts, profile list) and `src/domains/grid/service.ts` (both queries and
both mappers) now read `profiles` with its canonical names — `display_name`
and `handle` instead of `pseudo`/`nick`, `height_cm` instead of `height`, one
`discoverable` flag instead of `visible`/`hidden`/`incognito`/`status`. Two
columns were added to the projection to make that possible without a fallback
read: `tag_codes` (the grid filters on it) and `weight` (see below).

What those two files used to hand the UI, and what they hand it now:

| Field | Before | After |
| --- | --- | --- |
| explore `distance` | `0.3` for every card, sorted "nearest first" | haversine between the two coarse fixes, `null` when either is missing or the owner hides distance (sorted last, not first) |
| explore `verified` | `false` for everyone | `verification >= 2`, the same rule `/api/discover` uses |
| explore pins `matchScore` | `p.verified ? 90 : undefined` | not passed; a boolean cannot imply a percentage |
| grid `compatibilityScore` | `50` in both mappers | `src/lib/compatibility.ts` against the viewer's own tags, distance and recency — the function `/api/discover` ranks with, so the two screens cannot disagree |
| grid `onlineUntil` | `Date.now() + 15 min` while `online` was true | expiry derived from `last_active_at` and the real 5-minute presence window; `null` otherwise |
| grid `unread` | `null` (lazy cards) / ignored | the viewer's own thread list (`/api/conversations`, which owns the "only my member row counts" rule) |
| grid `hasChattedInLast24Hrs` | `false` | last message within 24 h, same payload |
| grid `isVisiting` | `false` | **deleted.** No column backs it in any migration (`geo_mode` exists in the hand-written types and nowhere else), and no screen reads it. Fabricating it was the stub; inventing a table for it would have been a bigger one |
| grid weight filter | accepted by the query type, sent by the store, never applied | `weight` is projected and both bounds filter |

The scorer moved out of `#/lib/api-helpers` (server-only: it imports the
Drizzle schema) into `#/lib/compatibility`, imported by both sides.
`RenderedGridProfile.compatibilityScore` became `number | null` and the grid's
ring renders *nothing* when there is no viewer to compare against — the honest
absence rather than a neutral-looking 50.

Explore also revealed a silent outage worth recording: its profile query
selected `headline` from `public.users`, a column that table never had, so
PostgREST errored on every city and `if (error || !rows) return []` turned the
whole screen into a permanent "no one matches your search". The projection has
`headline`, and the error path now only empties when there genuinely are no
profiles.

**Prisma is gone outright**, not deprecated: `prisma/`, `prisma.config.ts`,
`@prisma/client`, `@prisma/adapter-pg`, `bcryptjs`, `dotenv-cli`, the
`db:migrate` script, the `prisma/seed.ts` entry in `tsconfig.json`, and
`package-lock.json` (a second lockfile that contradicted
`packageManager: pnpm` and still listed the removed packages). `pnpm db:seed`
is now `scripts/seed.mjs`: it creates the demo logins through GoTrue's admin
API *first* — because `users.id` has a foreign key to `auth.users` — and then
inserts rows into `public.users`, letting the mirror build `profiles`. Without
`SUPABASE_SERVICE_ROLE_KEY` it stops with an explanation instead of inserting
logins that cannot sign in, which is precisely the defect §3.8 described.

### 2.11 The revoke found six more readers, and one of them was a privacy hole

`revoke select on table public.users from anon` would have been a half-measure:
`public.users` has **no row-level-security policies at all** (0010 created it
as an ordinary table), so `authenticated` could select every row — including
`email`, `phone`, `lat`/`lng` and `notif_prefs`. The revoke now covers
`authenticated` too, which meant finishing the repoint for everything the browser
still read directly:

| Module | Was | Now |
| --- | --- | --- |
| `integrations/supabase/stories.ts` | `users` for author chips (`pseudo`/`nick`) | `profiles` (`display_name`/`handle`) |
| `integrations/supabase/fansites.ts` | `users` for the owner card, typed `Pick<User, …>` | `profiles`, with `FansiteOwner` documented as the *outgoing* contract (`pseudo`/`nick` keys kept, because the cards read them) |
| `integrations/supabase/groups.ts` | `users` for message senders | `profiles` |
| `integrations/supabase/tribes.ts` | `users` for the joined list, and `update({tribes})` on `users` — a write a browser token can no longer perform | reads `profiles`; membership goes through `PUT /api/profile` and the mirror republishes it |
| `routes/right-now/index.tsx` | `users` with `visible`/`hidden` | `profiles` with `discoverable`, and presence from the shared window instead of the raw `online` flag — with `hide_online` finally honoured |
| `routes/settings/profile/index.tsx` | `select("*")` + `update()` on `users`, then the *same payload written again* into auth metadata "for convenience" | `GET`/`PUT /api/profile`; only `hiv_status`/`last_tested` stay in auth metadata, because those two have no column anywhere and that is the only place they exist |

The `/settings/profile` screen needed more than a URL swap. It sent
`updated_at`, `position: "Top"` and `ethnicity` to a table it could not write, and
any Postgres error was swallowed by `alert()` after the *auth-metadata* half had
already succeeded — so it could report failure while having changed your account,
or report success having changed nothing. It now saves once, through the API,
surfaces the API's own message inline, keeps the photo list in state instead of
re-fetching `users.photos`, and dropped the `last_name` field that was in the form
type but never in the UI or the payload.

Two schema consequences came out of that pass:

- **`PUT /api/profile` accepts `ethnicity`.** The screen wrote the column all
  along; the API simply had no field for it, so saving silently lost it.
- **`tribes`, `looking_for` and `position` accept names *or* numeric ids.** They are
  `jsonb` with a GIN index and no foreign key (`0010`), and the app already writes
  both vocabularies: `/tribes` joins by name, the profile editor stores numeric tag
  ids. Rejecting one would have made a working screen unable to save, so the API
  matches the column and every comparison (`asStringArray` server-side, `asStrings`
  in the grid) textifies numbers — `3` and `"3"` now match. The residual mess is
  data, not code: see §3.10.

### 2.12 Every profile photo in the app was a stock image

Not a styling bug: `demoMediaUrl()` hashes any string and returns one of ~20
Unsplash photos, and four surfaces called it on every profile image — the grid
cards and map pins, the profile carousel, the "who viewed me" grid, and the
`UserAvatar` molecule underneath them. Uploading your own photo therefore
rendered a stranger; a profile with six photos and one with none looked the
same, and the only way to see a real image was to have no images.

`resolveMediaUrl()` (`#/integrations/supabase/media`) is the one resolver now:
absolute URLs pass through, anything else becomes the `media` bucket's public
URL, an empty reference stays empty instead of becoming a placeholder face, and
the demo catalogue still applies *in demo mode only* — which is the entire
purpose of `#/domains/demo`.

Fixing the resolver was half of it; the data paths were labelled as if they were
hashes:

- `GET /api/profile/{uuid}` returned `medias: [{ mediaHash: "<path>" }]` —
  a real storage path wearing a hash's name, which is what taught clients to
  treat uploads as seeds. It returns `photos: string[]` now, the same key
  `PUT /api/profile` writes. The carousel resolves before rendering, drops
  references that cannot become a URL, and keys on the path, so the strip, the
  dots and the lightbox stay in step.
- `/interest/views` read `profileImageMediaHash`, a field no endpoint has ever
  emitted, so visitors rendered initials forever. It reads the card's `photo`.
- The grid carries `photoUrl` on the rendered card (resolved once in the
  service, beside `profilePhotosHashes`, which the cards legitimately key on).

`src/core/model/media.ts` still defines `mediaHashPublicSchema` as a 40-hex
string, and `core/ui/organisms/{ProfileItem,ProfileMiniCard,IncomingMessageToast}`
take `mediaHash` props. Those are the demo-era model layer, unreachable from any
route (§3.7 covers the pruning) — left alone deliberately rather than renamed to
look finished.

---

---

### 2.13 The economy, the inbox and the social graph stop being client-owned (P0)

`0018` made `users` server-owned; this pass applied the same test to everything
else and the app split into three kinds of broken.

**What the audit measured, before changing anything**

| Measurement | Result |
|---|---|
| Tables a browser token could write | 20 tables, 53 call sites, all in `src/integrations/supabase/*.ts` |
| Money/privilege writes among them | `wallet.balance` ×6, `wallet_transactions` ×5, `premium_entitlements` ×3, `subscriptions` ×3, `consumables_inventory` ×2, `king_pet` ×2 |
| Tables with RLS **enabled and zero policies** (reads `[]`, writes 0 rows, no error) | `wallet`, `notifications`, `king_pet`, `subscriptions` — i.e. exactly the four the premium, pet and inbox screens depend on |
| Tables with RLS **off** and browser usage | 16, including `user_notes` (every private note about you, world-readable), `wallet_transactions`, `shouts`, `groups`, `group_messages`, `favorites`, `footprints` |
| Rows the database would never accept | `wallet_transactions.type` `'credit'`/`'debit'` vs `wallet_tx_type_check` (0013); `consumables_inventory.type` `'tap_boost'`/`'gift_*'` vs `consumables_type_check`; `notifications.type` `'check_in'`/`'fansite_subscribe'` vs `notifications_type_check`; `subscriptions.status='superseded'`; `subscriptions.tier='gold'`; `premium_entitlements.tier='gold'` where `plan_tier` was `('free','plus')` |
| Receipts | `receipt_id = "RCP-" + Date.now() + "-" + userId.slice(0,8)` |
| Balances per account | three (`wallet.balance`, the ledger's implied sum, `king_pet.bones`) |

The row that matters most is the fourth: those writes did not fail loudly, they
failed *silently*, because `insert().select()` with a rejected row returns an error
object nobody read, and every caller in `wallet.ts`/`king-pet.ts`/`safety.ts`/
`fansites.ts` used `await client.from(...).insert(...)` without checking it. So the
shop took money (`wallet.update` was allowed — no CHECK on that one), granted no
item (the `consumables_inventory` insert was CHECKed), and toasted "Purchased!".
`wallet.ts` also called `client.rpc('wallet_credit_and_log')`, a Postgres function
no migration has ever created: guaranteed failure, with a fallback that wrote the
balance by hand — the fallback *was* the design.

**What `0019_server_owned_economy.sql` does**

1. **The wallet becomes a ledger.** `wallet.balance` is derived by a trigger from
   `wallet_transactions`, `wallet_transactions` is append-only (an `UPDATE`/`DELETE`
   raises unless the write carries the transaction-local `fyk.server_write` flag the
   trigger itself sets), a debit that would go below zero raises `P0001`, and
   `amount` becomes signed with `CHECK (amount <> 0)` replacing `CHECK (amount > 0)`
   — the unsigned-plus-a-direction-tag layout is what let `balance + amount` credit
   an account on a purchase. `source` and a partial-unique `idempotency_key` land on
   the table so a retry cannot mint twice and every entry says which product wrote it.
2. **Privilege becomes server-only.** `revoke insert, update, delete` on
   `wallet`, `wallet_transactions`, `premium_entitlements`, `subscriptions`,
   `consumables_inventory`, `king_pet`, `pet_items`, `pet_adventures`, `tribes`,
   `taps`, `site_config`, the embedding tables and the `ai_*` tables; the browser
   keeps *select-own* where a screen reads (`wallet_select_own`,
   `entitlements_select_own`, `subscriptions_select_own`,
   `consumables_select_own`, `king_pet_select_own`, `wallet_tx_select_own`).
   `premium_entitlements.tier` becomes `text` with a four-value CHECK (an enum
   cannot be extended and then used inside the same transaction `db push` wraps a
   file in), and `subscriptions.tier` agrees with it; legacy `'premium'` rows are
   normalised to `'plus'`, which is what the only-Plus era meant.
3. **The inbox stops being writable by its reader.** `notifications`: own select,
   own update, **no client insert or delete**, and a column guard so an update may
   change `read`/`read_at`/`hidden` and nothing else — a client that can edit `title`
   can plant "You matched with a celebrity" in its own inbox, and the inbox is what a
   screenshot shows.
4. **`user_notes` gets its first-ever RLS** (author-only; the table had none) and
   `taps` becomes read-only for the browser, because a tap is the edge that creates
   a `matches` row inside the API's transaction.
5. **Social tables get real policies instead of none**: `shouts` (public read except
   blocked, own write, 1–500 chars enforced in `with check` and not in a `maxLength`
   a curl ignores), `shout_likes`, `groups` (private groups readable only by members),
   `group_members` (join yourself, leave yourself, kick only as the leader),
   `group_messages` (member read, member write), `fansites`, `stories`,
   `story_views`, `typing_indicators`, `message_reads`, `push_subscriptions`,
   `event_waitlist`, `meetnow_posts`, `saved_filters`, `saved_phrases`,
   `favorites`, `footprints`, `hides`.
6. **Counters are derived, so §3.9's other half is gone**: `shouts.likes_count` from
   `shout_likes`, `groups.member_count` from `group_members`,
   `fansites.subscriber_count` from a new `fansite_subscribers` edge (the app had been
   *counting notification rows as followers* — clearing your inbox deleted your
   audience), `tribes.member_count` from a `users.tribes` trigger. Each parent column
   gets a guard that refuses a hand-written value, which is the same mechanism the
   wallet uses.
7. **§8 repairs drift** (balance := sum of ledger; a wallet with no history gets an
   `opening_balance` row instead of being overwritten; counters recomputed from
   edges) and **§9 seeds the catalogues the product needed and never had**: the five
   `pet_items` whose names `king-pet-client.tsx` already draws as 👑 🕶️ 🧣 👟 🦸,
   six adventures, and the 19 tribes `/tribes` and onboarding both speak. They were
   empty in every environment, so three screens were permanently "nothing here yet"
   while `scripts/seed.mjs` (demo data, never executed) was the only thing that
   could fill them.
8. **`0014_security_rls.sql` became `0020_security_rls.sql`.** Two files shared
   version `0014`, which Supabase keys migrations by — `supabase migration list`
   reports a duplicate and `db push` picks one in filesystem order. The second also
   used bare `CREATE POLICY`, so re-applying it aborted; both problems are fixed in
   the renamed file, with the reason recorded in its header.

**What replaced the browser's authority**

`src/integrations/supabase/{wallet,king-pet}.ts` (855 lines) are gone. In their
place: `#/lib/economy` (the shop, the packs, the tier ladder, the XP curve, the
quotas — pure, 19 tests), `#/lib/wallet.server` (`ensureWallet`, `postLedger`,
`upsertConsumable`, `currentTier`, `setTier`), `GET/POST /api/wallet`, `GET/POST
/api/king-pet`, `POST /api/fansites/subscribe`, `GET/POST /api/safety/check-in`, and
two thin clients (`#/core/api/wallet`, `#/core/api/pet`) that keep the names the
screens already called. `POST /api/taps` gained the free-tier allowance
(`50 taps a day`, counted in `taps`, which is what `TIER_PERKS` had been promising
without an enforcer), and `/api/boost` now spends what the shop sells.

Deliberately *not* implemented, because nothing redeems it: `tap_boost`, `super_like`,
`profile_spotlight`, `read_receipt`, `incognito` and the three gifts are not for sale
(`SHOP_ITEMS` has one row, and `economy.test.ts` fails if an entry appears without a
redeeming route). The old shop sold five. `src/lib/economy.ts` also stopped
advertising perks this build cannot enforce ("48 AI features", "No ads", "Video
calls", "Travel mode", "Priority support", "Who viewed me"), which is why the ladder
now reads short and true.

**Also found and fixed in the same pass**

- The `media` bucket never existed: `profile-client.tsx` and `/settings/profile`
  upload to `storage.from("media")` and `resolveMediaUrl()` reads from it, while
  `003_storage.sql` created five *other* buckets. Every profile-photo upload failed
  with "Bucket not found"; the reader produced a URL to nowhere and the card rendered
  an empty frame. `0019` §10a creates the bucket with `fyk_media_*` policies matched
  to the `avatars/<uid>/…` paths the code writes (003's convention is
  `<uid>/<file>`, and the code is what the data already follows).
- The pet's `randomMood()` picked a mood with 40% probability *client-side*, and
  `last_fed_at`/`last_played_at`/`last_adventure_at` were never written by anything,
  so `feed` could be tapped without limit for +20 XP each time. Cooldowns now come
  from those columns, and an adventure takes its `duration_minutes` and pays on
  return (`GET` collects a bones trip; an XP trip is applied by the next action, in
  the same transaction, so one code path owns progression).
- `safety.ts` armed a check-in by inserting a `notifications` row of type `'check_in'`
  — CHECKed away — and read the id back from a row that did not exist, so the "4
  hours to confirm safe" timer lived only in `#/lib/store.ts` and vanished on reload.
  `POST /api/safety/check-in` now writes it (and refuses to arm a second on top of a
  running one); the CHECK gained `check_in`/`check_in_resolved`/`check_in_overdue`,
  which `POST /api/safety/check-in/resolve` has been trying to write all along.
- `discover-client.tsx` ranked the deck with `generateHashEmbedding()`: a bag of my
  own profile's words hashed into 384 buckets, stored in a pgvector column, compared
  by cosine distance, and advertised as "Vector search boosted 30 profiles". Its own
  comment said "produces low-quality vectors" — the module, the hook and the badge are
  deleted, and `profile_embeddings`/`message_embeddings` are revoked from browser
  roles so a future real embedder starts on the server. The AI-pick badge in the
  screen that remains is the documented 5-dimension `matchScore` at 80+, which is the
  number the filter slider already means.
  **One correction to make while writing this:** that screen is not the live one.
  `/discover` renders `ExploreClient` (`src/components/explore/explore-client.tsx`),
  which has never contained embedding code — it reads `profiles` for city counts and
  candidate cards, computes distances from the viewer's own `lat_coarse`, and writes
  nothing. The entire `src/components/discover/` cluster (its client, `profile-card`,
  `profile-modal`, `stories-rail`) is reachable only from itself. So no user ever saw
  the vector badge; the honest description is dead code, not a live lie. Deleting it
  still stands on its own terms — a dead file is a copy-paste source, and §2.13's
  revokes would have broken it the moment someone revived it — and `ExploreClient`
  was audited in full rather than assumed clean. What is *not* fixed here: the deck
  still ranks with `#/lib/compatibility` in the browser, because that is the one
  scoring function this app documents (5 dimensions, deterministic, no model).
- The premium screen rendered `t.type === "credit"` for a signed `+`/`−`, a value no
  row has ever held under the new convention; it reads the sign now, and both screens
  that used `if (isLoading || !data) return <Skeleton/>` answer a failed query with a
  retry instead of an infinite skeleton.
- `README.md` still told people to run `npx prisma generate`, described a
  `src/adapters/` tree that does not exist, listed "Prisma 7" in the stack, and
  pointed `pnpm db:migrate:sql` at a directory (`psql -f` takes a file). All four are
  corrected; `test.tsx`, `platform/index.tsx` ("Crypto/WebGPU demo coming soon"),
  `domains/auth/test-accounts.ts` (with `TestPass123!`) and the orphaned
  `components/providers.tsx` are deleted, with the dead `go:platform` palette case.


### 2.14 A safety check-in becomes a record with somebody attached to it (P1)

`0019` + §2.13 made the check-in *writable*; this pass made it **mean something**.

**What was measured first**

- `safety-client.tsx` armed a check-in with `createCheckIn(userId, userId, …)`: the
  emergency contact was the user themself, under copy reading "share your approximate
  location with a trusted contact".
- There was no emergency-contact concept in the schema at all — `grep -rn emergency
  supabase/migrations/` returned nothing — so `POST /api/safety/check-in` validated
  `contactId` against `public.users`, i.e. *any* account, including a stranger's,
  could be named as someone's contact by whoever armed the timer.
- The record itself was a `notifications` row whose text body carried
  `{contact_id, place, due_at, status}`: no index on `due_at` ("who is overdue" is a
  scan), the record deleted when the owner hides or deletes the inbox row, no column
  for the coordinates the screen already collects, and `resolve` had to parse JSON to
  update a status.
- Nothing scheduled any work: no `pg_cron` in any migration, `UPSTASH_REDIS_REST_*` is
  rate limiting, and the two edge functions that could run on a timer
  (`supabase/functions/cron-cleanup`, `…/notify`) have no schedule or caller committed
  anywhere in this repository.

**What `0021_safety_checkins.sql` does**

`safety_contacts` is the user's own list — the browser may write it under RLS
(own rows only), because it is data about them, not privilege, which is the same line
0019 §5 drew for `user_notes`. `safety_checkins` is the record: select-own for the
browser and *no* client DML, because arming, confirming and marking overdue all notify
a third party. Both halves have teeth in the DDL, not in a form:
`safety_contacts_not_self` makes "your own account" a CHECK violation,
`safety_checkins_contact_owner` is a composite foreign key on
`(contact_id, user_id) → safety_contacts (id, user_id)`, so a guessed uuid cannot
point a check-in at somebody else's contact, and `safety_checkins_resolution`
guarantees `resolved_at` is present if and only if the row is no longer `armed`.
`safety_checkins_one_armed` (partial unique) is what makes a second arm a 409 rather
than a second running timer, and `safety_checkins_armed_due_idx` is the index the
"who is overdue" question needs. A trigger nulls `notification_id` when the projection
is deleted, so the record outlives its inbox mirror instead of the reverse.

The overdue transition is lazy and single-winner: `sweepOverdue` runs at the top of
`GET` and `POST`, and only the statement whose
`UPDATE … WHERE status = 'armed' AND alerted_at IS null RETURNING` actually changed a
row gets to write `check_in_overdue`. Two tabs, one alert. That is deliberate — with no
scheduler in the repo, a *read-time* transition is honest, whereas a comment saying
"the cron will handle it" would describe a job nobody configured. What it cannot do is
page anybody who is not looking at the app; the copy in `#/lib/safety.server.ts` says
so rather than the screen implying otherwise.

`#/lib/safety.server.ts` holds the shared vocabulary (arm / resolve / sweep / contact
CRUD) and takes a `DbLike` handle so the **route** owns the transaction — `DbLike`
has no `transaction` member on purpose, and a helper that opened a nested one is how
a partial commit slips past a rollback. Three routes sit on it: the rewritten
`GET/POST /api/safety/check-in`, `POST /api/safety/check-in/resolve` (which kept the
`{contactNotified, warning}` contract `#/lib/store.ts` already reads, so the HUD can
say "your contact was not informed"), and the new `GET/POST /api/safety/contacts`.
`safety.ts` lost its hand-rolled status strings, the client seeds the HUD from the
server on mount (the timer now survives a reload, which is the sentence that describes
the whole defect), and the card has a contact picker with an add form, an off-platform
marker, and an "I'm safe" button.

**Two derived-counter triggers that could not run at all**

While writing 0022, both recount triggers were read end to end, and both are broken in
the same way — which is also the way §2.13's own trigger work had to be fixed twice:

1. `public.tribes_recount()` (0019 §7) opened with
   `if tg_op <> 'DELETE' and new.tribes is not distinct from old.tribes`, which
   references `OLD` in an **INSERT** row trigger, where plpgsql has no `OLD` record:
   `record "old" is not assigned yet`. It is `after insert or update or delete` on
   `public.users`, so the first signup after 0019 aborts — the insert and the
   `handle_new_user` path both die on a *counting* trigger.
2. Its `names` CTE was `select … union select …` with **the identical branch twice**, so
   the old side of an update was never enumerated: leave a tribe and its
   `member_count` stays where it was. The count only ever grows.
3. `public.refresh_post_join_count()` (002_rls.sql:534) opens with
   `target_id := coalesce(new.post_id, old.post_id)` and is registered on
   `post_joins` for insert *and* delete — so joining a board post raises the same
   unassigned-record error, because `coalesce` evaluates both arguments.

All three are repaired in 0022 §0 with `case when tg_op …` branches, keeping the
original names, security clauses and semantics. `src/lib/schema-coverage.test.ts` and
`economy.test.ts` still cannot catch these: they read DDL, and no Postgres has executed
any of it here (§3.13).

**One vocabulary, resolved on write**

`0022_tribes_vocabulary.sql` normalises `users.tribes` onto canonical `tribes.name`
values (case- and whitespace-insensitive, order-preserving, deduped) and recounts the
catalogue; `#/lib/tribes.server.ts` does the same resolution on every write from
`PUT /api/profile`, so the column converges instead of re-splitting. Unresolvable
tokens are **kept, not deleted** — the array is user-entered, there is no `tags` table
for those numbers to have ever meant anything, and emptying part of someone's profile
during a formatting fix is a change an audit should not make on its own authority. The
audit line worth keeping: a token that resolves to nothing is inert in `tagOverlap`,
in the GIN filter *and* in the counter trigger, so the migration's job was to make the
matching work, not to adjudicate what `3` used to mean.

**`/api/$`, and the boundary of what a route can fix**

`src/routes/api/$.tsx` answers unknown `/api/**` paths with `404` JSON
(`route_not_found`, echoing `path` and `method`) instead of `200 text/html` containing
the SPA bundle. Static segments outrank a splat in TanStack Router, so the declared
routes keep their handlers — verified after creating it: `/api/health` `200`,
`/api/wallet` `401`, `PUT /api/wallet` `405 allow: GET, POST`, `/api/nope`
`404 application/json`. What it *cannot* cover is a known path with an undeclared verb
(`/api/taps` matched by the `taps` route, no GET handler → SPA fallthrough): that needs
a `requestMiddleware` on the start instance, and this app has no `src/start.ts(x)` of
its own — creating one to change boot-wide request handling is the kind of change the
design review has already rejected once. So the six routes that move money, privilege or
another user's rows keep explicit `methodNotAllowed()` lists, and §3.10 records the rest.

**`types.ts` and the env template, corrected to the code**

`src/integrations/supabase/types.ts` still declared `find_similar_profiles`, an RPC no
migration has ever defined, for a client module deleted in §2.13: deleted, with the
surviving three documented as the ones 0004/0006 define and `chat.ts` calls with the
error checked. `.env.example` gained `VITE_VAPID_PUBLIC_KEY` (read by
`notifications-client.tsx`; without it the app never *asks* for push permission, which
is the intended default rather than a bug), the six `VITE_ENABLE_*` flags
`#/integrations/supabase/env.ts` actually parses, `SUPABASE_DB_URL`/`FYK_SEED_PASSWORD`
(`scripts/seed.mjs` refuses to run without a database URL and seeds nine accounts under
one shared password), and `PORT`.

### 2.15 The migration sequence aborted at file 0009, so 0009–0022 had never been applied (P0)

Found by reading `supabase/migrations/` as the ordered program it is — one file per
transaction, in version order, aborting the run on the first error — rather than as
twenty-five independent files.

`0009_optimizations.sql` opened with five `ALTER SYSTEM SET` statements. The SQL role a
Supabase project hands an application is not a superuser, so the first one raises
`must be superuser to execute ALTER SYSTEM`; on every project that followed the
documented path, **the migration run died on line 1 of file 0009 and nothing after it was
ever applied.** The same file then created 15 indexes and the materialised view
`public.user_stats` against tables that `0010_remaining_tables.sql` creates one migration
*later*, and joined `matches.user1_id`/`matches.user2_id` — columns no migration defines
(`0000` names them `user_a`/`user_b`).

The consequence was live rather than theoretical: `refresh_user_stats()` is what
`supabase/functions/cron-cleanup/index.ts` calls on its daily schedule, and the migration
that defined it sat behind a file that refuses to apply. So the app's own scheduled job
called a function that had never existed, in the one place a reviewer would expect a
`404 PGRST202` to have shown up — except that nothing calls `cron-cleanup` either (§3.15,
now closed by the same commit).

Split, with no behaviour invented:

| File | Now contains |
| --- | --- |
| `0009` (edited in place) | the six indexes valid at its point — messages, events, conversations — and a header saying what used to be here and why it left. Editing a pushed migration is normally forbidden; it is correct here because the file could never have applied, so a project that got past it has, by definition, not run it. |
| `0023_optimizations_reordered.sql` | the moved objects in an order that works: the 12 `users` column indexes, the `story_views`/`notifications`/`taps` keys, then `user_stats` + `user_stats_id_idx` built on the real `matches` columns, `refresh_user_stats()` (security definer, `refresh concurrently` with the documented plain-refresh fallback for a first load), `sweep_checkins_overdue()`, `enqueue_push_notification()` and a guarded `cron.schedule` block. No `create extension`: extensions belong to `0001`, and creating one in the transaction that is about to use it is a known way to abort a push. |
| `0024_notification_types_complete.sql` | `meetnow` in `notifications_type_check`. `src/routes/api/meetnow/index.ts` writes that type in the same transaction as the tap it announces, so every MeetNow join answered a 500 with SQLSTATE 23514 and rolled the tap back with it. The new list is a strict superset of both lists that preceded it (0013's eight and the four 0019 added), so `add constraint` can validate the rows it finds on any project. |

`enqueue_push_notification()` is a trigger on `notifications` insert that posts to
`functions/notify` through `pg_net`, gated on `current_setting('fyk.push_notify_url')`
being set *and* on the `net` namespace existing: where `pg_net` is not installed the
trigger is inert rather than fatal, which is the difference between a migration that can
be applied everywhere and one that can be applied where the author's project is.

**`src/lib/migration-invariants.test.ts`** (14 tests) is the machine-checked version of
every defect class this file set has produced, and it is the part of the pass that pays:
it needs no database. It pins that every `.rpc()` name is `create function`ed somewhere;
that every bucket a `storage.from()` call or bucket constant names is in an
`insert into storage.buckets` row list; that a trigger body reading `old.`/`new.`
branches on `tg_op` for the events it fires on; that every `create policy` in a
post-baseline file is preceded by `drop policy if exists`; that no file uses
`alter type … add value`; that every `type` literal written into the five constrained
tables is inside that table's CHECK — for both the Drizzle row objects and the SQL
`insert … values`, matched positionally via the column list; that grants name only roles
Supabase creates; that no file references a table a later migration creates; that no
file touches server configuration; and that every function the migration set calls at
run time is defined by the set.

Two of its rules found a real defect on their first run: the 0009 abort above, and the
`meetnow` type. Each rule was then proved non-vacuous by planting the violation (a typo'd
type in the route, a bogus literal in 0023's SQL insert) and watching it fail — which is
the only reason a static test over DDL deserves to exist. Comments are stripped from both
the SQL and the TS before scanning, so prose *about* a defect cannot satisfy a rule about
it, and test files are excluded from the app scan: a guard that read its own documentation
would have to stop describing the bugs it prevents.

### 2.16 A document can be authorised before it renders (P0, closes §3.3)

`supabase-js` persisted the session in `localStorage["fyk.auth"]`, which a document
request does not carry. Nothing on the server could tell a signed-in browser from a
stranger, so `GET /settings` answered `200 text/html` with the account screen — the
sign-out row, the delete-my-data row — and `GET /safety` answered `200` with a live
"arm a check-in" form whose submit then 401s. Three changes, in the order they depend on
each other:

1. **`#/integrations/supabase/client`** persists through `@supabase/ssr`'s browser client,
   i.e. `sb-<ref>-auth-token` cookies, so the credential is on the request.
   `bearerToken()` grew the reader that format needs: a session above 3180 bytes is split
   into `<name>.0`, `<name>.1`, …, which is the *normal* case for an access token plus a
   refresh token plus the user object, and the chunks are now grouped and joined in order
   while the look-alikes (`*-auth-code-verifier`) are refused.
2. **`#/lib/supabase-auth.server`** gained `verifyRequest()`, returning
   `authenticated | expired | anonymous | rejected | unreachable | unconfigured`;
   `getCaller()` is that narrowed to its old caller-or-null shape, so none of the ~30 API
   handlers changed. One verification path, two callers — that is the property, and it is
   why this did not become a second session implementation that trusts a cookie's name.
3. **`#/lib/document-auth.server`** (through `#/lib/document-auth`) is `beforeLoad` on the
   nine routes whose screen belongs to somebody: `/settings`×7, `/notifications`,
   `/safety`. The façade exists because Start's import protection refuses to build a
   client module that reaches a `.server.ts` file, even through `import()` — measured:
   the build failed with that error and named `createIsomorphicFn`, which is now the
   shape (a no-op client branch, the redirect on the server).

Deliberate limits, because each is a place a reviewer will otherwise look for a bug: the
server **never refreshes and never writes a cookie** (rotating a token during a render is
how a cached response gets somebody else's `Set-Cookie`; renewal stays with the browser
client, which writes the cookie itself, so no document response here can be poisoned);
`expired` **renders** rather than bouncing (a validly-signed token whose `exp` passed is a
browser about to refresh, and the document's data all comes from `/api/*`, which 401s
until it does); and `unconfigured`, `unreachable` and demo mode **render** — the sandbox
preview, a `vite dev` with no `.env.local`, and a GoTrue outage must not read as "everyone
is signed out", while the API stays fail-closed, which is where the data is. `/discover`
and `/grid` are deliberately unguarded: they are the first-run surface, and their private
data is already behind a verified endpoint.

Probed against a dev server whose `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_JWT_SECRET`
point at a non-existent project, so the local HMAC path answers and no network call can
excuse a wrong verdict:

| Request | Result |
| --- | --- |
| `GET /settings`, no cookie | `307` → `/auth/sign-in` |
| `GET /settings`, valid session cookie | `200` |
| `GET /settings`, valid session in two chunks | `200` (the reader reassembles) |
| `GET /settings`, expired-but-signed token | `200` (deliberate) |
| `GET /settings`, forged signature, and anon-role token | `307` |
| `GET /settings`, forged signature split across chunks | `307` (joining does not launder) |
| `GET /discover`, no cookie | `200` (not a private screen) |
| `POST /api/safety/check-in`, valid cookie, no / cross-site `Origin` | `403` (the same-origin gate is what makes a cookie credential safe) |
| `POST /api/notes`, valid bearer / forged bearer | `400` (reached validation) / `401` |
| every page, with the env removed | `200` — the preview and `vite dev` still work unsigned |

Two consequences worth naming. A browser holding an old `localStorage` session is not read
by the new client, so it signs in once more — no data moves, and this app has never been
deployed to a real project, which is the only situation where that would have been a
migration. And the session cookie is **not** `HttpOnly`, because the browser client has to
read it: the exposure is the same kind the old `localStorage` key had, not a new hole and
not a closed one. What changed is that the server can now tell who is asking.

`src/components/auth-gate.tsx` is deleted. It was a component named for this job,
imported by nothing, and described by three comments in this repository as the thing that
redirects a new account to `/onboarding` — which it never did, because it never ran. The
comments now say what is true (`EntryShell` renders its own inline onboarding step and
does not redirect) — until §2.21, which gave the server a redirect of its own.

**A rendered private document is `private, no-store`.** `GET /settings`, `/safety` and
`/notifications` with a valid session return `cache-control: private, no-store, max-age=0,
must-revalidate`, `pragma: no-cache` and `vary: Cookie, Authorization`. That is the necessary
companion to "the server verifies and never writes": an HTML document whose content depends
on a session has to be uncacheable at every layer in front of the origin, or the guard's
verdict — and the profile inside it — leaks to whoever the CDN serves next.

### 2.17 Every verb a route does not implement, and a lockfile that lets CI install

`methodNotAllowed(...)` went from the six routes that touch money, privilege or another
user's rows to **all 25 remaining files** under `src/routes/api/**`: an undeclared verb on
a declared path is now `405 application/json` with `Allow`, and with `src/routes/api/$.tsx`
answering unknown paths with `404 application/json`, no `/api/**` request can return the
SPA document. §3.10 closes on that.

`biome.json` turns on `linter.rules.security.noDangerouslySetInnerHtml`, which converts
§3.5's hand-verified invariant ("the map markup is static, keep it that way") into a rule.
Proved to fire by planting a sink in a throwaway file and watching Biome reject it, then
deleting the probe; the repository is at zero violations.

`pnpm-lock.yaml` is regenerated. That is not cosmetic: `package.json` dropped
`@prisma/client`, `@prisma/adapter-pg`, `bcryptjs` and `dotenv-cli` earlier in this audit
without resyncing the lockfile, and `Dockerfile:27` and `.github/workflows/ci.yml:31` both
run `pnpm install --frozen-lockfile`, which fails on that mismatch. CI and the image build
have therefore been red for every commit since the Prisma removal; `pnpm install
--frozen-lockfile` passes here now. What §3.16 was about — `@prisma/*` still appearing —
is unchanged and remains a packaging decision, not a security one.

---

### 2.18 A lint gate that can be blocking, built on a debt ledger

`pnpm lint` fails: 314 errors over `src` + `drizzle`, concentrated in ~56 screen files
(`useExhaustiveDependencies` in `CommandPalette.tsx`, `a11y/*` almost everywhere,
`noExplicitAny` in `CallOverlay.tsx`). A CI step that fails for every PR in the repository's
history is information-free, and the two obvious reactions were both refused: mass-fixing 60
design files (hook dependency arrays and JSX semantics *are* behaviour changes, and a
repo-wide `--write` would make a later wiring-only diff unprovable), and deleting the step.

`scripts/lint-gate.mjs` + `lint-baseline.json` is the third option. The ledger records how
many errors each `(file, rule)` pair has today; the gate lints **only the files a branch
touches** and fails when any of them exceeds its allowance. So a PR cannot add a violation
to a file that "already has some" — the excuse that makes a repo-wide gate decorative — and
no PR is blocked by debt it did not create. `pnpm lint:baseline` regenerates it and CI runs
`--strict-baseline` on `main`, which makes an improvement mandatory to record: **the ledger is
monotonic**, and `git diff lint-baseline.json` is the debt trend line.

Why not `biome lint --changed --since=<ref>`, the one-liner: measured here, an empty diff
makes Biome print "The list is empty." and **exit 1**, so a markdown-only change fails CI,
and its own git scan degrades to "no changed files" in a shallow checkout. The script unions
the committed and uncommitted diffs, restricts to `src/`+`drizzle/`, and skips paths that no
longer exist — a deleted file otherwise reaches Biome as
`internalError/io  No such file or directory`.

Four behaviours were exercised, not assumed: clean run exits 0; a planted 4th
`useIterableCallbackReturn` in `CallOverlay.tsx` (grandfathered at 3) exits 1 naming the
rule, the file, the allowance and the instruction not to raise it; a stale ledger under
`--strict-baseline` exits 1 asking for a shrink; `LINT_BASE` overrides the base ref for local
runs. And `pnpm lint:code` — the scope this repository owns outright (`src/lib`, the API
routes, the integrations, the auth domain, the middleware, the schema, `drizzle/`) — is
**zero-error**, so it blocks, after 8 `useIterableCallbackReturn` sites in `realtime.ts`,
`audio.ts`, `gpu.ts`, `platform.ts` and `profiles.ts` were braced (callback returns that
`forEach` discards; behaviour identical).

### 2.19 Pruning as remediation, with the numbers re-measured

`src/components/discover/` — 4 files, 1448 lines, `DiscoverClient` and its
`profile-card`/`profile-modal`/`stories-rail` parts — is deleted: zero importers outside the
directory, verified for the bare basenames too (the only `profile-card` matches in the repo
are CSS class names in `/grid`). `/discover` renders
`src/components/explore/explore-client.tsx`, which has carried the real API contract since
§2.9. Deleting it also removed 47 of the repo-wide lint errors, which is the honest way to
reduce that count: the code that fails the rules and the code that is unreferenced are the
same code.

Re-measured after the deletion, with the graph written down so the next pass re-measures
instead of re-quoting: every file under `src/routes/` plus everything `src/routeTree.gen.ts`
names is a root, `#/` and relative specifiers are followed transitively, tests excluded →
**160 of 364 non-test source files (43%)** are unreachable (`core` 71, `components` 36,
`lib` 22, `domains` 16, `integrations` 5, `data` 4, `hooks` 4). It was 57% when the audit
started. Two clusters must not be pruned by that graph alone, and are the reason the number
is a starting point rather than a to-do list: `src/core/**` is tested (22 of its files have
passing specs, so §3.17's UI debt and §3.7's "unreachable" overlap in files somebody owns)
and `src/domains/demo` is read at runtime through `VITE_ENABLE_DEMO`, which no static import
expresses.

### 2.20 `node_modules/prisma` was never needed

`pnpm why prisma` answers §3.16 directly: the only thing requiring it is pnpm's own
`auto-install-peers` resolving `drizzle-orm`'s optional `prisma` peer. Nothing in the
repository imports `prisma` or `@prisma/client`; `drizzle-kit` and `drizzle-orm` work without
them. So `.npmrc` gained `auto-install-peers=false`, which:

* removes 1257 lines from `pnpm-lock.yaml` — the whole optional-peer closure
  (`@prisma/engines`, `@prisma/studio-core`, `@prisma/query-plan-executor`, the AWS/Cloudflare
  driver peers of `drizzle-orm`) — leaving 28 lines changed instead of a 1300-line re-resolve;
* makes `pnpm install` stop printing "Ignored build scripts: … prisma" and stop creating
  `node_modules/prisma`, which was the artefact that made the stack look half-migrated;
* keeps typecheck, 196 tests, `vite build` and `pnpm install --frozen-lockfile` green, which
  is the evidence that no runtime peer was actually being satisfied that way.

The one-off cost is that *future* genuinely-needed peers must be declared as direct
dependencies instead of implicitly hoisted. That is the preferable failure mode (a missing
module at install or build time, versus a package manager silently guessing at a
dependency graph), and it is why the option is documented in `.npmrc` rather than left
implicit.

### 2.21 A signed-in account with no profile row is routed by the server

The last branch of §3.3. `#/lib/provisioning.server` answers "does this auth id have a
`public.users` row?" for both the document guard and (by contract, not by call) the
`/api/auth/me` shape, and it is **three**-valued — `present | missing | unknown`, where
`unknown` is a missing `DATABASE_URL`, a refused pooler or a timeout. A render must not read
an outage as "this account is new": that would send every signed-in user to a form that
writes a profile row over a healthy one, turning a health check into a data bug. So
`unknown` renders; only an empty `SELECT` redirects, to `/onboarding`.

`documentDecision()` is separated from the I/O so the navigation table is testable without a
request, a database or a project (5 cases, `src/lib/__tests__/document-auth.test.ts`), and
`/onboarding` is deliberately *not* guarded: the same rule at the destination is a loop, and
loops are this class of guard's characteristic failure. Measured against a configured dev
server with no database: valid `200`, chunked `200`, expired `200`, forged `307 →
/auth/sign-in`, no cookie `307 → /auth/sign-in`, `/discover` `200`, `/onboarding` `200`. The
`missing` branch cannot be probed here (no Postgres, §3.13), which is why it is the one
behaviour in this audit carried by a unit test rather than by a `curl`.

This also settles §3.18 the way the finding asked to be settled: the endpoint and the guard
now share one predicate, so `EntryShell` re-deriving it in the browser is a small cleanup
against a single source of truth, not a fork in the logic.

---

## 3. Open findings — real defects, deliberately not "fixed" by invention

Nineteen entries, and the split is the point: **§3.1, 3.2, 3.3, 3.8, 3.10, 3.15, 3.16, 3.17
are closed** with the reasoning kept, because a closed finding that does not say *why* it is
closed becomes a re-audit; **§3.5, 3.6, 3.7, 3.9, 3.11, 3.13, 3.18 are each one deliberate
half** whose other half is a mechanism (a lint rule, a trigger, an apply, one shell's import)
rather than more code; and **§3.4, 3.12, 3.14, 3.19 need a product or schema decision** — for
those, inventing an implementation is how a second, worse truth gets committed, so each entry
says what to decide instead of deciding it here. The most recent closures (§2.18–§2.21) came
from the same reflex: prefer the change that makes a signal blocking, a subtree gone, a
lockfile honest, or a redirect real over the change that adds code nobody asked for.

1. **~~Still-missing endpoints~~ — closed by §2.8**, except by decision: no
   `/api/auth/*` should ever exist (Supabase owns the session), and `/api/users`
   has no caller outside a test fixture. If `src/core/**` survives, its auth hooks
   must be pointed at `supabase.auth` rather than at endpoints that will not come.
2. **~~Two user tables, no bridge.~~ Closed by §2.10.** The history, kept
   because it explains the vocabulary: `0000_profiles.sql` created
   `public.profiles` (`pseudo`→`display_name`, RLS enabled, `age between 18 and
   120` DB check, `lat_coarse/lng_coarse` only) while `0010_remaining_tables.sql`
   creates `public.users` (`pseudo`/`nick`, `lat`/`lng` precise, no RLS) and
   points `taps`/`favorites`/`meetnow_posts`/`notifications`/`push_subscriptions`/
   `sessions` at *that*. `src/integrations/supabase/types.ts` declares both,
   which is why `tsc` never complained. The consequence was that the browser and
   the API read different rows for the same person, with nothing linking
   `users.id` to `auth.users.id`. `0015_server_canonical.sql` added the FK
   (`users.id → auth.users(id) on delete cascade`, guarded so it is a no-op when
   already present) and the columns the API reads; `0018` then chose the survivor
   — `public.users` for writes, `public.profiles` as the read projection — and
   closed the browser's direct access to the row. Diffing against the migrations
   with `pnpm db:generate` is still the way to keep them aligned.
3. **~~No SSR-level authorisation.~~ Closed by §2.16**, with the limits stated in it
   rather than hidden: the server verifies and never refreshes, an expired-but-signed
   token renders, and an unconfigured or unreachable GoTrue renders (fail-open for the
   document, fail-closed at the API, which is where the data is). The entry also
   understated the defect while it was open — it said `/grid`, `/profile` and `/chat` were
   "protected only after hydration" by `AuthGate`/`auth-guard`; nothing protected them at
   any layer, because `src/components/auth-gate.tsx` was imported by no route. It is
   deleted, the guard is `beforeLoad` on the nine routes whose screen belongs to somebody,
   and `/discover`//`/grid` stay public on purpose. Its last open branch — an authenticated
   id with no profile row getting an empty private screen instead of being routed to the flow
   that fills it — is closed by §2.21, including the outage rule that had to exist before that
   branch could be closed safely.
4. **`script-src 'unsafe-inline'` is still required** because TanStack Start
   inlines the hydration payload. Nonces + `'strict-dynamic'` (or a
   hashed-per-response payload) is the follow-up; until then a stored XSS in a
   bio can execute inline. `style-src 'unsafe-inline'` is likewise forced by
   runtime-injected styles and is not a comparable risk.
   **Checked, and already right:** `'unsafe-eval'` is dev-only —
   `src/lib/security.ts:46` emits it when `!isProduction()` (HMR needs it) and omits
   it otherwise, and `src/lib/__tests__/security.test.ts` pins both halves. Do not
   "remove unsafe-eval" a second time; the open part of this item is only the inline
   script/`style-src` noncing.
5. **Three `innerHTML` assignments — verified static, not sinks.** An earlier
   version of this entry claimed `src/components/map/FYKMap.tsx:273`, `:303` and
   `src/components/map/MapPicker.tsx:87` "interpolate strings into `innerHTML`".
   Re-checked in full: one clears a node (`= ""`), the other two assign fixed
   markup (a pulse `<span>`, an inline SVG pin) with no substitution anywhere, and
   `grep -rnE "innerHTML\s*=\s*['`"][^'`"]*\$\{" src/` finds nothing, as does
   `dangerouslySetInnerHTML`. "Keep it true" now has a mechanism rather than a promise:
   `linter.rules.security.noDangerouslySetInnerHtml` is `error` in `biome.json` (§2.17),
   so the template-literal-into-`dangerouslySetInnerHTML` change a future contributor might
   paste stops at `pnpm lint` instead of at review. The remaining cosmetic half of this
   item — building the map popup from `textContent`/elements instead of a fixed string —
   is a design-file change and is left to the owner. DOMPurify remains a dependency
   imported by nothing.
6. **Unowned modules — further reduced.** Deleted in §2.13: `src/routes/test.tsx`,
   `src/routes/platform/` and the five browser-authority modules; in §2.16:
   `src/components/auth-gate.tsx` (imported by nothing, and its comment claimed a redirect
   that did not exist); in §2.19: `src/components/discover/`, four files and 1448 lines whose
   only live reference was its own test. Each of those deletions also removed lint errors,
   which is the honest ordering: the code that fails the rules and the code nobody imports are
   largely the same files. What is left in this finding is the part deletion cannot solve —
   `src/core/**` and the unused `src/components/**` leaves, whose real problem is §3.17's lint
   debt and whose fix is a per-module decision about whether the design system is a product or
   a fixture. The static graph that produced these numbers is written down in §2.19, so the
   next pass re-measures instead of re-quoting this one.

7. **~43% of `src/` is unreachable from any route** — 160 of 364 non-test files, re-measured
   after §2.19's deletion (it was 57%, 212 of 370, when the audit started, and 44% after
   §2.13–§2.16). By area: `src/core` 71, `src/components` 36, `src/lib` 22, `src/domains` 16,
   and single files in `data`, `hooks`, `integrations`, `types`. Two sets must **not** be
   pruned on the graph alone: `src/core/**` is tested (22 of its files have passing specs) and
   `src/domains/demo` is what `VITE_ENABLE_DEMO` turns on at runtime, so no static import
   reaches it from the routes that consult the flag. The finding's two named examples are now
   closed: `src/components/discover/discover-client.tsx` is deleted (§2.19), and `/onboarding`
   has its first real entry point because the guard routes an unprovisioned account to it
   (§2.21) — two screens, one flow, and now a direction to travel between them. Prune the rest
   one module per commit with the tests as the guide, and re-run the measurement rather than
   trusting this number after the next deletion. `pnpm-workspace.yaml` still carries ~900 lines
   of tool-managed `dyad-default-allow-builds` entries; they are the sandbox's, not the app's,
   and hand-editing them has broken installs before.

8. **~~Seeds write `password_hash` with bcryptjs~~ — closed by §2.10.**
   `scripts/seed.mjs` creates the login through `POST /auth/v1/admin/users`
   before it inserts the row, and refuses to run at all when the service key is
   missing. `public.users.password_hash` itself was dropped in 0018.
9. **A user's tag bag can hold two vocabularies.** `users.tribes` gets tribe
   **names** from `/tribes` and numeric **tag ids** from the profile editor, so a user who
   used both ends up with `["hiking", 3]` and the compatibility score counts one overlap
   where a person would see two. The columns are untyped jsonb with no foreign key, so
   nothing is *wrong* at the database level. Half of this is now handled: `0022`
   normalises on write through `normaliseTribeTokens` (`#/lib/tribes.server`), resolving a
   token against `tribes.name` and keeping an unresolvable one verbatim — deliberately
   *keep-what-you-cannot-resolve*, because there is no `tags` table for the numbers to
   have ever pointed at, and emptying part of somebody's profile during a formatting fix is
   not a change an audit should make on its own authority. What remains is the
   **existing** rows: a one-off backfill of the same mapping, which needs the list of
   legitimate numeric tag ids from whoever owns the vocabulary. `tribes.member_count`,
   `groups.member_count`, `fansites.subscriber_count` and `shouts.likes_count` are derived
   by triggers since `0019` §7, so a hand-written value on any of them raises.
10. **~~An API path with an undeclared method returns the SPA document.~~ Closed by
    §2.17.** All 25 remaining files under `src/routes/api/**` carry a `methodNotAllowed(...)`
    verb list next to the six that had one, and `src/routes/api/$.tsx` answers unknown paths
    with `404 application/json`; measured at the tip, `GET /api/nope` is a JSON 404 and
    `DELETE /api/safety/check-in` is a JSON 405 with `allow: GET, POST`. The only thing that
    would have made this one line instead of twenty-five is a `requestMiddleware` on the
    start instance, and this app has no `src/start.ts(x)` of its own — creating one changes
    boot for everything to service a status code, which the design review has already
    rejected twice. So the fix is per-route and complete, and this record exists so nobody
    re-litigates whether a global handler was overlooked: it was, and it is not.
11. **A check-in can be overdue without anybody being paged.** §2.14 replaced the
    notification-shaped record with `safety_checkins` + `safety_contacts` (0021), so the
    timer survives a reload, the contact is the user's own chosen row rather than
    themselves, and `missed` is materialised with exactly-once alerting. §2.15 then made the
    overdue sweep reachable at all (`sweep_checkins_overdue()` lived in a migration that
    aborted the push) and `0023` added the delivery plumbing around it:
    `enqueue_push_notification()` posts a new `notifications` row to `functions/notify`
    through `pg_net`. What is still missing is delivery to somebody **not in the app**: a
    contact who does not open the app learns nothing from a row in their own inbox, and the
    `phone`/`email` columns on `safety_contacts` exist for exactly that sender but have no
    consumer. That needs a provider decision (email job, SMS) and a deployment that has
    `pg_net` installed and `fyk.push_notify_url` set — the trigger is inert without them,
    by design. Until then the screen says "off-platform" on such a contact rather than
    promising a notification.
12. **Premium is one enforced perk wide.** `plus` = unlimited taps, `gold`/`platinum`
    = boosts a month. That is what this codebase can actually grant, and everything
    else the tier cards used to advertise has been removed from `TIER_PERKS` rather
    than implemented half-way. Turning Premium into a product (advanced filters,
    read-receipt toggles, incognito, per-tier AI budget, `users.tier` in the deck's
    ranking) is a sequence of product decisions, each of which is small once the
    decision exists — see `#/lib/economy.ts` for where each one plugs in.
13. **Nothing in this sandbox has ever run the SQL.** There is no Postgres in the
    image (no `initdb`, no Docker, no root for `apt`), so all 25 migration files are reviewed
    and cross-checked against the DDL of every table and constraint they touch — column
    names, CHECK vocabularies, trigger ordering, the `new`-in-`DELETE` trap in row-level
    triggers, statement order around the append-only guard — but they are not *executed*.
    That limit is what `src/lib/migration-invariants.test.ts` (§2.15) exists to push back on:
    it is a test, not a database, and it is how the 0009 abort and the `meetnow` CHECK
    violation were found without one. Apply `0009`, `0023` and `0024` in front of traffic
    (`supabase db push`, or `pnpm db:migrate:sql`, which now loops the files with
    `ON_ERROR_STOP=1`) and re-check `pg_policies` for the tables in §2.13 before shipping.
    `pnpm db:seed` has likewise never been run here. One environment hazard is worth
    recording because it bit twice: the sandbox can be re-provisioned mid-pass, leaving a
    fresh clone whose `main` is a squashed pre-audit snapshot, `node_modules` gone, and this
    branch's `HEAD` on the *pre-work* commit. `git fetch origin <branch>` + `git reset
    --hard FETCH_HEAD` recovers it when the tree holds nothing unpushed, and
    `--mixed` (tree untouched) when it does — the one thing not to do is merge `main`, whose
    single commit predates the Drizzle/Supabase conversion and would revert the work.
14. **35 live tables have no Drizzle model.** `drizzle/schema.ts` declares 34 of the
    69 tables the migrations create, and §4 of this file used to claim the schema was
    "the single schema … all describe the same columns" — that was measured wrong, and
    the claim is corrected here rather than quietly rewritten. The gap is concentrated
    where routes still speak SQL directly (`profiles`, `shouts`, `groups`,
    `group_messages`, `stories`, `board_posts`, `reports`, `sessions`, `site_config`,
    the `ai_*` and `*_embeddings` tables), which works and is type-checked nowhere.
    `src/lib/schema-coverage.test.ts` now pins both directions: a model may not exist
    for a table no migration creates, and the list of unmodelled tables may only shrink.
    Closing it is one table per commit against the DDL (`profiles` first: it is the
    projection 0018 exists to publish), *not* a bulk translation — inventing a column
    name is the exact defect class this file keeps finding.
15. **~~Two edge functions that nothing invokes.~~ Now invoked, with a deployment
    condition attached.** `0023` adds `enqueue_push_notification()` (a trigger on
    `notifications` insert → `functions/notify` over `pg_net`) and schedules
    `cron-cleanup`'s work through a guarded `cron.schedule` block, which is what
    `sweep_checkins_overdue()` and `refresh_user_stats()` were built for. Both additions
    check for the extension they need before using it, so a project without `pg_net` or
    `pg_cron` applies the file and simply does not get the behaviour — which is better than
    failing the push, but is *not* the same as delivery. The remaining decision is the
    deployment one: `supabase functions deploy notify cron-cleanup`, `VAPID_PRIVATE_KEY`
    and `VAPID_SUBJECT` set in the function environment, `fyk.push_notify_url` as a role
    setting, and `VITE_VAPID_PUBLIC_KEY` in the browser (`.env.example` documents all four).
    Until that happens, a push subscription is stored and never used, and stale
    stories/meetnow posts are filtered at read time forever instead of being cleaned.
16. **~~`pnpm-lock.yaml` still resolves the Prisma-era optional peers.~~ Closed by §2.20.**
    `pnpm why prisma` showed `node_modules/prisma` existed only because pnpm's
    `auto-install-peers` resolves `drizzle-orm`'s *optional* `prisma` peer; nothing imports it.
    `.npmrc` now sets `auto-install-peers=false`, the lockfile lost 1257 lines, and
    `pnpm install --frozen-lockfile`, typecheck, 196 tests and `vite build` all pass afterwards.
    The standing consequence is written in `.npmrc`: a future peer that is genuinely required
    must be added as a direct dependency, not assumed.

17. **~~`pnpm lint` fails on `main` and CI has been running red since `7637929`.~~ The gate is
    closed; the debt is not.** §2.18 pins `biome check` on every file this repository touches
    and makes a *diff* gate blocking through `lint-baseline.json`, so a PR cannot add a
    violation to a file that already has some. 314 errors remain across ~56 screen files —
    `useExhaustiveDependencies` in `CommandPalette.tsx`, `a11y/noStaticElementInteractions` and
    `a11y/useKeyWithClickEvents` in nearly every interactive div, `useSemanticElements` where a
    `div` should be a `button`, `noExplicitAny` in `CallOverlay.tsx`. Fixing them is a per-file
    change to hook arrays and JSX semantics, which *is* behaviour, and it is worth doing exactly
    once per file with the preview open — the ledger is what makes that ordering safe, since
    every fix has to shrink it in the same commit and every regression has to fail CI. This
    audit is not going to pretend a sweep of 60 design files was a refactor.

18. **~~`/api/auth/me` implements the shell's contract and nothing calls it.~~ Decided, and half
    closed.** The endpoint stays (§2.21): the server-side mapping to `ProfileUser` and the
    `{ user: null }`-rather-than-401 distinction are what a shell needs, and re-deriving them
    per screen is how three login states get committed. The server-side twin of its
    "provisioned?" question now exists and is shared with the document guard, so the guard
    routes instead of rendering an empty screen. What remains is the mechanical half:
    `EntryShell` should stop deciding who is signed in in the browser, and one of
    `src/routes/onboarding.tsx` and the inline `<Onboarding>` step it duplicates should be
    deleted — §2.21 gave the route its first caller, so the duplication is now a fork rather
    than a curiosity.

19. **The session is a cookie now, and it is not `HttpOnly`.** Listed so it is not
    rediscovered as an oversight: `@supabase/ssr`'s browser client has to read the session
    it wrote, so `sb-<ref>-auth-token` is script-readable exactly as `localStorage` was.
    What that is fine for: the same-origin gate in `#/middleware#withSecurity` covers every
    method, so a cross-site form cannot *use* the cookie (verified: `POST
    /api/safety/check-in` with a valid cookie and no `Origin`, and with `Origin:
    https://evil.example`, both `403`). What it is not fine for: an XSS payload can still
    exfiltrate a session — which is why §3.4's CSP still carrying `'unsafe-inline'` is the
    finding that actually matters here, and why §2.17 turned the sink check into a lint rule.
    `HttpOnly` would require the sign-in exchange to happen on the server (a
    `createServerClient` in a `beforeLoad` that also *writes* the cookie, plus a refresh
    path), which is the next step up from §2.16 and is not a change to make in passing.

## 4. Minimal assumptions

- Sessions live in `sb-<ref>-auth-token` cookies written by `@supabase/ssr`'s browser
  client, and the server *verifies* them without refreshing or writing one. That pairing is
  what makes an SSR guard possible with one verification path; `HttpOnly` would need the
  token exchange itself to move server-side (§3.19).
- The document guard fails open when Supabase is not configured, because the sandbox
  preview and `vite dev` without a `.env.local` are not deployments — the API stays
  fail-closed, and that asymmetry is a deliberate decision, not an unfinished one (§2.16).
- Migration files are validated by reading the DDL of everything each touches, because this
  image has no Postgres, no Docker and no root for `apt`. `src/lib/migration-invariants.test.ts`
  is the closest available substitute: 14 static rules over the migrations *and* the code
  that calls them. Say so when reviewing a file; do not assume an apply happened (§3.13).
- The deployment is `vite build` + the SSR/API handler serving `dist/client`
  (no separate Nitro/edge target is configured), so `vite preview` is a valid
  production command at this stage; `AUDIT.md` §3.3 and the Dockerfile comment
  record the tradeoff instead of inventing a hand-rolled Node listener.
- Supabase Auth owns credentials. `public.users.password_hash` (and
  `apple_id`/`google_id`) were legacy columns that nothing read; `0018` drops
  them rather than leaving a second, tempting way to authenticate.
- `users.id` equals `auth.users.id` (the only way a token subject can key an app
  row) — `0015` turns that convention into a foreign key rather than assuming it.
- Row Level Security stays the browser's boundary: nothing here adds a
  service-role call to a request path.
- `drizzle/schema.ts` is the *server's* schema — every table it declares is a table a
  migration creates, and `src/schema.ts` plus `scripts/seed.mjs` describe the same
  columns. It is **not** yet complete: 35 of the 69 live tables have no model (§3.14),
  and the routes that touch those use `sql\`\`` directly, which is why the phrase "the
  single schema" was wrong and is corrected here. `src/lib/schema-coverage.test.ts` is
  the guard that keeps the claim honest in both directions from now on.
  `src/integrations/supabase/types.ts` remains hand-written — it is what the browser's
  `supabase-js` client type-checks against, and `pnpm supabase gen types` should replace
  it verbatim as soon as a real project URL is configured, at which point drift becomes
  impossible. Its `find_similar_profiles` entry (an RPC no migration defines) is deleted
  in §2.14 for exactly the reason that generator exists.

## 5. Suggested order for the next pass

1. **Apply the migrations for real** (`supabase db push` against a throwaway project, then
   `pg_policies`, then `pnpm db:seed`). This is the last item whose answer cannot be obtained
   by reading, and it is also what turns §2.21's `missing → /onboarding` branch from a unit
   test into a behaviour: with no Postgres here, `profileRowExists` can only ever return
   `unknown` (§3.13).
2. **§3.18's mechanical half** — `EntryShell` onto the guard or `/api/auth/me`, and delete one
   of the two onboarding screens. Small, and it removes the last place where a browser decides
   who is signed in.
3. **§3.19**, with §3.4 read first: `HttpOnly` needs a server-side exchange, and the CSP that
   would make script-readable storage non-extractive is the other half of the same decision.
4. **§3.17's debt, file by file**, running `pnpm lint:baseline` in the same commit as each fix
   so the ledger shrinks where it should be visible. `--strict-baseline` on `main` makes
   skipping that step fail CI.
5. **§3.12** (Premium is a product decision with a known plug-in point in `#/lib/economy.ts`),
   then **§3.9** (single-valued tribe vocabulary) and **§3.7** (pruning, one module per commit,
   re-measured each time with §2.19's script).

Closed since the first draft of this list: the wallet/entitlement ledger (§2.13), the inbox and
social graph leaving the browser (§2.13), the safety record and its notifications (§2.14,
§2.15), the migration sequence abort (§2.15), the 405/404 surface (§2.17), cookie sessions →
an SSR guard (§2.16) and its provisioning branch (§2.21), the dead discover subtree and the
Prisma-shaped lockfile (§2.19, §2.20), and a lint gate that blocks instead of decorating
(§2.18). Items 1 and 2 of the previous version of this list — "six files, one green
`pnpm lint`" and "`/api/auth/me`: move the shell or delete the endpoint" — are what those
four sections replaced.
