# Content Security Policy (CSP) Headers - Implementation Guide

> Reference compiled from content-security-policy.com and W3C CSP specification.
> Source: https://content-security-policy.com/

## Overview

Content Security Policy (CSP) is an HTTP response header that helps prevent XSS (Cross-Site Scripting), clickjacking, and other code injection attacks. It declares which dynamic resources are allowed to load and from where.

---

## CSP Directives Reference

### Core Directives

| Directive | Description | Fallback |
|-----------|-------------|----------|
| `default-src` | Default policy for resource loading | Falls back to for all `*-src` directives |
| `script-src` | Valid sources for JavaScript | `default-src` |
| `style-src` | Valid sources for stylesheets | `default-src` |
| `img-src` | Valid sources for images | `default-src` |
| `connect-src` | Valid sources for AJAX, WebSocket, EventSource | `default-src` |
| `font-src` | Valid sources for fonts | `default-src` |
| `object-src` | Valid sources for plugins | `default-src` |
| `media-src` | Valid sources for audio/video | `default-src` |
| `frame-src` | Valid sources for iframes | `child-src` |
| `worker-src` | Valid sources for Workers | `child-src` |
| `manifest-src` | Valid sources for manifests | `default-src` |

### Security Directives

| Directive | Description |
|-----------|-------------|
| `base-uri` | Restricts `<base>` tag URLs |
| `form-action` | Restricts form submission URLs |
| `frame-ancestors` | Restricts who can embed the page |
| `sandbox` | Sandboxes the content |
| `upgrade-insecure-requests` | Upgrades HTTP to HTTPS |

### Reporting Directives

| Directive | Description |
|-----------|-------------|
| `report-uri` | URL to send violation reports (deprecated) |
| `report-to` | Reporting group name (CSP Level 3) |

---

## Source List Values

### Keyword Sources

| Source | Description |
|--------|-------------|
| `'self'` | Same origin as the page |
| `'unsafe-inline'` | Allows inline scripts/styles (avoid if possible) |
| `'unsafe-eval'` | Allows eval() (avoid if possible) |
| `'none'` | Blocks all sources |
| `'strict-dynamic'` | Trust scripts loaded by trusted scripts |
| `'wasm-unsafe-eval'` | Allows WebAssembly |

### URL-Based Sources

```
# Exact match
https://example.com

# Wildcard subdomain
*.example.com

# Specific port
https://example.com:8080

# Path-specific
https://example.com/path/

# Data URIs (use sparingly)
data:image/png;base64,...

# Blob URIs
blob:
```

### Nonce and Hash Sources

```
# Nonce - unique per request
'nonce-abc123'

# Hash - SHA-256 of script content
'sha256-b MyBase64EncodedHash=='

# Hash - SHA-384
'sha384- MyBase64EncodedHash=='

# Hash - SHA-512
'sha512- MyBase64EncodedHash=='
```

---

## Implementation Patterns

### Express.js / Node.js

```typescript
import helmet from 'helmet';
import crypto from 'crypto';

// Generate nonce per request
function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

// CSP middleware
function cspMiddleware(req: Request, res: Response, next: NextFunction) {
  const nonce = generateNonce();
  res.locals.cspNonce = nonce;
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  const cspDirectives = {
    defaultSrc: ["'self'"],
    
    scriptSrc: [
      "'self'",
      `'nonce-${nonce}'`,
      // Only use 'unsafe-inline' in development
      ...(!isProduction ? ["'unsafe-inline'"] : []),
    ],
    
    styleSrc: [
      "'self'",
      `'nonce-${nonce}'`,
      "'unsafe-inline'", // Often needed for CSS
    ],
    
    imgSrc: [
      "'self'",
      'data:',
      'https:',
    ],
    
    connectSrc: [
      "'self'",
      'https://api.myapp.com',
      'https://auth.myapp.com',
    ],
    
    fontSrc: [
      "'self'",
      'https://fonts.gstatic.com',
    ],
    
    objectSrc: ["'none'"],
    
    mediaSrc: ["'self'"],
    
    frameSrc: ["'none'"],
    
    baseUri: ["'self'"],
    
    formAction: ["'self'"],
    
    frameAncestors: ["'none'"],
    
    upgradeInsecureRequests: [],
  };
  
  // Build CSP header string
  const csp = Object.entries(cspDirectives)
    .map(([key, values]) => {
      // Convert camelCase to kebab-case
      const directive = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      if (values.length === 0) return directive;
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
  
  // Set CSP header
  res.setHeader('Content-Security-Policy', csp);
  
  // Set report-only header for testing
  if (!isProduction) {
    res.setHeader('Content-Security-Policy-Report-Only', csp);
  }
  
  next();
}

// Use middleware
app.use(cspMiddleware);

// In templates, pass nonce
app.get('/', (req, res) => {
  res.render('index', { cspNonce: res.locals.cspNonce });
});
```

### Next.js Implementation

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'nonce-${generateNonce()}';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      font-src 'self' https://fonts.gstatic.com;
      connect-src 'self' https://api.myapp.com;
      frame-ancestors 'none';
      base-uri 'self';
      form-action 'self';
      upgrade-insecure-requests;
    `.replace(/\s+/g, ' ').trim(),
  },
];

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};
```

### Nginx Configuration

```nginx
# Add CSP header
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'nonce-{request_id}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.myapp.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
" always;

# Or use report-only for testing
add_header Content-Security-Policy-Report-Only "
  default-src 'self';
  report-uri /csp-report;
" always;
```

### Apache Configuration

```apache
# .htaccess or httpd.conf
<IfModule mod_headers.c>
  Header set Content-Security-Policy "
    default-src 'self';
    script-src 'self' 'nonce-%{REQUEST_ID}e';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' https://api.myapp.com;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
    upgrade-insecure-requests;
  "
</IfModule>
```

---

## Common CSP Configurations

### Strict (Recommended for New Apps)

```
default-src 'none';
script-src 'self' 'nonce-abc123';
style-src 'self' 'nonce-abc123';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
frame-src 'none';
object-src 'none';
media-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

### Moderate (For Legacy Apps)

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' https:;
connect-src 'self' https:;
frame-src 'self';
object-src 'self';
media-src 'self';
base-uri 'self';
form-action 'self';
```

### Permissive (Migration Only)

```
default-src 'self' 'unsafe-inline' 'unsafe-eval' https:;
script-src 'self' 'unsafe-inline' 'unsafe-eval' https:;
style-src 'self' 'unsafe-inline' https:;
img-src 'self' data: https:;
```

---

## CSP for Single Page Applications

### React/Vue/Angular with CDN Resources

```
default-src 'self';
script-src 'self' 'nonce-abc123' https://cdn.jsdelivr.net https://unpkg.com;
style-src 'self' 'nonce-abc123' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: https: blob:;
font-src 'self' https://fonts.gstatic.com;
connect-src 'self' https://api.myapp.com wss://ws.myapp.com;
worker-src 'self' blob:;
manifest-src 'self';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

### With Google Analytics

```
default-src 'self';
script-src 'self' 'nonce-abc123' https://www.googletagmanager.com https://www.google-analytics.com;
img-src 'self' data: https://www.google-analytics.com;
connect-src 'self' https://www.google-analytics.com https://analytics.google.com;
style-src 'self' 'unsafe-inline';
font-src 'self';
frame-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
```

### With Stripe Payments

```
default-src 'self';
script-src 'self' 'nonce-abc123' https://js.stripe.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: https:;
font-src 'self' https://fonts.gstatic.com;
connect-src 'self' https://api.stripe.com https://maps.googleapis.com;
frame-src 'self' https://js.stripe.com https://hooks.stripe.com;
worker-src 'self' blob:;
base-uri 'self';
form-action 'self';
```

---

## CSP Reporting

### Setting Up Reports

```typescript
// Report endpoint
app.post('/csp-report', express.json({ type: 'application/csp-report' }), 
  (req, res) => {
    const report = req.body['csp-report'];
    
    console.error('CSP Violation:', {
      documentUri: report['document-uri'],
      violatedDirective: report['violated-directive'],
      blockedUri: report['blocked-uri'],
      sourceFile: report['source-file'],
      lineNumber: report['line-number'],
      userAgent: req.headers['user-agent'],
    });
    
    // Send to monitoring service
    monitoringService.track('csp-violation', {
      directive: report['violated-directive'],
      uri: report['blocked-uri'],
    });
    
    res.status(204).end();
  }
);

// CSP header with reporting
const csp = `
  default-src 'self';
  script-src 'self' 'nonce-${nonce}';
  report-uri /csp-report;
  report-to csp-endpoint;
`;
```

### Report-To Header (CSP Level 3)

```typescript
app.use((req, res, next) => {
  res.setHeader('Report-To', JSON.stringify({
    group: 'csp-endpoint',
    max_age: 10886400,
    endpoints: [{
      url: 'https://myapp.com/csp-report',
      priority: 1,
    }],
  }));
  
  res.setHeader('Content-Security-Policy', `
    default-src 'self';
    script-src 'self' 'nonce-${res.locals.cspNonce}';
    report-to csp-endpoint;
  `);
  
  next();
});
```

---

## Testing CSP

### Browser Testing

```javascript
// Test in browser console
// Check if CSP is active
console.log('CSP Header:', 
  document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content
);

// Try to load external script (should be blocked)
const script = document.createElement('script');
script.src = 'https://evil.com/malicious.js';
document.body.appendChild(script);

// Try inline script (should be blocked without nonce)
eval('alert("XSS")');
```

### Automated Testing

```typescript
// Playwright test
import { test, expect } from '@playwright/test';

test('CSP headers are set', async ({ page }) => {
  const response = await page.goto('/');
  const csp = response?.headers()['content-security-policy'];
  
  expect(csp).toBeTruthy();
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("script-src");
  expect(csp).toContain("frame-ancestors 'none'");
});

test('CSP blocks inline scripts', async ({ page }) => {
  // This should fail if CSP is working
  await page.goto('/');
  
  const result = await page.evaluate(() => {
    try {
      eval('return "XSS"');
      return 'VULNERABLE';
    } catch (e) {
      return 'BLOCKED';
    }
  });
  
  expect(result).toBe('BLOCKED');
});
```

### Common CSP Issues and Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Inline scripts blocked | Missing nonce/hash | Add `nonce` to script tags |
| Styles not loading | Missing `style-src` | Add `'unsafe-inline'` or nonce |
| Images not loading | Missing `img-src` | Add domain to `img-src` |
| AJAX blocked | Missing `connect-src` | Add API domain to `connect-src` |
| Fonts not loading | Missing `font-src` | Add font domain to `font-src` |
| Forms not submitting | Missing `form-action` | Add `'self'` to `form-action` |
| iframes blocked | `frame-src 'none'` | Add allowed frame sources |

---

## Migration Strategy

### Phase 1: Report-Only

```typescript
// Start with report-only to identify violations
res.setHeader('Content-Security-Policy-Report-Only', `
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  report-uri /csp-report;
`);
```

### Phase 2: Enforce with Exceptions

```typescript
// Add exceptions for known issues
res.setHeader('Content-Security-Policy', `
  default-src 'self';
  script-src 'self' 'nonce-${nonce}' https://legacy-scripts.example.com;
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://api.example.com;
  report-uri /csp-report;
`);
```

### Phase 3: Full Enforcement

```typescript
// Remove exceptions, enforce strict policy
res.setHeader('Content-Security-Policy', `
  default-src 'none';
  script-src 'self' 'nonce-${nonce}';
  style-src 'self' 'nonce-${nonce}';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
`);
```

---

## Testing Checklist

- [ ] CSP header is present on all responses
- [ ] No `'unsafe-inline'` in production (use nonces)
- [ ] No `'unsafe-eval'` in production
- [ ] `frame-ancestors 'none'` prevents clickjacking
- [ ] `object-src 'none'` blocks plugins
- [ ] `base-uri 'self'` prevents base tag injection
- [ ] `form-action 'self'` restricts form submissions
- [ ] CSP violations are being reported
- [ ] Report-only mode tested before enforcement
- [ ] All legitimate resources are loading correctly

---

## References

- CSP Level 3 Specification: https://www.w3.org/TR/CSP3/
- Content Security Policy Reference: https://content-security-policy.com/
- OWASP CSP Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- MDN CSP Documentation: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
