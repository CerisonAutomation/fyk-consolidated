# Arena.ai Prompt #5: Production Deployment Checklist

Paste this into arena.ai agent for independent deployment readiness assessment.

---

## System Under Review

Production deployment readiness for "FYK" — a TanStack Start dating platform at https://github.com/CerisonAutomation/fyk-consolidated.

### Current Deployment State
- Docker: Multi-stage build (Node 20 Alpine), non-root user, healthcheck
- docker-compose.yml: Postgres 16 + app container
- No cloud deployment config (no Vercel/Railway/Fly config)
- No environment variable injection for CI
- CI pipeline: typecheck → lint → test → build (no deploy step)

### Environment Variables Required (from .env.example)
- DATABASE_URL (Prisma/Postgres)
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- BETTER_AUTH_SECRET, BETTER_AUTH_URL
- MAPBOX_ACCESS_TOKEN
- UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
- SENTRY_DSN
- POSTHOG_KEY
- Various AI/ML keys

## Your Task

Create a comprehensive production deployment checklist. For each item, assess current state and provide the fix.

### 1. Infrastructure
- [ ] Database provisioning (Postgres with SSL, backups, point-in-time recovery)
- [ ] Redis provisioning (for rate limiting)
- [ ] Environment variable management (secrets, not in code)
- [ ] CDN configuration (static assets, images)
- [ ] DNS and SSL certificate setup
- [ ] DDoS protection

### 2. Application Configuration
- [ ] Environment validation at startup (Zod-based)
- [ ] Production CSP headers (different from dev)
- [ ] Sentry SDK migration (@sentry/nextjs → @sentry/vite-plugin)
- [ ] PostHog production key
- [ ] Mapbox token restrictions (URL-based)
- [ ] Supabase production project setup

### 3. CI/CD Pipeline
- [ ] GitHub Actions deployment workflow
- [ ] Environment-specific builds (staging, production)
- [ ] Database migration automation
- [ ] Rollback strategy
- [ ] Health check verification post-deploy
- [ ] Slack/Discord deployment notifications

### 4. Monitoring & Observability
- [ ] Health check endpoint (/api/health)
- [ ] Readiness check endpoint (/api/ready)
- [ ] Metrics endpoint (/api/metrics)
- [ ] Structured logging (JSON format)
- [ ] Error tracking (Sentry production DSN)
- [ ] Uptime monitoring (BetterStack/UptimeRobot)
- [ ] Performance monitoring (Core Web Vitals)
- [ ] Database query monitoring

### 5. Security Hardening
- [ ] Pre-commit hooks (husky + lint-staged)
- [ ] Dependency vulnerability scanning (Dependabot/Snyk)
- [ ] Secret scanning (truffleHog/gitleaks)
- [ ] Security headers verification
- [ ] Rate limiting verification
- [ ] CORS configuration
- [ ] API key rotation schedule

### 6. Operational Readiness
- [ ] Runbook documentation
- [ ] Incident response procedures
- [ ] On-call rotation (if team)
- [ ] Database backup verification
- [ ] Disaster recovery plan
- [ ] Load testing results
- [ ] Capacity planning

### 7. User-Facing Quality
- [ ] Error pages (404, 500, maintenance)
- [ ] Loading states for all async operations
- [ ] Offline support (service worker)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Cross-browser testing
- [ ] Mobile responsiveness verification

## Deliverable

```
## Production Deployment Readiness: FYK

### Ready to Deploy (checklist)
| Category | Items Ready | Items Pending | Status |
|----------|------------|---------------|--------|
| Infrastructure | X/Y | | |
| Application | X/Y | | |
| CI/CD | X/Y | | |
| Monitoring | X/Y | | |
| Security | X/Y | | |
| Operations | X/Y | | |
| Quality | X/Y | | |

### Blocking Issues (must fix before deploy)
1. [Issue] — [Category] — [Effort] — [Fix]

### Recommended Deploy Strategy
- Phase 1: [what to deploy first]
- Phase 2: [what to add next]
- Phase 3: [full production]

### Estimated Time to Production: X days/weeks
### Confidence Level: X/10
```
