# Arena.ai Prompt #2: Security Audit

Paste this into arena.ai agent for independent security assessment.

---

## System Under Review

Security audit for "FYK" — a TanStack Start dating platform at https://github.com/CerisonAutomation/fyk-consolidated handles sensitive user data (profiles, messages, locations, payments).

### Security Controls Already In Place
- Better Auth with secure cookies (httpOnly, secure, sameSite)
- CSRF origin validation in middleware
- Content-Type enforcement
- Request size limits
- CSP with nonce-based script loading (server.js)
- HSTS, X-Content-Type-Options, X-XSS-Protection, X-Frame-Options
- Rate limiting via @upstash/ratelimit + Redis
- Session expiry (7 days) with update age (24 hours)

### Known Gaps
- `@sentry/nextjs` installed but app runs on Vite (wrong SDK = potential data leak)
- No env validation at startup (missing keys cause silent failures)
- Security middleware `withSecurity()` must be manually applied per route
- No pre-commit hooks to catch secrets before commit
- `@faker-js/faker` in production dependencies

## Your Task

Perform an OWASP Top 10 audit. For each category, assess risk and provide fixes.

### OWASP Top 10 Checklist

#### A01: Broken Access Control
- Are all API routes authenticated? Any public endpoints that shouldn't be?
- Can users access other users' private data (messages, profiles, location)?
- Are role-based permissions enforced server-side?
- Can the /api/auth/$ catch-all be abused?

#### A02: Cryptographic Failures
- Are passwords hashed with bcrypt/argon2?
- Are API keys rotated? Any hardcoded secrets?
- Is HTTPS enforced everywhere?
- Are Supabase RLS policies properly configured?

#### A03: Injection
- Are Prisma queries parameterized (no raw SQL)?
- Is user input sanitized before database queries?
- Are Supabase edge functions protected against injection?
- Any XSS risks in user-generated content (shouts, messages, profiles)?

#### A04: Insecure Design
- Is the threat model documented?
- Are rate limits applied to sensitive endpoints (login, signup, password reset)?
- Is the AI matching system protected against manipulation?

#### A05: Security Misconfiguration
- Are default credentials changed?
- Is the Prisma database URL using SSL?
- Are Supabase keys properly scoped (anon vs service role)?
- Is the development CSP different from production?

#### A06: Vulnerable Components
- Any known CVEs in dependencies?
- Is @sentry/nextjs leaking data due to wrong SDK?
- Are Mapbox/Leaflet tokens properly restricted?

#### A07: Auth Failures
- Is brute-force protection in place?
- Are sessions invalidated on password change?
- Is there account lockout after failed attempts?
- Are OAuth flows properly validated (state parameter)?

#### A08: Data Integrity
- Are API responses signed/validated?
- Is the realtime channel properly authenticated?
- Can users modify their wallet/subscription balance?

#### A09: Logging Failures
- Are security events logged (failed logins, access denials)?
- Are logs tamper-proof?
- Is PII redacted from logs?

#### A10: SSRF
- Are outgoing URLs validated (no internal network access)?
- Can user-controlled URLs be used for server-side requests?

## Deliverable

```
## Security Audit: FYK

### Critical Vulnerabilities (fix immediately)
1. [Vulnerability] — [OWASP Category] — [CVSS Score] — [Fix]

### High Risk (fix before deploy)
1. [Vulnerability] — [OWASP Category] — [CVSS Score] — [Fix]

### Medium Risk (fix in sprint 1)
1. [Vulnerability] — [OWASP Category] — [CVSS Score] — [Fix]

### Low Risk (backlog)
1. [Vulnerability] — [OWASP Category] — [CVSS Score] — [Fix]

### Security Grade: A/B/C/D/F
### Penetration Test Recommendation: [Yes/No — scope]
```
