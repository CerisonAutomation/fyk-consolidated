#!/bin/bash
# =============================================================================
# Arena.ai Expert Prompt Generator
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/config.sh"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  GENERATING EXPERT PROMPTS FOR ARENA.AI${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"

# =============================================================================
# PROMPT 1: FYK Full-Stack Expert
# =============================================================================
cat > "$PROMPT_DIR/expert-fyk-fullstack-$TIMESTAMP.md" << 'EOF'
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
EOF

echo -e "${GREEN}✓ Generated: expert-fyk-fullstack-$TIMESTAMP.md${NC}"

# =============================================================================
# PROMPT 2: Security Expert
# =============================================================================
cat > "$PROMPT_DIR/expert-security-$TIMESTAMP.md" << 'EOF'
# FYK Security Audit Prompt

You are a senior application security engineer who has performed hundreds of production security audits. You think like an attacker.

## Mission
Perform a security audit of the FYK Consolidated platform. This handles sensitive user data (photos, messages, locations) and financial transactions.

## Attack Surface to Analyze

### 1. Authentication
- Supabase Auth configuration
- JWT token handling
- Session management
- Password policies
- OAuth flows

### 2. Authorization
- Row-level security policies
- API endpoint protection
- Role-based access control
- Resource ownership verification

### 3. Input Validation
- Form inputs (name, bio, etc.)
- File uploads (photos)
- Message content
- Search queries
- URL parameters

### 4. Data Exposure
- API response filtering
- Client-side data leakage
- Error message information disclosure
- Console.log sensitive data

### 5. Injection Attacks
- SQL injection via Prisma
- NoSQL injection
- XSS via user content
- SSRF via URLs

### 6. Real-time Security
- WebSocket authentication
- Presence data exposure
- Message interception

## OWASP Top 10 Mapping

For each finding, map to OWASP:
1. Broken Access Control
2. Cryptographic Failures
3. Injection
4. Insecure Design
5. Security Misconfiguration
6. Vulnerable Components
7. Auth Failures
8. Data Integrity Failures
9. Logging Failures
10. SSRF

## Deliverable

```
### [CRITICAL/HIGH/MEDIUM/LOW] Vulnerability Title

**OWASP:** OWASP-XX
**CWE:** CWE-XXX
**File:** `path/to/file.ts:line`
**Description:** What the vulnerability is
**Exploitation:** How an attacker could exploit it
**Impact:** What data/functionality is at risk
**Fix:** Exact remediation code
**Verification:** How to test the fix
```

Be thorough. Assume the attacker is sophisticated and motivated.
EOF

echo -e "${GREEN}✓ Generated: expert-security-$TIMESTAMP.md${NC}"

# =============================================================================
# PROMPT 3: Performance Expert
# =============================================================================
cat > "$PROMPT_DIR/expert-performance-$TIMESTAMP.md" << 'EOF'
# FYK Performance Audit Prompt

You are a performance engineer who has optimized apps serving millions of users. You think in milliseconds and bytes.

## Mission
Audit FYK Consolidated for performance issues. Users expect instant load times and smooth 60fps interactions.

## Metrics to Analyze

### 1. Bundle Size
- Main bundle size
- Vendor chunk splitting
- Tree-shaking effectiveness
- Dynamic imports usage
- Image optimization

### 2. Load Performance
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)
- Cumulative Layout Shift (CLS)

### 3. Runtime Performance
- React render cycles
- Re-render frequency
- State update efficiency
- Event handler performance
- Animation frame rate

### 4. Network Performance
- API response times
- Real-time subscription overhead
- Image loading strategy
- Caching effectiveness
- Prefetching opportunities

### 5. Database Performance
- Query execution plans
- N+1 query detection
- Index utilization
- Connection pooling
- Query optimization

## What to Look For

### React-Specific
- Unnecessary re-renders
- Missing memo/useMemo/useCallback
- Large component trees
- Context provider cascades
- Suspense boundaries

### Vite-Specific
- Code splitting opportunities
- Asset optimization
- Preload directives
- Build configuration

### Supabase-Specific
- Query select vs fetch all
- Real-time subscription scope
- Connection management
- Edge function cold starts

## Deliverable

For each finding:

```
### [CRITICAL/HIGH/MEDIUM/LOW] Performance Issue

**Metric:** What metric is affected
**Current:** Measured value
**Target:** Acceptable value
**File:** `path/to/file.ts:line`
**Cause:** Why it's slow
**Fix:** Exact optimization
**Expected Improvement:** Estimated gain
```

## Bonus Metrics
- Time to First Byte (TTFB)
- JavaScript execution time
- Memory usage over time
- Garbage collection pauses
- WebSocket latency
EOF

echo -e "${GREEN}✓ Generated: expert-performance-$TIMESTAMP.md${NC}"

# =============================================================================
# PROMPT 4: Architecture Expert
# =============================================================================
cat > "$PROMPT_DIR/expert-architecture-$TIMESTAMP.md" << 'EOF'
# FYK Architecture Review Prompt

You are a principal engineer who has architected systems at scale. You think in systems, not just code.

## Mission
Review FYK Consolidated's architecture for scalability, maintainability, and developer experience.

## Architecture Dimensions

### 1. Component Architecture
- Component hierarchy
- Reusability patterns
- Prop drilling vs context
- Compound components
- Render optimization

### 2. State Management
- Server state (TanStack Query)
- Client state (Zustand)
- Form state (React Hook Form)
- URL state (TanStack Router)
- Real-time state (Supabase)

### 3. Data Flow
- API layer design
- Caching strategy
- Optimistic updates
- Error recovery
- Loading states

### 4. Code Organization
- Feature-based structure
- Shared utilities
- Type organization
- Test colococation
- Barrel exports

### 5. Developer Experience
- Type inference
- Error messages
- Documentation
- Testing patterns
- Build speed

## Scalability Questions

1. **100 users** — What breaks first?
2. **1,000 users** — Where's the bottleneck?
3. **10,000 users** — What needs redesign?
4. **100,000 users** — What's the architecture?

## Deliverable

```
### [PATTERN/ANTIPATTERN/IMPROVEMENT] Title

**Current:** What exists
**Proposed:** What should exist
**Rationale:** Why the change
**Impact:** What improves
**Effort:** S/M/L/XL
**Risk:** What could break
```

## Key Patterns to Evaluate
- Repository pattern for data access
- Service layer for business logic
- Middleware patterns
- Error boundary strategy
- Lazy loading patterns
- Memoization strategy
EOF

echo -e "${GREEN}✓ Generated: expert-architecture-$TIMESTAMP.md${NC}"

# =============================================================================
# SUMMARY
# =============================================================================
echo -e "\n${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  ALL PROMPTS GENERATED${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "\n  ${BOLD}Files created:${NC}"
ls -1 "$PROMPT_DIR"/*.md | tail -4 | while read f; do
    echo -e "    $(basename "$f")"
done
echo -e "\n  ${BOLD}How to use:${NC}"
echo -e "    1. Open the prompt file"
echo -e "    2. Copy the content"
echo -e "    3. Paste into arena.ai agent"
echo -e "    4. Get expert analysis"
echo -e "    5. Apply fixes"
echo -e "    6. Re-run audit"
