# Arena.ai Prompt #3: Performance Audit

Paste this into arena.ai agent for independent performance assessment.

---

## System Under Review

Performance audit for "FYK" — a TanStack Start dating platform at https://github.com/CerisonAutomation/fyk-consolidated. This is a user-facing app where performance directly impacts engagement and conversion.

### Current Performance Setup
- Vite 8 with code splitting via TanStack Router
- React 19 with concurrent features
- Tailwind CSS v4 (utility-first, minimal bundle)
- Mapbox GL JS v3 (heavy map library)
- Dual map libs: mapbox-gl + leaflet (potential duplication)
- PostHog analytics (client-side tracking)
- Sentry error tracking (wrong SDK — @sentry/nextjs on Vite app)

### Bundle Concerns
- Three.js-level heavy dependencies (Mapbox GL is ~500KB+)
- @faker-js/faker in production deps (should be dev only)
- Both mapbox-gl and leaflet loaded (only one needed)
- @sentry/nextjs adds unnecessary Next.js boilerplate

## Your Task

Assess performance across all layers. Provide specific metrics targets and fixes.

### 1. Bundle Size Analysis
- Estimate total bundle size (JS + CSS)
- Identify largest dependencies and their impact
- Tree-shaking effectiveness
- Code splitting by route (TanStack Router auto-splitting)
- Dynamic import opportunities (maps, AI features, modals)

### 2. Runtime Performance
- First Contentful Paint (FCP) target: <1.5s
- Largest Contentful Paint (LCP) target: <2.5s
- Cumulative Layout Shift (CLS) target: <0.1
- First Input Delay (FID) target: <100ms
- Time to Interactive (TTI) target: <3.5s
- React render performance (unnecessary re-renders)

### 3. API Performance
- Prisma query optimization (N+1 detection)
- Database index coverage for common queries
- Supabase realtime connection efficiency
- API response times for critical paths (grid load, chat messages, matching)
- Rate limiting impact on performance

### 4. Caching Strategy
- React Query stale time configuration
- HTTP cache headers for API routes
- Service worker caching (if applicable)
- CDN strategy for static assets
- Map tile caching

### 5. Image & Asset Optimization
- Image formats (WebP/AVIF)
- Lazy loading for below-fold content
- Font loading strategy (Space Grotesk, Bebas Neue)
- Map tile loading strategy

### 6. Mobile Performance
- Touch event handling efficiency
- Virtual scrolling for long lists (grid, chat)
- Reduced motion support
- Battery impact (map rendering, realtime connections)

## Deliverable

```
## Performance Audit: FYK

### Critical Performance Issues (fix before deploy)
1. [Issue] — [Impact] — [Fix] — [Expected Improvement]

### High Priority Optimizations
1. [Issue] — [Impact] — [Fix] — [Expected Improvement]

### Medium Priority Optimizations
1. [Issue] — [Impact] — [Fix] — [Expected Improvement]

### Performance Budget
| Metric | Current Estimate | Target | Status |
|--------|-----------------|--------|--------|
| JS Bundle | X KB | <200KB | |
| CSS Bundle | X KB | <50KB | |
| FCP | X s | <1.5s | |
| LCP | X s | <2.5s | |
| CLS | X | <0.1 | |
| TTI | X s | <3.5s | |

### Performance Score: X/10
### Core Web Vitals Prediction: Pass/Fail
```
