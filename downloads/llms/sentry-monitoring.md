# Sentry Error Monitoring Setup

> Source: https://docs.sentry.io/platforms/javascript/

## Features

| Feature | Description |
|---|---|
| **Error Monitoring** | Automatically reports errors, uncaught exceptions, unhandled rejections |
| **Tracing** | Tracks performance across frontend/backend with distributed tracing |
| **Session Replay** | Video-like reproduction of user sessions around errors |
| **User Feedback** | Collects feedback when users encounter errors |
| **Application Metrics** | Tracks custom metrics (response times, query durations) |
| **Logs** | Centralizes application logs correlated with errors |

## Installation

### Option 1: Package Manager (Recommended)

```bash
# npm
npm install @sentry/browser --save

# pnpm
pnpm add @sentry/browser

# yarn
yarn add @sentry/browser
```

### Option 2: Framework-Specific

```bash
# Next.js
npx @sentry/wizard@latest -i nextjs

# React
npm install @sentry/react

# Node.js
npm install @sentry/node
```

## Basic Configuration

```javascript
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "https://your-public-dsn@sentry.io/project-id",
  release: "my-project-name@2.3.12",

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
    Sentry.feedbackIntegration({
      colorScheme: "system",
    }),
  ],

  // Performance monitoring
  tracesSampleRate: 1.0, // Capture 100% in dev, lower in production

  // Control which URLs get traced
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],

  // Session replay
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of error sessions
});
```

## Next.js Configuration

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_APP_VERSION,

  integrations: [
    Sentry.browserTracingIntegration({
      router: Sentry.browserTracingIntegration({
        // Uses Next.js App Router automatically
      }),
    }),
    Sentry.replayIntegration(),
  ],

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  enabled: process.env.NODE_ENV !== "development",
});
```

```typescript
// sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  enabled: process.env.NODE_ENV !== "development",
});
```

## Manual Error Capture

```javascript
try {
  riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: { section: "payment" },
    extra: { orderId: "12345" },
  });
}

// Capture messages
Sentry.captureMessage("Something went wrong", "warning");

// Set user context
Sentry.setUser({
  id: "123",
  email: "user@example.com",
});

// Add breadcrumbs
Sentry.addBreadcrumb({
  category: "navigation",
  message: "Navigated to /dashboard",
  level: "info",
});
```

## Environment-Specific Settings

```javascript
// Production: sample at 20%
tracesSampleRate: 0.2,

// Staging: sample at 50%
tracesSampleRate: 0.5,

// Development: capture everything
tracesSampleRate: 1.0,
```

## Content Security Policy

```html
<script src="https://js.sentry-cdn.com/your-public-key.min.js"
        crossorigin="anonymous"></script>
```

CSP headers needed:
```
script-src 'self' https://js.sentry-cdn.com;
connect-src 'self' https://*.sentry.io;
```

## Best Practices

1. **Initialize early:** Set up Sentry before any other code
2. **Set release versions:** Track which deployment caused errors
3. **Use environment tags:** Distinguish prod vs staging errors
4. **Sample traces:** Reduce costs in high-traffic production
5. **Enable replay on errors:** Get visual context for debugging
6. **Set user context:** Help identify affected users
7. **Use breadcrumbs:** Track user actions leading to errors
8. **Configure source maps:** Upload maps for readable stack traces
9. **Set up alerts:** Notify team of new error types
10. **Review regularly:** Triage and resolve issues promptly

## Source Map Upload (Next.js)

```javascript
// next.config.js
const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig({
  // Next.js config
}, {
  silent: true,
  org: "your-org",
  project: "your-project",
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
```
