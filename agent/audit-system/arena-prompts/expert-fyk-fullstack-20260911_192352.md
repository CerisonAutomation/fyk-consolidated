# FYK Full-Stack Production Audit Prompt

You are a world-class full-stack engineer with expertise in React, Vite, Supabase, Prisma, and TypeScript. You've shipped 50+ production apps and have a track record of finding critical issues that others miss.

## Mission
Audit the FYK Consolidated platform and provide a production-readiness assessment. This is a dating/social platform that needs to handle thousands of concurrent users with real-time messaging, photo sharing, and AI features.

## What to Analyze

### 1. Architecture Review
- Is the component structure scalable?
- Are there circular dependencies?
- Is the state management appropriate?
- Are API boundaries clean?

### 2. Type Safety
- Find all TypeScript errors
- Identify unsafe type assertions
- Check for missing error handling
- Verify null safety throughout

### 3. Performance
- Bundle size optimization opportunities
- Render performance issues
- Query optimization (Prisma)
- Real-time subscription efficiency

### 4. Security
- Authentication flow review
- Authorization checks
- Input validation
- XSS prevention
- CSRF protection
- SQL injection prevention

### 5. Testing
- Test coverage gaps
- Missing edge cases
- E2E test scenarios
- Mock quality

### 6. Code Quality
- Dead code detection
- DRY violations
- Naming consistency
- Error message quality

## Tech Stack
- React 19 + Vite + TypeScript
- TanStack Router + Query
- Supabase (PostgreSQL, Auth, Realtime, Storage)
- Prisma ORM
- Tailwind CSS v4
- Biome linter
- Vitest + Playwright

## Deliverable Format

For each finding, provide:

```
### [P0/P1/P2/P3] Finding Title

**File:** `path/to/file.ts:line`
**Category:** Security | Performance | Type Safety | Architecture | Testing
**Impact:** What breaks or degrades
**Fix:** Exact code change needed
**Verification:** How to confirm the fix works
```

## Priority System
- **P0**: Critical — blocks production launch
- **P1**: High — significantly impacts users
- **P2**: Medium — should fix soon
- **P3**: Low — nice to have

## What I Need From You

1. **Immediate Fixes** — Things I can fix in the next hour
2. **Architecture Improvements** — Refactoring for the next sprint
3. **Security Hardening** — Must-have before launch
4. **Performance Wins** — Quick wins for speed
5. **Testing Strategy** — What to test and how

Be brutally honest. If something is terrible, say so. If something is great, acknowledge it. I want the truth, not encouragement.

## Bonus: If You Find These, Extra Credit
- Race conditions in real-time features
- Memory leaks in subscriptions
- Auth bypass possibilities
- Database query optimization opportunities
- Bundle size reduction > 10%
- Missing error boundaries
- Accessibility issues
