# PostHog Analytics Implementation

> Source: https://posthog.com/docs/libraries/js

## Installation

### Option 1: JavaScript Snippet (Simplest)

Add to your HTML `<head>`:

```html
<script>
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return this.toString()+".people (stub)"}}),o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  posthog.init('<ph_project_token>', {
    api_host: 'https://us.i.posthog.com',
  });
</script>
```

### Option 2: NPM Package (Recommended)

```bash
# npm
npm install --save posthog-js

# pnpm
pnpm add posthog-js

# yarn
yarn add posthog-js
```

```typescript
import posthog from 'posthog-js'

posthog.init('<ph_project_token>', {
  api_host: 'https://us.i.posthog.com',
  defaults: '2026-05-30',
})
```

## Content Security Policy

```html
script-src 'self' https://*.posthog.com;
connect-src 'self' https://*.posthog.com;
worker-src 'self' blob: data:;
```

## TypeScript Support

```typescript
// posthog.d.ts
import type { PostHog } from '@posthog/types'

declare global {
  interface Window {
    posthog?: PostHog
  }
}

export {}
```

## Core API

### Identifying Users

```typescript
import posthog from 'posthog-js'

// Anonymous tracking (automatic)
posthog.capture('page_viewed')

// Identify a user
posthog.identify('user-123', {
  email: 'user@example.com',
  name: 'John Doe',
  plan: 'pro',
})

// Reset on logout
posthog.reset()
```

### Capturing Events

```typescript
// Simple event
posthog.capture('button_clicked')

// Event with properties
posthog.capture('item_purchased', {
  item_id: 'abc-123',
  price: 29.99,
  quantity: 2,
  category: 'electronics',
})

// Feature flag check
if (posthog.isFeatureEnabled('new-checkout-flow')) {
  // Show new checkout
}

// Get feature flag variant
const variant = posthog.getFeatureFlag('checkout-experiment')
```

### Pageviews

```typescript
// Auto-capture (enabled by default)
// No code needed for basic pageview tracking

// Manual pageview (for SPAs)
posthog.capture('$pageview', {
  $current_url: window.location.href,
})
```

## Session Recording

```typescript
posthog.init('<ph_project_token>', {
  api_host: 'https://us.i.posthog.com',
  session_recording: {
    maskTextSelector: '.sensitive-data', // Mask sensitive text
    maskAllInputs: true, // Mask all input fields
    blockClass: 'ph-no-capture', // Block specific elements
  },
})
```

## Feature Flags

```typescript
// Check if a flag is enabled
if (posthog.isFeatureEnabled('new-feature')) {
  showNewFeature()
}

// Get the variant of an A/B test
const variant = posthog.getFeatureFlag('my-experiment')

// Reload flags (e.g., after login)
posthog.reloadFeatureFlags()
```

## Framework Integrations

### Next.js

```typescript
// lib/posthog.ts
import posthog from 'posthog-js'

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  })
}

export default posthog
```

### React

```typescript
// PostHogProvider.tsx
'use client'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    })
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
```

## Bundle Optimization

```typescript
// For CSP-restricted environments
import posthog from 'posthog-js/dist/module.full.no-external'

// For tree-shaking (smallest bundle)
import posthog from 'posthog-js/dist/module.slim'
import { SessionReplayExtensions } from 'posthog-js/dist/extension-bundles'

posthog.init('<ph_project_token>', {
  api_host: 'https://us.i.posthog.com',
  __extensionClasses: { ...SessionReplayExtensions },
})
```

## Best Practices

1. **Update frequently:** PostHog ships fast; keep the SDK updated
2. **Use identify:** Link anonymous and authenticated sessions
3. **Set person properties:** Enrich user profiles for analysis
4. **Use feature flags:** Gradual rollouts and A/B testing
5. **Mask sensitive data:** Protect PII in session recordings
6. **Handle CSP:** Ensure `connect-src` allows PostHog
7. **Use `reset()` on logout:** Prevent cross-user data leakage
8. **Track meaningful events:** Focus on business outcomes
9. **Review replay triggers:** Configure when to record sessions
10. **Monitor bundle size:** Use slim/full imports as needed

## Event Taxonomy

```typescript
// Recommended event naming convention
posthog.capture('feature_action')        // noun_verb
posthog.capture('checkout_completed')    // flow_verb
posthog.capture('signup_started')        // flow_verb
posthog.capture('payment_failed')        // event_adjective

// Use consistent property names
posthog.capture('item_viewed', {
  item_id: '123',
  item_name: 'Product Name',
  item_category: 'electronics',
  price: 29.99,
})
```
