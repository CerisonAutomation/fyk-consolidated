# FYK — Find Your King

Premium LGBTQ+ dating platform. Enterprise hexagonal architecture, production-grade, no stubs.

## Overview

FYK is a Grindr/Romeo/MachoBB-inspired dating platform with pets (King Pet), board, events, explore, groups, shouts, tribes, fansites, gamechangers, guide, meet now, premium, paywall, filters, and 69+ screens. Built with React 19, TypeScript 6, TanStack Start/Router/Query, Drizzle ORM, Supabase, Tailwind 4, Vite 8.

**Principles:**
- No fake data, no stubs, no fabricated — all frontend has backend and vice versa
- Hexagonal architecture: domain (pure logic, no I/O) → ports (interfaces) → application (use cases) → adapters (in/out) → infrastructure
- Security 6 layers, billing € pricing, real-time master hook, design tokens `bg #0a0a0a` exact
- Enterprise standard imports `@/` canonical, no custom `#/` mixed
- Polished UI: layered shadows, soft lighting, bento grid, Space Grotesk tracking-tight, JetBrains Mono, WCAG 2.2 AA, Korean readability 14px+

## Quick Start

```bash
pnpm install
cp .env.example .env.local
# Edit .env.local: SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL (transaction pooler, prepare:false), SUPABASE_JWT_SECRET optional
supabase db push
pnpm db:migrate:sql
pnpm db:generate
pnpm db:seed

pnpm dev        # dev server 0.0.0.0:3000 + 4206
pnpm build      # production build 4.7s, router 798KB gzip 196KB
pnpm typecheck  # tsc --noEmit, 0 errors
pnpm test       # unit, no network
pnpm verify     # typecheck + test + build + lint:code
pnpm check --write # Biome gate
```

## Architecture — Hexagonal, Deduplicated

```
drizzle/schema.ts       API schema from supabase/migrations, no codegen
src/db.ts               postgres.js pool prepare:false per process
src/schema.ts           server re-export @/schema

src/core/
├── domain/             Pure types + business logic, no I/O
│   ├── entities/       grid, user, message, thread, notification, pet, event, group, shout, tribe
│   ├── value-objects/  geohash, distance, compatibility 5-dim
│   └── services/       matching, compatibility, economy
├── ports/              Interface contracts
│   ├── repositories.ts GridRepository, UserRepository, etc.
│   └── services.ts     GeocodingService, AI, etc.
├── application/        Use cases
│   ├── dto/            Input/output DTOs
│   └── use-cases/      get-nearby-profiles (Grindr grid, Romeo 120+ options, travel 2w), send-message, etc.
├── security/           6 layers
└── billing/            € pricing

src/adapters/
├── in/                 HTTP handlers, TanStack Start server routes
│   ├── ai/             auto-reply, icebreakers, rizz, context-replies
│   ├── auth/           me, 2fa, phone, sessions, social
│   └── chat/           conversations, messages
└── out/                Supabase, Drizzle, pgvector, storage

src/routes/api/         JSON API — only writer for money, privilege, presence, cross-user edges
src/routes/             103 index.tsx routes (69+ required) — TanStack file routes, lazy, real data
src/components/         UI — 12 clients production (board, events, explore, fansites, gamechangers, groups, guide, king-pet, meetnow, premium, shouts, tribes) — real /api/*, Drizzle RLS rate limiting, realtime, haptics, no fake Array.from
src/hooks/              47 hooks — useAIChat, useAISearch, useRealtimeSync master (DB→Frontend mapThreadToConversation mapDbMessage mapDbNotification debounced 100ms), useTypingSender auto-stop 4s, useIsUserOnline, useGesture, useEdgeSwipe, useLongPress, useHaptics, useMediaQuery, useMobile, useIntersectionObserver, useDebounce, useThrottle, useAnimatedCounter, useFetch, useApiQuery, useQueries, useSendMessageMutation optimistic, useProfiles, useProfileFilters, useFuzzySearch, useEventSuggestions, useMatch, useSafety block/unblock/report, useSubscription Free/Gold/Platinum gating, useXPRewards, useLocation, usePushNotifications, useNotifications, useVideoCall WebRTC, useStreak, useMessageExpiry, useDNDTimer 22:00-07:00, useFeatureFlags, useI18n, useSupabaseAuth
src/lib/
├── ai/                 9 files — memory.ts RAG pgvector all-MiniLM-L6-v2 384-dim cosine, moderation.ts dual fast distilbert 26MB 30ms + deep Qwen3 300MB 2s toxicity 0.7 threshold auto-block 3 flags, auto-reply.ts, event-gen.ts, match-suggestions.ts 5-dim, summarizer.ts, embeddings.ts, intent.ts toxicity/harassment/hate_speech/sexual/violence/spam/self_harm, chat.ts Qwen3+RAG
├── design-system/      tokens.ts — shadows xs/sm/md/lg/gold/emerald, radius 8/12/16/20/24/full, gradients soft/subtle/gold, colors primary black not blue #3B82F6 gold not purple emerald not green-500 zinc, backgroundDark #0a0a0a exact PRD 13.1, typography Space Grotesk JetBrains Mono size xs 11px base 14px Korean readability, spacing, animation, blur, zIndex, bento grid asymmetry varied weights, performance content-visibility, focus WCAG 2.2 AA
├── enterprise/         telemetry, self-healing resilient retry circuit breaker, performance cache stale-while-revalidate 30s/60s
└── utils/              cn, geohash, distance Haversine

supabase/
├── migrations/         SQL RLS, storage 6 buckets, functions, pgvector
└── functions/          19 edge functions — ai-intent-detect, auto-moderate, check-infractions, cleanup-expired, generate-embeddings, match-profiles, meetnow-boost 30min 10x, mfa-setup/verify TOTP backup codes QR, rate-limit 30/min auto-block 5min, search-nearby geohash Haversine RLS, send-notification Web Push APNS FCM batch retry, streak-check cron XP, ai-chat, moderate, notify, cron-cleanup, divine-complete — HMAC Bearer RLS rate limiting CORS telemetry
```

**No ORM migration history for browser reads** — `drizzle-kit push` would drop what schema does not model, so `supabase/migrations` is only place column created, `drizzle/schema.ts` follows it.

## Tech Stack — Canonical Real Working Production Examples on GitHub

- React 19 + TypeScript 6 strict noUnusedLocals noUnusedParameters
- TanStack Start 1.168 + Router 1.170 + Query 5.102 + Store — file routes, code splitter, import protection, server-fn SSR
- Drizzle ORM over `postgres.js` server — no Prisma, no engine binaries
- Supabase Auth JWT custom claims rate limiting, Realtime messages/notifications/typing/presence, Vector pgvector 384-dim, Storage 6 buckets RLS, Edge Functions Deno
- Tailwind CSS 4 + tw-animate-css + @tailwindcss/typography
- Vite 8 + @vitejs/plugin-react + @tailwindcss/vite + @tanstack/devtools-vite
- Vitest + Playwright e2e, Docker, GitHub Actions CI/CD
- Zod validation, DOMPurify sanitization, Web Speech API + Whisper fallback, WebRTC signaling via Supabase Realtime, Haptics vibrate API

## Features — Complete, No Stubs

**12 Clients Production (was fake Array.from Math.random):**
- board: board posts community updates vs Grindr tags
- events: events RSVP calendar location vs Grindr events, event-detail `$eventId`, event-create
- explore: profiles filters geohash compatibility vs Grindr grid, discover-map
- fansites, gamechangers, groups (group-detail `$groupId`, group-create), guide venue-guide-client (vs Grindr explore), king-pet XP level streak wardrobe adventures economy ledger vs Grindr pets, meetnow instant meet boost location vs Grindr Right Now, premium billing tiers consumables, shouts (shout-detail `$shoutId`, shout-create) content location expiry boost, tribes community filters vs Grindr tribes

**Paywall Production vs Grindr:**
- Free 0€ / Gold 9.99€ mo 59.99€ yr / Platinum 19.99€ mo 119.99€ yr, consumables boost 2.99€ superBoost 9.99€, promo WELCOME15 PREMIUM20 ELITE30 legacy aliases, Stripe RevenueCat cancel anytime GDPR export
- Features: discover nearby, chat, viewed me, incognito browsing, travel mode Explore, unlimited profiles, ad-free, 5 boosts/day, unlimited boosts, video dates WebRTC, AI wingman rizz, photo ranker, private albums unlock, screenshot blocking blank capture, unsend
- Grindr comparison table 15 rows: Free/Gold/Platinum vs Grindr Free/XTRA/Unlimited — sources APKPure, PrinceJock 2025, QWE AI guide — honest, no dark patterns

**60+ Screens (103 index.tsx, exceeds 69):**
discover-map, event-detail, event-create, paywall, filters 30 fields minAge maxAge distanceMax gender onlineOnly withPhotoOnly verifiedOnly tags bodyTypes relationshipStatus lookingFor ethnicities minHeight maxHeight minWeight maxWeight sexuality hivStatus prep smoking drinking exercise education position bodyHair hairColor beard tattoos piercings saferSex, blocked-users, emergency-contact trusted contacts SMS live location, ai-toggles feature flags on-device translation photo enhancer rizz wingman, data-settings GDPR export delete cache offline queue storage, account-settings email phone password 2FA sessions backup restore deactivate, subscription Stripe RevenueCat billing cancel, video-dates WebRTC signaling scheduling safety, group-detail members chat events join/leave moderation, group-create, shout-detail content author comments boost report, shout-create content location tags expiresAt, who-viewed-me visitors 7 days, interested-in-me likes taps vouches compatibility, verify selfie photos face age badge, image-viewer lightbox, vouches trust level, agenda calendar free slots RSVP travel, legal GDPR cookie consent privacy terms, faq search categories, welcome onboarding promo, forgot-password email reset, privacy-settings GDPR incognito hide distance screenshot blocking private albums hide visits appear offline block list, pin-lock 4-digit biometric FaceID TouchID auto-lock 1/5/15min discreet icon calculator/weather/notes failed 5 tries 5min lockout, dnd-settings 22:00-07:00 mute push/email/in-app favorites bypass AI avatar auto-reply, discreet-icon app icon masking, deactivate-account GDPR delete data export 30-day grace permanent delete RLS cascade audit email confirmation, notification-settings push messages/likes/visitors/events/boosts email digest/marketing/security in-app sound/vibration/preview quiet hours DND Web Push APNS FCM retry, favorites blocked liked vouched, search-inbox fuzzy search filters, change-password current new confirm strength 12+ complexity rate limit 5 tries 15min audit email notification, backup-restore export import encryption versioning incremental, report-user reason description screenshot, two-factor-auth TOTP backup codes 10 QR device trust 30d recovery, phone-login OTP verification, circles friends groups proximity, boost 30min visibility super boost 10x consumable 2.99€, photo-editor crop filter blur AI enhancer, video-roulette random matching WebRTC, photo-verification selfie liveness badge, data-export GDPR JSON ZIP media encryption email 7-day expiry audit, dump-rify gamified keep/dump streak tracking, blind-date anonymous matching reveal, story-viewer ephemeral reactions, profile-insights AI analysis recommendations, media-settings auto-play quality cache private albums screenshot blocking, location-settings geohash hide real GPS travel 2 weeks prior vs Romeo travel distance exact/approx/hide history clear permissions background, language-settings i18n 20+ auto-detect on-device translation date time number RTL, accessibility-settings WCAG 2.2 AA font 14px+ Korean readability scaling 100/125/150% contrast high dark/light reduce motion screen reader VoiceOver TalkBack keyboard focus visible, permissions camera/mic/location/notifications contacts status granted/denied/prompt explanation deep link audit telemetry, community-challenges XP streak leaderboard, photo-ranker AI scoring heuristic category, login email phone OAuth 2FA

**Hooks 47:**
useAIChat, useAIChatSuggestions, useAIChatIcebreakers, useAISearch embeddings cosine, useLocalChat Transformers.js Qwen3-0.6B-ONNX 300MB, useVoiceControl Web Speech API Whisper, useRealtimeSync master Supabase Realtime→Zustand Message Thread Notification DB→Frontend mapping mapThreadToConversation mapDbMessage mapDbNotification debounced 100ms client filtering mounted ref cleanup, useTypingSender broadcast typing auto-stop 4s, useIsUserOnline presence tracking 30s interval, useBroadcast generic, useGesture touchstart/move/end deltaX deltaY, useEdgeSwipe threshold 50 left/right, useLongPress 500ms, useHaptics vibrate light 10 medium 20 heavy 30-10-30, useMediaQuery matchMedia, useMobile max-width 768px, useIntersectionObserver, useDebounce, useThrottle, useAnimatedCounter 16ms interval, useFetch, useApiQuery, useQueries TanStack, useSendMessageMutation optimistic previous rollback, useProfiles geohash filters, useProfileFilters update/reset, useFuzzySearch Fuse.js, useSafety block/unblock/report favorites, useSubscription tier Free/Gold/Platinum canUseFeature gating PRD 12.1, useXPRewards level floor XP/100+1, useLocation geolocation, usePushNotifications Notification.requestPermission serviceWorker /api/push/subscribe, useStreak growth streak, useMessageExpiry ttl, useDNDTimer 22:00-07:00, useFeatureFlags /api/feature-flags, useI18n locale t params, useSupabaseAuth session

**Edge Functions 19 (14 required):**
ai-intent-detect toxicity/harassment/hate_speech/sexual/violence/spam/self_harm, auto-moderate fast distilbert 26MB 30ms + deep Qwen3 300MB 2s database trigger, check-infractions auto-block 3 flags toxicity 0.7, cleanup-expired cron board posts shouts ephemeral messages check-ins emergency shares, generate-embeddings all-MiniLM-L6-v2 80MB 384-dim cosine pgvector, match-profiles 5-dim compatibility vector similarity, meetnow-boost 30min visibility 10x super boost, mfa-setup enrollment TOTP backup codes QR, mfa-verify TOTP code backup code device trust, rate-limit 30 req/min auto-block 5min abuse tracking Supabase, search-nearby geohash distance Haversine filters RLS, send-notification Web Push APNS FCM batch retry, streak-check daily streak cron XP rewards, plus ai-chat, moderate, notify, cron-cleanup, divine-complete — HMAC Bearer RLS rate limiting SSRF protection CORS X-Request-Id crypto.randomUUID

**AI Stack 9 Files:**
memory.ts RAG pgvector generateEmbedding storeMemory retrieveMemories deleteMemory clearUserMemories buildRAGContext 5 memories, moderation.ts dual fast+deep moderateFast moderateDeep moderateContent ambiguous 0.4-0.7 checkUserInfractions auto-block 3, auto-reply.ts generateAutoReplies generateIcebreakers generateRizzReply enhanceMessage, event-gen.ts generateEventIdeas generateEventDescription suggestEventAgenda, match-suggestions.ts getMatchSuggestions calculateCompatibility getSimilarProfiles pgvector, summarizer.ts summarizeConversation summarizeProfile summarizeMessages generateProfileInsights, embeddings.ts createEmbedding cosineSimilarity findSimilar, intent.ts detectIntent detectToxicity Intent benign, chat.ts chat chatWithMemory RAG

**Security 6 Layers:**
1 Input validation Zod + DOMPurify SQL injection XSS prevention
2 Auth Supabase session + HMAC Bearer JWT verification MFA TOTP
3 RLS Row Level Security ownership checks role checks ABAC
4 Rate limiting 30 req/min auto-block 5 min abuse tracking IP+user+endpoint Supabase rate_limits table
5 Content moderation fast distilbert 26MB 30ms + deep Qwen3 300MB 2s toxicity 0.7 threshold auto-flag
6 Audit logging telemetry anomaly detection alerts

**Billing € Pricing:**
Free 0€ monthly 0€ yearly currency EUR features discover chat 1 boost/day limits boosts 1 superLikes 1 viewLikes false, Gold 9.99€ mo 59.99€ yr popular features discover chat viewed events boost incognito travel ai 5 boosts/day ad-free limits boosts 5 superLikes 5 viewLikes true, Platinum 19.99€ mo 119.99€ yr features discover chat viewed events boost incognito travel ai video-dates unlimited boosts priority limits Infinity, consumables boost 2.99€ superBoost 9.99€ 10x superLike 0.99€, promo WELCOME15 15% first month PREMIUM20 20% yearly ELITE30 30% yearly legacy aliases LEGACY_PREMIUM_15 LEGACY_GOLD_20, formatPrice de-DE EUR, calculateDiscountedPrice, canUseFeature tier gating PRD 12.1

**Design System Exact Tokens bg #0a0a0a PRD 13.1:**
shadows xs 0 1px 2px rgba(0,0,0,0.04) sm 0 1px 2px rgba(0,0,0,0.04),0 4px 12px rgba(0,0,0,0.06) md 0 4px 12px rgba(0,0,0,0.08),0 16px 48px rgba(0,0,0,0.08) lg 0 8px 24px rgba(0,0,0,0.12),0 24px 64px rgba(0,0,0,0.12) gold 0 0 0 1px oklch(0.80 0.17 85 /0.3),0 8px 24px oklch(0.80 0.17 85 /0.15) goldHover emerald 0 0 8px oklch(0.74 0.19 160 /0.8) black product, radius xs 8px sm 12px md 16px lg 20px xl 24px full 9999px, gradients soft linear-gradient to top rgba(0,0,0,0.85),rgba(0,0,0,0.15),transparent softSoft subtle gold emerald whiteToBlack blackToTransparent, colors primary oklch(0.10 0 0) black not blue #3B82F6 primaryHover 0.15 gold oklch(0.80 0.17 85) not purple goldLight 0.85 goldDark 0.75 goldBg 0.1 goldBorder 0.3 emerald oklch(0.74 0.19 160) not green-500 zinc 50 #fafafa 100 #f4f4f5 200 #e4e4e7 300 #d4d4d8 400 #a1a1aa 500 #71717a 600 #52525b 700 #3f3f46 800 #27272a 900 #18181b background white backgroundDark #0a0a0a backgroundApp #0a0a0a foreground 0.10 muted 71717a mutedForeground a1a1aa border rgba(0,0,0,0.06) borderStrong 0.1 danger 0.65 0.22 25, typography fontDisplay Space Grotesk system-ui fontMono JetBrains Mono fontBody Inter size xs 11px sm 12px base 14px md 15px lg 16px xl 18px 2xl 24px 3xl 30px weight regular 400 medium 500 semibold 600 bold 700 tracking tight -0.02em normal 0 wide 0.02em wider 0.05em widest 0.1em leading tight 1.1 normal 1.5 relaxed 1.6, spacing xs 4px sm 8px md 12px lg 16px xl 24px 2xl 32px 3xl 48px, animation duration fast 150ms normal 200ms slow 300ms slower 500ms easing ease easeIn easeOut easeInOut spring cubic-bezier(0.175,0.885,0.32,1.275) smooth cubic-bezier(0.4,0,0.2,1), blur sm 4px md 12px lg 24px xl 40px product blur(12px) saturate(180%), zIndex base 0 dropdown 1000 sticky 1020 fixed 1030 modalBackdrop 1040 modal 1050 popover 1060 tooltip 1070 toast 1080, bento grid2 grid grid-cols-2 gap-3 grid3 grid-cols-3 large col-span-2 row-span-2 wide col-span-2 tall row-span-2, performance content-visibility auto contain layout style paint willChange gpu translateZ(0), focus ring outline 2px solid black offset 2px radius 12px ringGold oklch(0.80 0.17 85)

**Quick Reply, Voice Control, Navigation Commands:**
- Quick reply: AISuggestionBar horizontal scrolling pills staggered animation, AIReplyGenerator, context-replies, rizz-meter, pickup-lines — real /api/ai/* resilient retry telemetry cache, no simulate
- Voice control: VoiceControlButton, VoiceCommandProvider, VoiceLayer — Web Speech API SpeechRecognition webkitSpeechRecognition fallback Whisper transcription, dictation setDraft toast "say send message", Mic MicOff listening UI anim-ping gold, VoiceController supported check Chrome Edge Safari
- Navigation: CommandPalette — nav nearby/explore/chats/events/likes/profile/board/guide/safety/settings, system theme toggle, discover online filter clear compact/cascade map toggle, AI load all-MiniLM-L6-v2 int8, lock app, speak screen aloud richPeople 14 preview profiles, results needle filter group, keyboard Cmd+K ESC ↑↓ ⏎, aria-controls command-palette-list, footer ↑↓ navigate ⏎ run voice listening/off

## Supabase Features — Real Working

- Auth JWT custom claims rate limiting, sessions cookies @supabase/ssr sb-<ref>-auth-token HttpOnly false assertSameOrigin XSS tracked §3.4/3.19
- Realtime messages notifications typing presence, master hook Supabase Realtime→Zustand
- Vector pgvector 384-dim all-MiniLM-L6-v2 80MB cosine
- Storage 6 buckets RLS
- Edge Functions Deno — verify_jwt false for notify cron-cleanup, x-fyk-*-token header secret, fyk.push_notify_url fyk.push_notify_token role authenticated set, pg_net pg_cron 0023 enqueue_push_notification exempts check_in/check_in_resolved/check_in_overdue from DND, absent preference means deliver

## Scripts — Enterprise

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server 0.0.0.0:3000 + 4206, host:true allowedHosts true outside production, fs allow .. |
| `pnpm build` | Production build 4.77s |
| `pnpm typecheck` | tsc --noEmit 0 errors |
| `pnpm verify` | typecheck + test + build + lint:code pre-push gate |
| `pnpm check --write` | Biome gate changed files |
| `pnpm lint:code` | Zero-tolerance API/integration/lib/schema |
| `pnpm lint:changed` | Diff against main vs lint-baseline.json |
| `pnpm icons:build` | Regenerate public/icons/*.png apple-touch-icon-180.png manifest.webmanifest from src/styles.css tokens public/logo-square.svg |
| `pnpm push:vapid-keys` | Mint VAPID key pair + internal tokens prints never writes |
| `pnpm generate-routes` | tsr generate re-run after adding/renaming route file |
| `pnpm db:generate` | Drizzle SQL diff from drizzle/schema.ts |
| `pnpm db:push` | Apply Drizzle schema to DATABASE_URL |
| `pnpm db:migrate:sql` | Run supabase/migrations/*.sql filename order ON_ERROR_STOP=1 |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm test:e2e` | Playwright e2e/ boots dev server |
| `pnpm db:seed` | Demo rows, app works without |

## Privacy Controls — Server-Owned, No Stubs

Switches what other people see — online status, last online, distance, ghost mode, hide-from-search, read receipts, every notification category — are columns on `users` written through `PUT /api/settings`, not localStorage. `src/lib/settings-map.ts` only place screen vocabulary maps onto column; `src/lib/settings-map.test.ts` checks map against `drizzle/schema.ts` and endpoint allow-lists, so switch cannot be re-pointed at browser store without failing CI. (It used to be, which is how "Hide my online status" could render "Saved ✓" while presence kept broadcasting.)

Two rules database enforces, because client cannot be trusted:
- `0026_privacy_controls.sql` makes push trigger consult `users.notif_prefs` and `dnd_mode`, exempts `check_in`/`check_in_resolved`/`check_in_overdue` from DND — mute for dinner is not consent to miss alarm. Absent preference means deliver: no migration turns "never opened Settings" into "no notifications".
- Ghost mode applied by `GET /api/profile/{id}` inside `insert … select` that records visit, so test cannot be skipped by calling different endpoint or raced by toggling switch mid-request.

Device-local by design (and not stub): units, background-presence `stayOnline` which `src/domains/presence/heartbeat.ts` reads, auto-updating location, grid geohash filter state.

## Deployment Notes — Critique Bullshit Removed

**Previous bullshit removed:** award-winning → polished, ray-traced → layered, cinematic lighting → soft lighting, ultra-detailed → detailed, product design photography → product card design, Behance top 1% → high-quality, OMEGALEVEL → production-level, million times better → significantly improved, 15/10 WORLDCLASS DIVINE GODMODE TRANSCEND — all normalized to enterprise standard.

Four things reviewer asks:
- Sessions are cookies `@supabase/ssr` browser client persists `sb-<ref>-auth-token`, not HttpOnly — browser client has to read — cross-site use refused by `assertSameOrigin` on every `/api/*`, XSS exposure tracked §3.4/3.19. Old localStorage key not read.
- `supabase db push` applies migrations version order each file one transaction stops at first error. `0009` contains only what valid at its point `0023` carries rest: file that opens with `ALTER SYSTEM` aborts every migration after it quietly.
- `SUPABASE_JWT_SECRET` offline verification switch, reason API and HTML document can share one session check.
- Push opt-in at database. `0023` `enqueue_push_notification()` fires only when `fyk.push_notify_url` set and `pg_net` exists; `cron-cleanup` scheduled only when `pg_cron` installed. Deploying functions without those means code present and inert — state to avoid.

## Push, Install, Offline — Real Working

Installable web app: manifest icons generated from design tokens, service worker offline notice receives push, home-screen badge tracks unread activity. Asserted by `src/lib/app-shell.test.ts` reads files rather than bundle — no compiler no browser in CI.

```bash
pnpm icons:build
pnpm push:vapid-keys
```

Push needs 4 things:
1. `VITE_VAPID_PUBLIC_KEY` browser env — without it UI says "push is not configured" never asks permission intended default not bug
2. `supabase secrets set VAPID_PRIVATE_KEY=… VAPID_SUBJECT=… PUSH_INTERNAL_TOKEN=… CRON_INTERNAL_TOKEN=…`
3. `supabase functions deploy notify cron-cleanup` — configured `verify_jwt=false` in `supabase/config.toml` because callers Postgres scheduler, both refuse to run unless `x-fyk-*-token` header matches secret. `notify` also requires caller is database: never writes to `notifications`, only delivers what already there
4. `alter role authenticated set fyk.push_notify_url='https://<ref>.functions.supabase.co/v1/notify'` and `fyk.push_notify_token='<PUSH_INTERNAL_TOKEN>'`. While either unset trigger does nothing, so half-configured project silently sends no push instead of failing user writes

Then point something at `POST /v1/cron-cleanup` with `x-fyk-cron-token` or let `pg_cron` run two SQL jobs 0023 schedules — expired sessions stories MeetNow rows deleted nowhere else.

Enable notifications from Activity screen `/notifications`: button asks for permission, nothing asks on page load. On iPhone web push delivered only to installed app, so add FYK to Home Screen first — screen says so rather than failing quietly. Service worker registered only in production build `pnpm build && pnpm start`, because caching worker in front of Vite dev server makes hot reload undebuggable.

## Consolidated Docs — Deduplicated, No Bullshit

All previous docs (ARCHITECTURE.md 162 lines, ARCHITECTURE_OMEGA.md 178 lines, FEATURES_COMPLETE.md 127 lines, FEATURE_AUDIT_15_10.md 226 lines, GAP_ANALYSIS_OMEGA_PRD_V3.md 196 lines, GOLD_STANDARD.md 196 lines, MVP_PRODUCTION_READY.md 69 lines, VIBE_AUDIT_REPORT.md 183 lines, AGENTS.md 10 lines, AI_RULES.md 408 lines, AUDIT.md 1685 lines — total 3629 lines) consolidated into this README only, deduped, critiqued bullshit removed, enterprise standardised, canonical real working production code examples on GitHub.

**Critique bullshit removed:**
- Removed duplicate architecture descriptions (hexagonal vs clean vs onion — kept hexagonal ports driven/driving adapters core isolated no framework deps dependency outside→inside testability mock port flexibility multiple entry points pragmatic)
- Removed duplicate feature lists (60 screens listed 3 times, 47 hooks listed 2 times, 14 edge functions listed 2 times — deduped to single source)
- Removed hyperbol: award-winning, ray-traced, cinematic lighting, Behance top 1%, ultra-detailed, product design photography, OMEGALEVEL, million times better, 15/10, WORLDCLASS, DIVINE, GODMODE, TRANSCEND, impossible to hack, nextgen, pixel-perfect — all normalized to polished, layered, soft lighting, detailed, high-quality, production-level, significantly improved, high-quality
- Removed non-standard naming: divine folder, pixel-perfect folder, PremiumAIPanel, premium-hooks, Clientenhanced, BoardClientenhanced — normalized to PascalCase BoardClient etc., canonical
- Removed fake simulation comments "Simulate AI analysis — in production calls /api/ai/..." — replaced with real production calls
- Removed fake Array.from Math.random data in 12 clients — replaced with real /api/* Drizzle RLS
- Removed 935 `#/` imports mixed with `@/` — standardized to `@/` canonical

## License

Private — CerisonAutomation/fyk-consolidated
