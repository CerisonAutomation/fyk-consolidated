# next-intl Internationalization Patterns

## Overview

next-intl is an internationalization toolkit for Next.js that provides localized translations, date/number formatting, and internationalized routing. It supports both App Router and Pages Router with first-class TypeScript support.

## Installation

```bash
npm install next-intl
# or
pnpm add next-intl
```

## Core Configuration

### 1. Routing Configuration (`src/i18n/routing.ts`)

```ts
import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

export const routing = defineRouting({
  // List all supported locales
  locales: ['en', 'de', 'fr', 'ar', 'ja'],
  // Used when no locale matches
  defaultLocale: 'en',
  // Optional: locale detection settings
  localeDetection: true
});

// Generate navigation helpers (Link, redirect, usePathname, useRouter)
export const {Link, redirect, usePathname, useRouter} = createNavigation(routing);
```

### 2. Request Configuration (`src/i18n/request.ts`)

```ts
import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {routing} from './routing';

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
```

### 3. Next.js Plugin (`next.config.ts`)

```ts
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig = {};

export default withNextIntl(nextConfig);
```

### 4. TypeScript Type Registration (`global.d.ts`)

```ts
import {routing} from './src/i18n/routing';
import {formats} from './src/i18n/request';
import en from './messages/en.json';

declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof en;
    Formats: typeof formats;
    Locale: (typeof routing.locales)[number];
  }
}
```

### 5. Middleware (`src/middleware.ts`)

```ts
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - api routes
  // - _next (Next.js internals)
  // - all file extensions (e.g. favicon.ico)
  matcher: ['/', '/(de|en|fr)/:path*']
};
```

## App Directory Structure

All pages and layouts should be inside a `[locale]` dynamic segment:

```
src/
  app/
    [locale]/
      layout.tsx       # Root layout with NextIntlClientProvider
      page.tsx          # Homepage
      about/
        page.tsx        # /en/about
      dashboard/
        layout.tsx      # Nested layout
        page.tsx        # /en/dashboard
```

## Layout with Provider (`src/app/[locale]/layout.tsx`)

```tsx
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;

  // Validate incoming locale
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

## Static Rendering

### Using `generateStaticParams` (Recommended)

```tsx
// app/[locale]/layout.tsx
import {routing} from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}
```

## Usage Patterns

### Server Components

```tsx
import {useTranslations} from 'next-intl/server';

export default async function Page() {
  const t = await useTranslations('HomePage');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description', {name: 'World'})}</p>
    </div>
  );
}
```

### Client Components

```tsx
'use client';
import {useTranslations} from 'next-intl';

export default function Counter() {
  const t = useTranslations('Counter');
  return <button>{t('increment')}</button>;
}
```

### Navigation

```tsx
import {Link, usePathname, useRouter} from '@/i18n/navigation';

// Link automatically prefixes the current locale
<Link href="/about">About</Link>

// Programmatic navigation
const router = useRouter();
router.push('/dashboard');

// Get current pathname (without locale prefix)
const pathname = usePathname();
```

## Message File Organization

### Flat Keys

```json
// messages/en.json
{
  "HomePage": {
    "title": "Hello {name}",
    "description": "Welcome to our app"
  },
  "AboutPage": {
    "title": "About Us"
  }
}
```

### Namespaced Messages

```json
// messages/en.json
{
  "Navigation": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  },
  "Forms": {
    "submit": "Submit",
    "cancel": "Cancel",
    "validation": {
      "required": "This field is required",
      "email": "Please enter a valid email"
    }
  }
}
```

### Rich Text in Messages

```json
// messages/en.json
{
  "RichText": {
    "terms": "By clicking <em>Accept</em>, you agree to our <link>terms</link>."
  }
}
```

```tsx
// Usage in component
const t = useTranslations('RichText');
const content = t.rich('terms', {
  em: (chunks) => <strong>{chunks}</strong>,
  link: (chunks) => <a href="/terms">{chunks}</a>
});
```

### Pluralization (ICU Syntax)

```json
// messages/en.json
{
  "Items": {
    "count": "{count, plural, =0 {No items} one {One item} other {# items}}"
  }
}
```

```tsx
const t = useTranslations('Items');
t('count', {count: 0});   // "No items"
t('count', {count: 1});   // "One item"
t('count', {count: 5});   // "5 items"
```

### Date and Number Formatting

```ts
// i18n/request.ts - define custom formats
export const formats = {
  dateTime: {
    short: {day: 'numeric', month: 'short', year: 'numeric'}
  },
  number: {
    precise: {maximumFractionDigits: 5},
    currency: {style: 'currency', currency: 'USD'}
  }
} as const;
```

```tsx
// Usage
const t = useTranslations('DateFormat');
t('postedOn', {date: new Date()});

// Or use formatting hooks directly
import {useFormatter} from 'next-intl';
const format = useFormatter();
format.dateTime(new Date(), {dateStyle: 'medium'});
format.number(123456.789, {style: 'currency', currency: 'EUR'});
```

## RTL Support Pattern

```tsx
// src/i18n/routing.ts
export const routing = defineRouting({
  locales: ['en', 'ar', 'he'],
  defaultLocale: 'en'
});

// Helper to detect RTL locales
export const rtlLocales = ['ar', 'he', 'fa', 'ur'];

// In layout.tsx
const isRtl = rtlLocales.includes(locale);
return (
  <html lang={locale} dir={isRtl ? 'rtl' : 'ltr'}>
```

## GDPR-Compliant Cookie Handling

```ts
// i18n/routing.ts
export const routing = defineRouting({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  // Locale cookie is session-only by default
  // Set maxAge only when user explicitly switches locale
  // localeCookie: {maxAge: 60 * 60 * 24 * 365} // 1 year
});
```

## Best Practices

1. **Validate locales early** - Call `notFound()` for invalid locales in the root layout
2. **Use namespaces** - Organize translations by feature/page to avoid loading all messages
3. **Type safety** - Register message types via `AppConfig` for autocomplete and type checking
4. **Static rendering** - Use `generateStaticParams` for production-ready static export
5. **Lazy loading** - Only import messages for the current locale, not all locales
6. **Format consistently** - Define custom date/number formats in the request config
7. **RTL awareness** - Set `dir` attribute on `<html>` and use CSS logical properties
