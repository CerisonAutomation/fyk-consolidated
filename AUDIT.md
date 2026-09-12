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


## 3. Open findings — real defects, deliberately not "fixed" by invention

These need a product or schema decision. Inventing an implementation is how a
second, worse truth gets committed, so each entry says what to decide instead.

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
5. **Three `innerHTML` assignments — verified static, not sinks.** An earlier
   version of this entry claimed `src/components/map/FYKMap.tsx:273`, `:303` and
   `src/components/map/MapPicker.tsx:87` "interpolate strings into `innerHTML`".
   Re-checked in full: one clears a node (`= ""`), the other two assign fixed
   markup (a pulse `<span>`, an inline SVG pin) with no substitution anywhere, and
   `grep -rnE "innerHTML\s*=\s*[\'`"][^\'`"]*\$\{" src/` finds nothing, as does
   `dangerouslySetInnerHTML`. So the invariant `src/integrations/supabase/client.ts`
   asserts is currently true, and the work left is to keep it true — the map popup
   markup should be built with `textContent`/elements so that a future contributor
   cannot break it by pasting a template literal. DOMPurify remains a dependency
   imported by nothing.

6. **Unowned modules — mostly resolved.** Deleted in §2.13: `src/routes/test.tsx`,
   `src/routes/platform/index.tsx`, `src/domains/auth/test-accounts.ts`,
   `src/components/providers.tsx`. `src/lib/r2-upload.ts` and `src/lib/crypto.ts`,
   named by an earlier pass, no longer exist. Still open: `src/utils/cn.ts`
   duplicates `cn()` from `src/lib/utils.ts` and 26 files import the former, so
   removing it is a 26-file mechanical change best done alone (nothing else in
   `src/` should be in the same diff); `src/core/ui/organisms/*` is unreachable
   from any route but is the design system's own surface, and needs an owner's
   decision rather than mine.

7. **~57% of `src/` is unreachable from any route** (212 of 370 files by import
   graph, computed during the audit) and `pnpm-workspace.yaml` carries ~900 lines
   of `allowBuilds` noise. Both make every review slower than the code deserves.
   `src/domains/demo`, `src/core/**` (which *is* tested) and the `*-store.ts`
   modules are the interesting parts of that set: prune with the tests as the
   guide, not the graph alone.
8. **~~Seeds write `password_hash` with bcryptjs~~ — closed by §2.10.**
   `scripts/seed.mjs` creates the login through `POST /auth/v1/admin/users`
   before it inserts the row, and refuses to run at all when the service key is
   missing. `public.users.password_hash` itself was dropped in 0018.
9. **A user's tag bag can hold two vocabularies.** `users.tribes` gets tribe
   **names** from `/tribes` and numeric **tag ids** from the profile editor, so a
   user who used both ends up with `["hiking", 3]` and the compatibility score
   counts one overlap where a person would see two. The columns are untyped jsonb
   with no foreign key, so nothing is *wrong* at the database level; the fix is a
   one-off normalisation (map every known name to its `tags`/`tribes` id, write the
   array back) plus making `/tribes` send ids — not a check constraint added on top
   of existing data. `0019` §7 removed the *other* half of this finding:
   `tribes.member_count`, `groups.member_count`, `fansites.subscriber_count` and
   `shouts.likes_count` are now derived by triggers, and a hand-written value on
   any of them raises. The vocabulary itself is still two-vocabulary, and the
   recount trigger has to match on both spellings (`t.name` or `t.id::text`)
   because the data already disagrees.
10. **An API path with an undeclared method returns the SPA document.**
   `GET /api/taps` answers `200 text/html`, because TanStack Start matches
   routes by pathname and this route declares `POST`/`DELETE` only. No caller
   is affected (the taps hooks use `/api/interest/*` for lists), and the fix is
   not a per-route `GET` stub: it is one catch-all under `/api/$` that answers
   `405`/`404` as JSON, which needs a check that it cannot shadow a declared
   route's own method. **Partly closed in §2.13**: the six routes that touch money,
   privilege or another user's rows (`/api/wallet`, `/api/king-pet`,
   `/api/fansites/subscribe`, `/api/safety/check-in`, plus `/api/boost` and the
   others with a `methodNotAllowed()` verb list) answer 405 with an `Allow` header
   — verified by `curl -X PUT /api/wallet` → `405 application/json, allow: GET, POST`.
   A global `/api/$` catch-all for the remaining routes is still the right fix and
   still needs the shadowing check.

11. **A safety check-in is stored inside a notification body.** `0019` made the
    type legal and `POST /api/safety/check-in` made the write server-side, so the
    feature now works — but the *record* is still `{contact_id, place, due_at,
    status}` as JSON in `notifications.body`, which means there is no index on
    `due_at`, no way to answer "who is overdue right now" without a scan, and no
    history once a notification is hidden. The honest shape is a
    `public.safety_checkins (user_id, contact_id, place, armed_at, due_at, resolved_at,
    status)` table with the notification as a projection of it. Deliberately not
    done here: inventing a table while `resolve` still parses the JSON would leave
    two writers of one fact.
12. **Premium is one enforced perk wide.** `plus` = unlimited taps, `gold`/`platinum`
    = boosts a month. That is what this codebase can actually grant, and everything
    else the tier cards used to advertise has been removed from `TIER_PERKS` rather
    than implemented half-way. Turning Premium into a product (advanced filters,
    read-receipt toggles, incognito, per-tier AI budget, `users.tier` in the deck's
    ranking) is a sequence of product decisions, each of which is small once the
    decision exists — see `#/lib/economy.ts` for where each one plugs in.
13. **Nothing in this sandbox has ever run the SQL.** There is no Postgres in the
    image (no `initdb`, no Docker, no root for `apt`), so `0019` and `0020` are
    reviewed and cross-checked against the DDL of every table and constraint they
    touch — column names, CHECK vocabularies, trigger ordering, the
    `new`-in-`DELETE` trap in row-level triggers, and statement order around the
    append-only guard — but they are not *executed*. Apply them in front of traffic
    (`supabase db push`, or `pnpm db:migrate:sql` now that it loops the files) and
    re-check `pg_policies` for the tables in §2.13 before shipping. `pnpm db:seed`
    has likewise never been run here; §2.13's §9 seeding is what the product needs,
    and it is in the migration where it belongs.

## 4. Minimal assumptions

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
- `drizzle/schema.ts` is the single schema: migrations, `src/schema.ts`, and
  the seed script all describe the same columns. `src/integrations/supabase/types.ts`
  remains hand-written — it is what the browser's `supabase-js` client type-checks
  against, and `pnpm supabase gen types` should replace it verbatim as soon as a
  real project URL is configured, at which point drift becomes impossible.

## 5. Suggested order for the next pass

1. ~~Decide §3.1 endpoint-by-endpoint~~ (done, §2.7–2.8) and ~~decide §3.2~~
   (done, §2.10). Regenerate `src/integrations/supabase/types.ts` with
   `pnpm supabase gen types` against a migrated project so the browser types are
   derived, not maintained by hand.
3. Cookie sessions (§3.3) → then an SSR guard, then tighten `Cache-Control` on
   documents that become personalised.
4. CSP nonces (§3.4). §3.5 is re-checked and closed as a non-finding (the three
   `innerHTML` sites are static); the follow-up there is a lint rule, not a fix.
5. Prune §3.6 (one file at a time) and §3.7. `pnpm-workspace.yaml`'s 269-line
   `allowBuilds` block is between `dyad-default-allow-builds begin/end` markers —
   tool-managed, so it must be pruned by its generator, not by hand.
6. Apply §2.13's SQL against a real database (§3.13), then decide §3.11 and §3.12
   with the product, in that order: the migration is what makes the rest of the
   surface honest.

Run `pnpm verify` (typecheck → tests → build → `biome check` on the API/lib
surface) before and after each step; `pnpm test:e2e` now boots its own server.
