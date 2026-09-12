# Production Readiness — Full Audit & Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Get fyk-consolidated and sunbird to production-ready state with full test coverage, security hardening, CI/CD, and continuous monitoring.

**Architecture:** Two repos audited in parallel. FYK is a TanStack/React/Prisma/Supabase dating app. Sunbird is a Vite/React/Three.js flight game. Both need lint cleanup, test expansion, security hardening, and CI/CD.

**Tech Stack:** TypeScript, Vite, React 19, TanStack Router, Prisma, Supabase, Playwright, Vitest, Biome (FYK) / ESLint (Sunbird), Docker

---

## Current State (2026-09-11 19:27 UTC)

| Metric | FYK Consolidated | Sunbird |
|--------|-----------------|---------|
| TypeScript | ✅ 0 errors | ✅ 0 errors |
| Build | ✅ Passing | ✅ Passing (chunk warning) |
| Tests | ✅ 61/61 passing (5 files) | ✅ 80/80 passing (10 files) |
| Lint | ❌ 19 errors remaining | ❌ 2 errors (any types) |
| Coverage | ❌ No coverage configured | ❌ No coverage configured |
| CI/CD | ⚠️ Partial (.github exists) | ❌ No CI |
| Docker | ✅ Dockerfile exists | ❌ No Docker |
| Security | ⚠️ Exposed env keys (local only) | ⚠️ Client-authoritative scores |
| E2E | ⚠️ Playwright config exists, 1 spec | ❌ No E2E |
| PWA | N/A | ⚠️ Broken icons/cache |

---

## Task 1: Fix All Lint Errors (Both Repos)

**Files:**
- FYK: `src/components/CallOverlay.tsx`, `src/components/auth-gate.tsx`, `src/app/global-error.tsx`, `src/app/globals.css`, + others
- Sunbird: `src/game/SocialSystem.ts`

**Status:** 🔄 Agents dispatched in parallel

- [ ] FYK: Run `biome check --write` for auto-fixes
- [ ] FYK: Manually fix remaining a11y, type, and assertion issues
- [ ] Sunbird: Replace `as any` with proper `SocialState` types
- [ ] Verify both repos lint-clean

---

## Task 2: Test Coverage Infrastructure

**Files:**
- FYK: `vitest.config.ts` (update), new `src/**/*.test.ts` files
- Sunbird: `vitest.config.ts` (update), new `src/game/__tests__/*.test.ts` files

- [ ] FYK: Install `@vitest/coverage-v8`
- [ ] FYK: Update `vitest.config.ts` with coverage thresholds (80% line, 70% branch)
- [ ] FYK: Add unit tests for `src/core/model/` (already partially covered)
- [ ] FYK: Add unit tests for `src/domains/` services
- [ ] FYK: Add integration tests for auth flow
- [ ] Sunbird: Add coverage config to vitest
- [ ] Sunbird: Add tests for `Game.ts` state machine
- [ ] Sunbird: Add tests for `SaveData.ts` persistence
- [ ] Sunbird: Add tests for `Leaderboard.ts`
- [ ] Both: Add `test:coverage` script to package.json

---

## Task 3: Security Hardening

**Files:**
- FYK: `.env.example`, `src/middleware.ts`, new `src/lib/env-validation.ts`
- Sunbird: `src/game/Economy.ts`, `src/game/Leaderboard.ts`

- [ ] FYK: Add Zod schema validation for all env vars at startup
- [ ] FYK: Verify no API keys leak to client bundle (VITE_ prefix audit)
- [ ] FYK: Add rate limiting to API routes (already have @upstash/ratelimit)
- [ ] FYK: Audit Supabase RLS policies
- [ ] Sunbird: Add tamper detection for local score submission
- [ ] Sunbird: Label all client-authoritative paths clearly in UI
- [ ] Both: Run `npm audit` and fix critical vulnerabilities

---

## Task 4: E2E Testing

**Files:**
- FYK: `e2e/app.spec.ts` (expand), new `e2e/auth.spec.ts`, `e2e/board.spec.ts`
- Sunbird: new `e2e/game.spec.ts`

- [ ] FYK: Write Playwright test for auth flow (sign-up, sign-in, sign-out)
- [ ] FYK: Write Playwright test for board browsing
- [ ] FYK: Write Playwright test for chat flow
- [ ] FYK: Write Playwright test for profile creation
- [ ] Sunbird: Write Playwright test for game launch and basic flight
- [ ] Both: Add `test:e2e` script
- [ ] Both: Add CI step for E2E tests

---

## Task 5: CI/CD Pipeline

**Files:**
- FYK: `.github/workflows/ci.yml` (update)
- Sunbird: `.github/workflows/ci.yml` (create)

- [ ] FYK: Update CI to run typecheck + lint + test + build
- [ ] FYK: Add coverage reporting step
- [ ] FYK: Add Playwright E2E step
- [ ] Sunbird: Create CI workflow with typecheck + lint + test + build
- [ ] Sunbird: Add portal build variants (poki, crazy, generic)
- [ ] Both: Add branch protection rules

---

## Task 6: Docker & Deployment

**Files:**
- FYK: `Dockerfile` (verify), `docker-compose.yml` (verify)
- Sunbird: new `Dockerfile`, new `docker-compose.yml`

- [ ] FYK: Test Docker build locally
- [ ] FYK: Add health check endpoint
- [ ] Sunbird: Create multi-stage Dockerfile (build + nginx)
- [ ] Sunbird: Add docker-compose for local dev
- [ ] Both: Add `.dockerignore`

---

## Task 7: PWA Fixes (Sunbird)

**Files:**
- Sunbird: `public/icons/`, `public/manifest.json`, `vite.config.ts`

- [ ] Generate missing PWA icons (192x192, 512x512)
- [ ] Update service worker cache version
- [ ] Verify manifest.json has all required fields
- [ ] Test offline functionality

---

## Task 8: Monitoring & Continuous Audit Loop

**Files:**
- New: `docs/audit-prompts.md` (Arena-compatible prompts)
- New: `scripts/audit-loop.sh` (automated check script)

- [ ] Write Arena audit prompts for continuous inference
- [ ] Create automated audit script running every 15 minutes
- [ ] Set up Slack/email notifications for failures
- [ ] Create dashboard showing real-time prod readiness score

---

## Execution Order

1. **Immediate (0-15 min):** Lint fixes (agents running), security audit
2. **Phase 2 (15-30 min):** Test coverage setup, more tests
3. **Phase 3 (30-45 min):** E2E tests, CI/CD pipeline
4. **Phase 4 (45-60 min):** Docker, PWA fixes, monitoring
5. **Continuous:** Audit loop every 15 minutes, Arena prompt execution
