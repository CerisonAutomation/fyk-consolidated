# Localization Testing Best Practices

## Overview

Localization testing verifies that an application works correctly across different languages, regions, and cultural contexts. It goes beyond translation verification to include layout validation, format testing, cultural appropriateness, and functional correctness in all supported locales.

## Testing Dimensions

```
┌─────────────────────────────────────────────────────────────┐
│                 Localization Testing Dimensions              │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│ Linguistic  │  Visual     │  Functional │  Cultural        │
│             │             │             │                  │
│ - Translated│ - Layout    │ - Forms     │ - Date formats   │
│   text      │   integrity│   submit    │ - Number formats │
│ - Completeness│ - Text   │ - Navigation│ - Currency       │
│ - Grammar   │   overflow │   works     │ - Address format  │
│ - Spelling  │ - Alignment│ - Sorting   │ - Phone format   │
│ - Terminology│ - RTL/LTR │ - Search    │ - Image symbols  │
│             │   rendering│   works     │ - Color meanings  │
└─────────────┴─────────────┴─────────────┴──────────────────┘
```

## 1. Pseudo-Localization

### What is Pseudo-Localization?

Pseudo-localization automatically transforms source strings to simulate localization issues before real translations exist. It helps find unlocalizable strings, truncation problems, and layout issues early.

### Implementation

```ts
// pseudo-localize.ts
function pseudoLocalize(text: string): string {
  return text
    // Add brackets to identify pseudo-localized strings
    .replace(/^/, '[!!')
    .replace(/$/, '!!]')
    // Expand vowels to simulate longer translations
    .replace(/[aeiou]/gi, (match) => match + match)
    // Add accents to simulate special characters
    .replace(/[a-zA-Z]/g, (match) => {
      const charCode = match.charCodeAt(0);
      if (match === match.toUpperCase()) {
        return String.fromCharCode(charCode + 784); // Combining accent
      }
      return match;
    })
    // Double length to simulate RTL languages
    .padEnd(text.length * 2, ' ');
}

// Generate pseudo-localized messages
function generatePseudoLocale(messages: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value === 'string') {
      result[key] = pseudoLocalize(value);
    } else if (typeof value === 'object') {
      result[key] = generatePseudoLocale(value);
    }
  }
  return result;
}
```

### Using with next-intl

```ts
// i18n/request.ts
export default getRequestConfig(async ({requestLocale}) => {
  const locale = await requestLocale;

  if (locale === 'pseudo') {
    const enMessages = (await import('../../messages/en.json')).default;
    return {
      locale: 'en',
      messages: generatePseudoLocale(enMessages),
    };
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

### Pseudo-Localization Rules

| Transformation | Purpose |
|---------------|---------|
| Add accents | Test character encoding and font support |
| Expand vowels | Test text overflow and truncation |
| Add brackets | Identify pseudo-localized text in UI |
| Double length | Simulate text expansion in translated languages |
| Reverse strings | Test RTL rendering |

## 2. Layout and Visual Testing

### Screenshot Comparison

```ts
// playwright.config.ts
import {defineConfig} from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'en',
      use: {locale: 'en', baseURL: 'http://localhost:3000/en'},
    },
    {
      name: 'de',
      use: {locale: 'de', baseURL: 'http://localhost:3000/de'},
    },
    {
      name: 'ar',
      use: {locale: 'ar', baseURL: 'http://localhost:3000/ar'},
    },
  ],
});
```

### Visual Regression Tests

```ts
// tests/visual/homepage.spec.ts
import {test, expect} from '@playwright/test';

const locales = ['en', 'de', 'fr', 'ar', 'ja'];

for (const locale of locales) {
  test(`homepage renders correctly in ${locale}`, async ({page}) => {
    await page.goto(`/${locale}`);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot(`homepage-${locale}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
}
```

### Text Overflow Detection

```ts
// tests/overflow/text-overflow.spec.ts
import {test, expect} from '@playwright/test';

async function checkTextOverflow(page: Page) {
  const issues: string[] = [];

  // Check all visible text elements
  const textElements = await page.$$eval(
    'h1, h2, h3, h4, h5, h6, p, span, button, a, label, td, th',
    (elements) =>
      elements
        .filter((el) => el.offsetParent !== null) // Visible only
        .map((el) => ({
          text: el.textContent?.trim() || '',
          overflow:
            el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight,
          tag: el.tagName,
          selector: el.className
            ? `${el.tagName.toLowerCase()}.${el.className.split(' ')[0]}`
            : el.tagName.toLowerCase(),
        }))
  );

  for (const el of textElements) {
    if (el.overflow && el.text.length > 0) {
      issues.push(
        `Text overflow detected in <${el.selector}>: "${el.text.substring(0, 50)}..."`
      );
    }
  }

  return issues;
}

test('no text overflow in German', async ({page}) => {
  await page.goto('/de');
  const issues = await checkTextOverflow(page);
  expect(issues).toEqual([]);
});
```

### RTL Layout Validation

```ts
// tests/rtl/rtl-layout.spec.ts
import {test, expect} from '@playwright/test';

test.describe('RTL Layout Tests', () => {
  test('Arabic layout is correctly mirrored', async ({page}) => {
    await page.goto('/ar');

    // Check html direction
    const dir = await page.$eval('html', (el) => el.getAttribute('dir'));
    expect(dir).toBe('rtl');

    // Check sidebar is on the right
    const sidebar = await page.$('.sidebar');
    const sidebarBox = await sidebar?.boundingBox();
    const viewport = page.viewportSize();

    if (sidebarBox && viewport) {
      expect(sidebarBox.x).toBeGreaterThan(viewport.width / 2);
    }

    // Check text alignment
    const headings = await page.$$('h1, h2, h3');
    for (const heading of headings) {
      const textAlign = await heading.evaluate(
        (el) => window.getComputedStyle(el).textAlign
      );
      expect(['right', 'start', 'end']).toContain(textAlign);
    }
  });
});
```

## 3. Functional Testing

### Form Localization Tests

```ts
// tests/functional/forms.spec.ts
import {test, expect} from '@playwright/test';

test.describe('Localized Forms', () => {
  test('German form submits correctly', async ({page}) => {
    await page.goto('/de/contact');

    // Fill form with German-specific data
    await page.fill('[data-testid="name"]', 'Max Mustermann');
    await page.fill('[data-testid="email"]', 'max@beispiel.de');
    await page.fill('[data-testid="phone"]', '+49 123 456789');
    await page.fill('[data-testid="message"]', 'Hallo, ich habe eine Frage.');

    await page.click('[data-testid="submit"]');

    // Verify success message in German
    await expect(page.locator('[data-testid="success"]')).toContainText(
      'Nachricht gesendet'
    );
  });

  test('Japanese form handles wide characters', async ({page}) => {
    await page.goto('/ja/contact');

    await page.fill('[data-testid="name"]', '田中太郎');
    await page.fill('[data-testid="email"]', 'tanaka@example.jp');
    await page.fill('[data-testid="message"]', 'こんにちは、お問い合わせです。');

    await page.click('[data-testid="submit"]');

    await expect(page.locator('[data-testid="success"]')).toContainText(
      '送信完了'
    );
  });
});
```

### Date/Number Format Tests

```ts
// tests/functional/formats.spec.ts
import {test, expect} from '@playwright/test';

test.describe('Locale Formatting', () => {
  test('dates display correctly per locale', async ({page}) => {
    // US format
    await page.goto('/en');
    const usDate = await page.textContent('[data-testid="current-date"]');
    expect(usDate).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // MM/DD/YYYY

    // German format
    await page.goto('/de');
    const deDate = await page.textContent('[data-testid="current-date"]');
    expect(deDate).toMatch(/\d{1,2}\.\d{1,2}\.\d{4}/); // DD.MM.YYYY

    // Japanese format
    await page.goto('/ja');
    const jaDate = await page.textContent('[data-testid="current-date"]');
    expect(jaDate).toMatch(/\d{4}年\d{1,2}月\d{1,2}日/); // YYYY年MM月DD日
  });

  test('numbers format correctly per locale', async ({page}) => {
    await page.goto('/en');
    const usNumber = await page.textContent('[data-testid="price"]');
    expect(usNumber).toMatch(/\$1,234\.56/);

    await page.goto('/de');
    const deNumber = await page.textContent('[data-testid="price"]');
    expect(deNumber).toMatch(/1\.234,56\s*€/);
  });
});
```

### Search and Sorting Tests

```ts
// tests/functional/search.spec.ts
import {test, expect} from '@playwright/test';

test('search works in German', async ({page}) => {
  await page.goto('/de/search');

  // Search with German characters
  await page.fill('[data-testid="search-input"]', 'Über uns');
  await page.click('[data-testid="search-button"]');

  // Verify results contain the term
  const results = await page.$$('[data-testid="search-result"]');
  expect(results.length).toBeGreaterThan(0);

  for (const result of results) {
    const text = await result.textContent();
    expect(text?.toLowerCase()).toContain('über');
  }
});

test('sorting respects locale', async ({page}) => {
  await page.goto('/de/products');

  // German sorting: ä comes after z
  await page.click('[data-testid="sort-name"]');
  const names = await page.$$eval(
    '[data-testid="product-name"]',
    (els) => els.map((el) => el.textContent)
  );

  // Verify German alphabetical order
  expect(names).toEqual([...names].sort((a, b) =>
    a!.localeCompare(b!, 'de')
  ));
});
```

## 4. Translation Completeness Testing

### Missing Translation Detection

```ts
// tests/i18n/completeness.spec.ts
import en from '../../messages/en.json';
import de from '../../messages/de.json';
import fr from '../../messages/fr.json';

function flattenKeys(obj: Record<string, any>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      return flattenKeys(value, fullKey);
    }
    return [fullKey];
  });
}

const enKeys = flattenKeys(en);
const deKeys = flattenKeys(de);
const frKeys = flattenKeys(fr);

test('German has all English keys', () => {
  const missing = enKeys.filter((key) => !deKeys.includes(key));
  expect(missing).toEqual([]);
});

test('French has all English keys', () => {
  const missing = enKeys.filter((key) => !frKeys.includes(key));
  expect(missing).toEqual([]);
});

test('no extra keys in German', () => {
  const extra = deKeys.filter((key) => !enKeys.includes(key));
  expect(extra).toEqual([]);
});
```

### Untranslated String Detection

```ts
// tests/i18n/untranslated.spec.ts
import {test, expect} from '@playwright/test';
import en from '../../messages/en.json';

function findUntranslated(
  source: Record<string, any>,
  target: Record<string, any>,
  prefix = ''
): string[] {
  const issues: string[] = [];

  for (const [key, value] of Object.entries(source)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      if (target[key] === value) {
        issues.push(fullKey);
      }
    } else if (typeof value === 'object' && target[key]) {
      issues.push(...findUntranslated(value, target[key], fullKey));
    }
  }

  return issues;
}

test('German translations are not identical to English', async () => {
  const de = await import('../../messages/de.json').then((m) => m.default);
  const untranslated = findUntranslated(en, de);

  // Allow some keys to be identical (brand names, etc.)
  const allowed = ['brand.name', 'common.ok'];
  const realIssues = untranslated.filter((key) => !allowed.includes(key));

  expect(realIssues).toEqual([]);
});
```

## 5. ICU Message Format Testing

```ts
// tests/i18n/icu-format.spec.ts
import {test, expect} from '@playwright/test';

test('pluralization works correctly', async ({page}) => {
  await page.goto('/en/items?count=0');
  await expect(page.locator('[data-testid="item-count"]')).toHaveText(
    'No items'
  );

  await page.goto('/en/items?count=1');
  await expect(page.locator('[data-testid="item-count"]')).toHaveText(
    '1 item'
  );

  await page.goto('/en/items?count=5');
  await expect(page.locator('[data-testid="item-count"]')).toHaveText(
    '5 items'
  );
});

test('German pluralization works', async ({page}) => {
  await page.goto('/de/items?count=0');
  await expect(page.locator('[data-testid="item-count"]')).toHaveText(
    'Keine Artikel'
  );

  await page.goto('/de/items?count=1');
  await expect(page.locator('[data-testid="item-count"]')).toHaveText(
    '1 Artikel'
  );

  await page.goto('/de/items?count=5');
  await expect(page.locator('[data-testid="item-count"]')).toHaveText(
    '5 Artikel'
  );
});
```

## 6. Performance Testing

### Locale Bundle Size

```ts
// tests/performance/bundle-size.spec.ts
import {test, expect} from '@playwright/test';

test('locale bundles are optimized', async ({page}) => {
  const response = await page.goto('/en');
  const size = (await response?.body())?.length || 0;

  // Enforce max bundle size per locale
  expect(size).toBeLessThan(500_000); // 500KB
});
```

### Translation Loading Performance

```ts
// tests/performance/loading.spec.ts
import {test, expect} from '@playwright/test';

test('locale switching is fast', async ({page}) => {
  await page.goto('/en');

  const start = Date.now();
  await page.click('[data-testid="locale-switcher-de"]');
  await page.waitForSelector('[data-testid="locale-loaded"]');
  const duration = Date.now() - start;

  // Locale switch should complete within 2 seconds
  expect(duration).toBeLessThan(2000);
});
```

## 7. Accessibility Testing for i18n

```ts
// tests/a18n/accessibility.spec.ts
import {test, expect} from '@playwright/test';

test('ARIA labels are translated', async ({page}) => {
  await page.goto('/de');

  // Check aria-labels
  const buttons = await page.$$('[aria-label]');
  for (const button of buttons) {
    const label = await button.getAttribute('aria-label');
    // Should not contain English text
    expect(label).not.toMatch(/^(Submit|Cancel|Close|Open)/);
  }
});

test('screen reader works in Arabic', async ({page}) => {
  await page.goto('/ar');

  // Check lang attribute
  const lang = await page.$eval('html', (el) => el.getAttribute('lang'));
  expect(lang).toBe('ar');

  // Check dir attribute
  const dir = await page.$eval('html', (el) => el.getAttribute('dir'));
  expect(dir).toBe('rtl');
});
```

## 8. CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/i18n-tests.yml
name: Localization Tests

on:
  pull_request:
    paths:
      - 'messages/**'
      - 'src/**'

jobs:
  i18n-completeness:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Check translation completeness
        run: |
          node scripts/check-translations.js
          # Fails if any locale is missing keys

  pseudo-localization:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Generate pseudo-locale
        run: npm run i18n:pseudo
      
      - name: Build with pseudo-locale
        run: npm run build
      
      - name: Run visual tests
        run: npx playwright test --project=pseudo

  visual-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Run visual tests for all locales
        run: npx playwright test --project=visual
      
      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: visual-regression-screenshots
          path: tests/screenshots/
```

### Translation Completeness Script

```js
// scripts/check-translations.js
const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, '../messages');
const sourceLocale = 'en';
const targetLocales = ['de', 'fr', 'ar', 'ja'];

function flattenKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      return flattenKeys(value, fullKey);
    }
    return [fullKey];
  });
}

const sourceMessages = JSON.parse(
  fs.readFileSync(path.join(messagesDir, `${sourceLocale}.json`), 'utf8')
);
const sourceKeys = flattenKeys(sourceMessages);

let hasErrors = false;

for (const locale of targetLocales) {
  const localePath = path.join(messagesDir, `${locale}.json`);

  if (!fs.existsSync(localePath)) {
    console.error(`Missing locale file: ${locale}.json`);
    hasErrors = true;
    continue;
  }

  const localeMessages = JSON.parse(fs.readFileSync(localePath, 'utf8'));
  const localeKeys = flattenKeys(localeMessages);

  const missing = sourceKeys.filter((key) => !localeKeys.includes(key));
  const extra = localeKeys.filter((key) => !sourceKeys.includes(key));

  if (missing.length > 0) {
    console.error(`[${locale}] Missing keys:`, missing);
    hasErrors = true;
  }

  if (extra.length > 0) {
    console.warn(`[${locale}] Extra keys:`, extra);
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log('All locales are complete!');
```

## 9. Test Data Management

### Locale-Specific Test Data

```ts
// tests/fixtures/locale-data.ts
export const testUsers = {
  en: {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1 555 123 4567',
    address: '123 Main St, New York, NY 10001',
  },
  de: {
    name: 'Max Mustermann',
    email: 'max@beispiel.de',
    phone: '+49 123 456789',
    address: 'Musterstraße 1, 10115 Berlin',
  },
  ja: {
    name: '田中太郎',
    email: 'tanaka@example.jp',
    phone: '+81 90 1234 5678',
    address: '東京都千代田区1-1-1',
  },
  ar: {
    name: 'محمد أحمد',
    email: 'mohammed@example.sa',
    phone: '+966 50 123 4567',
    address: 'الرياض، المملكة العربية السعودية',
  },
};
```

## 10. Best Practices Summary

1. **Test early with pseudo-localization** - Find layout issues before translations exist
2. **Automate completeness checks** - CI should fail if translations are missing
3. **Visual regression testing** - Screenshot comparison catches layout drift
4. **Test RTL layouts explicitly** - Don't assume logical properties work everywhere
5. **Use locale-specific test data** - Real names, addresses, phone numbers per locale
6. **Test format strings** - Verify dates, numbers, currencies render correctly
7. **Check for text overflow** - Translated text is often 30-50% longer
8. **Validate ARIA labels** - Accessibility attributes must be translated too
9. **Performance test locale loading** - Bundle size and switch time matter
10. **Test edge cases** - Mixed directions, long translations, missing fonts
