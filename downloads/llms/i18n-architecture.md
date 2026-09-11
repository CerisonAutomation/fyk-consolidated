# i18n Architecture for Web Applications

## Overview

Internationalization (i18n) architecture defines how an application structures its support for multiple languages, regions, and cultural formats. A well-designed i18n architecture separates concerns between code and content, enables parallel development and translation workflows, and scales without requiring architectural changes.

## Core Architecture Patterns

### 1. Layered Architecture

```
┌─────────────────────────────────────────┐
│           Presentation Layer            │
│   (Components, Pages, Templates)        │
├─────────────────────────────────────────┤
│           i18n Abstraction Layer         │
│   (Hooks, Functions, Formatters)        │
├─────────────────────────────────────────┤
│           Translation Layer              │
│   (Message Loading, Caching, Fallback)  │
├─────────────────────────────────────────┤
│           Content Layer                  │
│   (JSON/YAML Files, TMS, CDN)          │
└─────────────────────────────────────────┘
```

### 2. Separation of Concerns

- **Code** contains message keys, never hardcoded strings
- **Content** contains translated text, organized by namespace
- **Formatting** handles locale-specific dates, numbers, currencies
- **Routing** handles locale detection and URL management

### 3. Key-Based vs Path-Based Translation Organization

#### Key-Based (Recommended for Most Apps)

```
messages/
  en/
    common.json       # Shared: buttons, labels, errors
    auth.json         # Authentication feature
    dashboard.json    # Dashboard feature
    settings.json     # Settings feature
  de/
    common.json
    auth.json
    dashboard.json
    settings.json
```

**Pros:** Simple, works with any framework, easy to reason about
**Cons:** Manual namespace management

#### Path-Based (For Large-Scale Apps)

```
messages/
  en/
    components/
      Button.json
      Modal.json
      Form.json
    pages/
      Home.json
      About.json
    features/
      auth/
        Login.json
        Register.json
      dashboard/
        Overview.json
        Settings.json
```

**Pros:** Mirrors code structure, automatic organization
**Cons:** Can create deep nesting, harder to grep

#### Hybrid Approach

```json
// messages/en.json - top-level namespaces map to features
{
  "common": { ... },
  "auth": { ... },
  "dashboard": {
    "overview": { ... },
    "settings": { ... }
  }
}
```

## Message Structure Patterns

### Flat Keys

```json
{
  "greeting": "Hello",
  "farewell": "Goodbye",
  "submit_button": "Submit"
}
```

### Nested Keys

```json
{
  "forms": {
    "login": {
      "title": "Login",
      "email": "Email Address",
      "password": "Password",
      "submit": "Sign In"
    },
    "register": {
      "title": "Register",
      "submit": "Create Account"
    }
  }
}
```

### Array-Based Messages (for Lists)

```json
{
  "features": [
    "Fast performance",
    "Easy to use",
    "Great support"
  ]
}
```

### ICU Message Format

```json
{
  "items_count": "{count, plural, =0 {No items} one {1 item} other {# items}}",
  "greeting": "Hello {name}!",
  "price": "{amount, number, ::currency/USD}",
  "posted": "Posted {date, date, long}"
}
```

## File Structure Patterns

### Feature-Based Organization

```
src/
  i18n/
    config.ts          # i18n configuration
    routing.ts         # Locale routing
    request.ts         # Server request config
    navigation.ts      # Navigation helpers
    messages/
      en/
        common.json
        auth.json
        dashboard.json
      de/
        common.json
        auth.json
        dashboard.json
  app/
    [locale]/
      layout.tsx
      page.tsx
  components/
    Button/
      Button.tsx       # Uses useTranslations('common')
    LoginForm/
      LoginForm.tsx    # Uses useTranslations('auth')
```

### Monorepo Structure

```
packages/
  shared-i18n/
    src/
      config.ts
      messages/
        en/
        de/
    package.json
  web-app/
    src/
      app/
      components/
    package.json       # depends on shared-i18n
  admin-app/
    src/
      app/
      components/
    package.json       # depends on shared-i18n
```

## Translation Loading Strategies

### 1. Static Loading (Build Time)

```ts
// All messages bundled at build time
const messages = {
  en: await import('./messages/en.json'),
  de: await import('./messages/de.json'),
};
```

**Best for:** Small apps with few locales

### 2. Dynamic Loading (Runtime)

```ts
// Load messages on demand per locale
async function loadMessages(locale: string) {
  return (await import(`./messages/${locale}.json`)).default;
}
```

**Best for:** Large apps with many locales

### 3. Namespace-Based Loading

```ts
// Load only needed namespaces per page
async function loadNamespace(locale: string, namespace: string) {
  return (await import(`./messages/${locale}/${namespace}.json`)).default;
}
```

**Best for:** Large apps where each page uses different translations

### 4. CDN/Remote Loading

```ts
// Fetch from CDN or API
async function loadMessages(locale: string) {
  const response = await fetch(`https://cdn.example.com/i18n/${locale}.json`);
  return response.json();
}
```

**Best for:** Apps with frequent translation updates

## Fallback Strategy

### Locale Fallback Chain

```ts
const fallbacks = {
  'en-GB': ['en-GB', 'en-US', 'en'],
  'en-US': ['en-US', 'en'],
  'de-AT': ['de-AT', 'de'],
  'de': ['de', 'en'],
  'fr-CA': ['fr-CA', 'fr'],
  'fr': ['fr', 'en']
};

function resolveLocale(locale: string): string[] {
  return fallbacks[locale] || [locale, 'en'];
}
```

### Key Fallback

```ts
// When a key is missing in the current locale,
// fall back to the default locale
const t = useTranslations('Namespace', {
  fallbackLocale: 'en'
});
```

## Framework Integration Patterns

### React (next-intl, react-i18next, formatjs)

```tsx
// Provider pattern
<NextIntlClientProvider messages={messages}>
  <App />
</NextIntlClientProvider>

// Hook pattern
const t = useTranslations('Namespace');

// Server pattern (Next.js)
const t = await getTranslations('Namespace');
```

### Vue (vue-i18n)

```ts
// Plugin setup
app.use(i18n);

// Composition API
const {t} = useI18n();

// Template
$t('key')
```

### Angular (@angular/localize)

```ts
// Service pattern
constructor(private translate: TranslateService) {}

// Template
{{ 'KEY' | translate }}
```

## Architecture Decision Records

### Decision: Flat vs Nested Messages

- **Flat:** Simpler tooling, easier to find keys, no path conflicts
- **Nested:** Better organization, natural grouping, but tooling complexity

**Recommendation:** Start flat, migrate to nested when you exceed ~500 keys per file.

### Decision: Per-Page vs Shared Namespaces

- **Per-Page:** Only load translations needed for current page
- **Shared:** Simpler setup, but loads unused translations

**Recommendation:** Use shared namespaces for small apps; per-page loading for apps with 50+ routes.

### Decision: Static vs Dynamic Loading

- **Static:** Better performance, smaller bundles, no runtime overhead
- **Dynamic:** Better scalability, lazy loading, supports many locales

**Recommendation:** Static for <=5 locales; dynamic for >5 locales or >1MB total messages.

## Performance Patterns

### Code Splitting by Locale

```ts
// Only load the current locale's messages
const messages = await import(`./messages/${locale}.json`);
```

### Preloading

```tsx
// Preload adjacent locales for faster switching
<link rel="preload" href="/messages/de.json" as="fetch" />
```

### Caching

```ts
// Cache messages in memory after first load
const messageCache = new Map<string, Messages>();

async function getMessages(locale: string): Promise<Messages> {
  if (messageCache.has(locale)) {
    return messageCache.get(locale)!;
  }
  const messages = await loadMessages(locale);
  messageCache.set(locale, messages);
  return messages;
}
```

### Bundle Size Optimization

- Use tree-shaking friendly message formats
- Split messages by feature/namespace
- Consider compressing message files
- Use dynamic imports for secondary locales

## Type Safety Patterns

### TypeScript Message Types

```ts
// Auto-generate types from JSON files
// messages/en.json -> types/messages.d.ts

type Messages = {
  common: {
    greeting: string;
    farewell: string;
  };
  auth: {
    login: {
      title: string;
      email: string;
      password: string;
    };
  };
};

// Use in components with type-safe keys
const t = useTranslations<Messages>('common');
t('greeting'); // Type-safe
t('nonexistent'); // TypeScript error
```

### Generated Types

```json
// package.json scripts
{
  "scripts": {
    "i18n:types": "node scripts/generate-i18n-types.js"
  }
}
```

## Error Handling Patterns

### Missing Translation Handling

```ts
// Development: throw error
// Production: fallback to key or default locale
const missingHandler = (key: string, locale: string) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`Missing translation: ${key} [${locale}]`);
  }
  return key; // or fallback to default locale
};
```

### Invalid Locale Handling

```ts
// In layout or middleware
if (!routing.locales.includes(locale)) {
  notFound(); // 404 for invalid locales
}
```

## Testing Patterns

### Unit Testing Translations

```ts
import messages from './messages/en.json';

describe('translations', () => {
  it('should have all required keys', () => {
    const requiredKeys = ['common.greeting', 'auth.login.title'];
    requiredKeys.forEach(key => {
      expect(getNestedValue(messages, key)).toBeDefined();
    });
  });

  it('should not have empty values', () => {
    Object.values(messages).forEach(value => {
      expect(value).not.toBe('');
    });
  });
});
```

### Snapshot Testing

```ts
it('should render translated text', () => {
  const {getByText} = render(<Component />, {locale: 'de'});
  expect(getByText('Anmelden')).toBeTruthy();
});
```

## Best Practices Summary

1. **Separate code from content** - Never hardcode translated strings in components
2. **Use namespaces** - Organize translations by feature, not by component
3. **Implement fallbacks** - Always have a fallback chain for missing translations
4. **Type-safe keys** - Generate types from translation files for autocomplete
5. **Lazy load** - Only load translations needed for the current view
6. **Cache aggressively** - Messages don't change at runtime
7. **Validate early** - Check for missing translations in CI/CD
8. **Plan for scale** - Design your namespace strategy before you have 1000+ keys
9. **Monitor coverage** - Track translation completeness per locale
10. **Automate extraction** - Use tools to extract translatable strings from code
