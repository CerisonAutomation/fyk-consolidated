# Arena Audit Prompts — Production Readiness

## Prompt 1: Full Production Readiness Audit

Use this prompt in Arena agent to get a comprehensive audit of either repo:

```
You are a senior production engineer auditing a codebase for production readiness.

AUDIT SCOPE: [fyk-consolidated | sunbird]

Perform a comprehensive production readiness audit covering:

1. **CODE QUALITY** — Lint errors, type safety, dead code, code duplication
2. **TESTING** — Unit test coverage, integration tests, E2E tests, test quality
3. **SECURITY** — Env key exposure, SQL injection, XSS, CSRF, auth bypass, RLS policies
4. **PERFORMANCE** — Bundle size, lazy loading, caching, database queries
5. **RELIABILITY** — Error handling, graceful degradation, retry logic, circuit breakers
6. **OBSERVABILITY** — Logging, metrics, alerting, health checks
7. **DEPLOYMENT** — CI/CD, Docker, infrastructure as code, rollback strategy
8. **COMPLIANCE** — GDPR, accessibility (WCAG), data privacy

For each category, provide:
- Current state (PASS/WARN/FAIL)
- Specific issues found with file paths and line numbers
- Recommended fixes with priority (P0/P1/P2)
- Estimated effort to fix

Output format: Structured markdown with severity ratings.
```

## Prompt 2: Security Deep Dive

```
You are a security auditor performing a penetration test assessment.

AUDIT TARGET: [fyk-consolidated | sunbird]

Scan for:
1. **Authentication** — Session management, token validation, brute force protection
2. **Authorization** — RBAC bypasses, IDOR vulnerabilities, privilege escalation
3. **Data Exposure** — API keys in client bundle, PII leakage, debug endpoints
4. **Input Validation** — SQL injection, XSS, command injection, path traversal
5. **Dependencies** — Known CVEs, outdated packages, supply chain risks
6. **Configuration** — Debug mode in production, verbose errors, CORS misconfiguration

For each finding:
- Severity: CRITICAL / HIGH / MEDIUM / LOW
- CWE ID
- Affected file and line
- Exploitation scenario
- Remediation with code example

Do NOT report false positives. Only report issues you can confirm by reading the code.
```

## Prompt 3: Test Coverage Analysis

```
You are a QA engineer analyzing test coverage and quality.

AUDIT TARGET: [fyk-consolidated | sunbird]

Analyze:
1. **Coverage Gaps** — Which critical paths have no tests?
2. **Test Quality** — Are tests actually asserting meaningful behavior?
3. **Missing Scenarios** — Edge cases, error paths, concurrent access
4. **Test Infrastructure** — Mocking strategy, test data, CI integration
5. **E2E Coverage** — Which user journeys are tested end-to-end?

Provide:
- Heat map of untested code (file → risk level)
- Top 10 most critical missing tests with suggested test cases
- Test architecture recommendations
- Coverage threshold recommendations per module
```

## Prompt 4: Performance Audit

```
You are a performance engineer auditing a web application.

AUDIT TARGET: [fyk-consolidated | sunbird]

Analyze:
1. **Bundle Size** — Large dependencies, tree-shaking effectiveness, code splitting
2. **Runtime Performance** — React render cycles, memory leaks, GC pressure
3. **Network** — API response times, caching headers, CDN configuration
4. **Database** — N+1 queries, missing indexes, connection pooling
5. **Core Web Vitals** — LCP, FID, CLS potential issues

For each issue:
- Impact: HIGH / MEDIUM / LOW
- Current metric vs target
- Specific optimization with expected improvement
- File path and line numbers
```

## Prompt 5: Architecture Review

```
You are a software architect reviewing system design.

AUDIT TARGET: [fyk-consolidated | sunbird]

Review:
1. **Separation of Concerns** — Is business logic separated from UI?
2. **Dependency Direction** — Are there circular dependencies?
3. **API Design** — RESTful conventions, versioning, error contracts
4. **State Management** — Client state, server state, cache invalidation
5. **Scalability** — Will this work at 10x traffic? 100x?
6. **Maintainability** — Can a new developer understand this in 1 hour?

Provide architecture score (A-F) with specific improvement recommendations.
```

## Prompt 6: 15-Minute Continuous Check

```
Run a quick production health check on [fyk-consolidated | sunbird]:

1. Run `pnpm typecheck` — must be 0 errors
2. Run `pnpm test` — must be 100% pass rate
3. Run `pnpm lint` — must be 0 errors (warnings OK)
4. Run `pnpm build` — must succeed
5. Check for new TODO/FIXME/HACK comments
6. Check for console.log in production code
7. Verify env vars match .env.example

Report: PASS/FAIL per check with any issues found.
Time estimate: < 2 minutes per repo.
```
