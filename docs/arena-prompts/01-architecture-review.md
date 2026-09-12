# Arena.ai Prompt #1: Architecture Review

Paste this into arena.ai agent for independent architecture assessment.

---

## System Under Review

You are reviewing a **TanStack Start** (React meta-framework on Vite) application called "FYK" — a premium LGBTQ+ dating platform. The codebase is at https://github.com/CerisonAutomation/fyk-consolidated.

### Tech Stack
- React 19, Vite 8, TanStack Router + Start, TanStack React Query
- Prisma ORM (PostgreSQL) with 60+ models
- Supabase (realtime, storage, edge functions)
- Better Auth (authentication)
- Mapbox GL JS v3 (maps)
- Zustand (state), Zod v4 (validation)
- Tailwind CSS v4, Vitest, Playwright

### Architecture Layers
```
src/
├── routes/          # TanStack file-based routing (30+ pages)
├── domains/         # Feature domains (ai, auth, chat, economy, grid, interest, location, pet, presence, profile, settings, social)
├── core/            # Shared models, utilities, reconciling-list
├── components/      # UI components (board, chat, map, etc.)
├── lib/             # Auth config, Supabase client, API helpers
├── middleware.ts     # Security middleware (CSRF, content-type, size limits)
└── server.js        # Dev server with security headers (CSP, HSTS)
```

### API Layer
- TanStack Start server handlers (`/api/auth/$`, `/api/events/`, `/api/meetnow/`, `/api/notifications/`, `/api/push/subscribe`)
- Supabase edge functions (ai-chat, cron-cleanup, embed-profile, moderate, notify)

### Database
- Prisma schema: 60 models, 1,287 lines
- 14 Supabase migrations
- Models: users, sessions, matches, messages, stories, shouts, conversations, pets, wallets, subscriptions, events, groups, tribes, fansites, AI scores, embeddings, audit events

## Your Task

Perform a thorough architecture review. For each finding, rate severity (Critical/High/Medium/Low) and provide a specific fix.

### 1. Separation of Concerns
- Are domain boundaries clean? Any cross-domain coupling?
- Is the data layer properly abstracted from the UI?
- Are API routes thin (delegating to domain logic)?

### 2. State Management
- Is Zustand used consistently? Any prop-drilling anti-patterns?
- Are server state (React Query) and client state (Zustand) properly separated?
- Any stale closure or race condition risks?

### 3. Error Handling
- Is there a global error boundary strategy?
- Are API errors handled consistently across all routes?
- Do Supabase edge functions have proper error responses?

### 4. Security Architecture
- Is the `withSecurity()` middleware applied to ALL routes or just some?
- Are there any routes that bypass auth checks?
- Is CSRF protection comprehensive?
- Are API keys and secrets properly scoped?

### 5. Scalability
- Will the Prisma schema support 100K+ users? Any N+1 query risks?
- Are database queries optimized? Missing indexes?
- Is the Supabase realtime usage efficient?

### 6. Maintainability
- Is the codebase too large in any single file?
- Are there dead code paths or unused exports?
- Is documentation sufficient for a new developer?

## Deliverable

Provide a structured report:
```
## Architecture Review: FYK

### Critical Issues (fix before deploy)
1. [Issue] — [Impact] — [Fix]

### High Priority (fix in week 1)
1. [Issue] — [Impact] — [Fix]

### Medium Priority (fix in month 1)
1. [Issue] — [Impact] — [Fix]

### Low Priority (backlog)
1. [Issue] — [Impact] — [Fix]

### Architecture Score: X/10
### Recommendation: [Deploy now / Fix first / Major rework needed]
```
