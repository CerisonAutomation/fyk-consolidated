# FYK — Find Your King

A gay social and dating app for men: nearby discovery, a live Board, real 1:1 chat,
member-hosted events, and a moderation queue that a human actually works through.
Adults only. Dark, gold, dense-but-calm UI.

This README describes the app that exists in this repository. Anything it does not
mention does not exist — FYK has no feature flags hiding half-built systems, no
mock data, and no "coming soon" copy.

## Stack

| Layer | What it is |
|---|---|
| App | TanStack Start (Vite + React 19 + file-based routing) |
| Styling | Tailwind v4, tokens in `src/styles.css` |
| Server API | One dispatcher: `src/server/router.ts`, entered through `src/routes/api/$.ts` |
| Data/auth | Supabase Postgres + GoTrue via `@supabase/ssr`; session lives in cookies |
| Authorization | Postgres row-level security + triggers. The API client is always caller-scoped |
| Tests | Vitest (`src/server/**`, `src/lib/**`) |

## Run it

```bash
pnpm install
cp .env.example .env.local          # fill in the Supabase URL + anon key (browser and server)
pnpm db:push                        # or paste supabase/migrations/*.sql in filename order
pnpm dev                            # http://localhost:3000
```

Verify everything:

```bash
pnpm typecheck && pnpm test && pnpm build
```

If Supabase is not configured the app renders a setup screen naming the missing
variables instead of booting into an empty shell.

## The core loop

1. Sign in / create account (email + password, 18+ confirmed, cookie session).
2. Onboarding: name, handle, birth date, city, interests, optional coarse location.
3. **Nearby** (`/grid`) — profiles in your coarse area, tap or pass.
4. **Profile** (`/profile/$id`) — photos, intent, report, block, favourite.
5. **Chats** (`/chat`, `/chat/$id`) — text and photo/video messages with reply,
   react, edit (15 min), recall (60 min), pin, report.
6. **Board** (`/board`) — live "I'm around" invites with capacity and an expiry.
7. **Events** (`/events`) — members host, others RSVP going/maybe.
8. **Safety** (`/safety`) — your reports, your blocks, profile views, what FYK
   does and does not enforce.
9. **Settings** (`/settings`) — profile, photos, privacy, availability, session.
10. **Moderation** (`/admin`) — queue, decision dialog, append-only log (role-gated).

## How requests work

Every browser call goes through `src/lib/client.ts` (`api.get/post/patch/del`),
which sends `credentials: "include"`, a generated `X-Request-Id`, unwraps the
envelope, and throws an `ApiClientError` whose message is always safe to display.
No bearer token is ever stored in the browser.

Server responses are shaped by `src/server/context.ts` + `src/server/errors.ts`:

```jsonc
{ "ok": true,  "data": { … }, "requestId": "fyk_…" }
{ "ok": false, "error": { "code": "rate_limited", "message": "…", "details": { … } }, "requestId": "fyk_…" }
```

`src/server/errors.ts` is the only place errors are converted, so a Postgres
message, a JWT, a storage path or a stack frame cannot reach a client by accident.
Rate limits are enforced before any database call, per tier, keyed by user id
(or IP when anonymous).

## What FYK deliberately does not do

* No end-to-end encryption. Messages are stored so reports can be actioned.
* No realtime sockets. Chat and the badge poll while the tab is visible; the UI
  says so instead of implying a live connection.
* No AI matching, no ranking model, no "compatible" percentages. Nearby is
  distance + recency, and the only similarity shown is shared tags.
* No wallet, no premium tier, no payments, no coins, no boosts. There is no
  `premium_entitlements` table any more, because nothing could honour it.
* No push notifications or email digests (no VAPID key, no mailer in this deploy).
* No precise location. Coordinates are snapped to a ~250 m grid on the way in and
  distances shown to a viewer are jittered per viewer/target pair.

Each of those is a product decision, not a gap to paper over in copy.

## Layout

```
src/
  components/      EntryShell (auth gate), AppShell (nav), ReportDialog, ui/
  routes/          __root, /, /grid, /board, /chat, /events, /profile, /safety,
                   /settings, /notifications, /admin, /auth/callback, /api/$
  server/          router.ts (dispatch), context.ts, errors.ts, rate-limit.ts,
                   supabase-server.ts, handlers/*, data/profiles.ts
  lib/             client.ts (transport), api-types.ts, geo.ts, toast.ts, utils.ts
supabase/migrations/  0001…0007 — see its README before adding one
```

## Known limits of this build (checked against, not guessed)

* **SQL is unexecuted.** No Postgres instance is available in this environment, so
  the migrations are reviewed by hand and are not verified by running them.
* **No authenticated end-to-end pass.** Without a Supabase project, sign-in, upload
  and the moderation queue have not been exercised against live data; they are
  type-checked, unit-tested and build clean.
* Account deletion has no self-service path — Settings and Safety say so plainly
  rather than showing a button that would do nothing.
