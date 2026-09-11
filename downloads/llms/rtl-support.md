# RTL (Right-to-Left) Layout Support for Web Applications

## Overview

RTL (Right-to-Left) support is essential for languages like Arabic, Hebrew, Persian, and Urdu where text flows from right to left. Proper RTL implementation requires more than just setting `dir="rtl"` -- it demands a systematic approach using CSS logical properties, bidirectional-aware components, and testing across both directions.

## Languages Requiring RTL Support

| Language | Code | Script |
|----------|------|--------|
| Arabic | ar | Arabic |
| Hebrew | he | Hebrew |
| Persian/Farsi | fa | Arabic |
| Urdu | ur | Arabic |
| Pashto | ps | Arabic |
| Kurdish | ku | Arabic |
| Dhivehi | dv | Thaana |
| Syriac | syr | Syriac |

## 1. HTML Foundation

### Setting the Direction

```html
<!-- LTR (default) -->
<html lang="en" dir="ltr">

<!-- RTL -->
<html lang="ar" dir="rtl">

<!-- Dynamic direction -->
<html lang={locale} dir={isRtl ? 'rtl' : 'ltr'}>
```

### Bidirectional Text in Content

```html
<!-- Mixed content with explicit direction -->
<p dir="ltr">The term "JavaScript" was coined by Brendan Eich.</p>

<!-- Bidirectional algorithm override -->
<p>
 骉 is a Chinese character
  <bdi dir="ltr">john@example.com</bdi>
  displayed in the flow.
</p>

<!-- Isolate bidirectional text -->
<p>
  User <bdi> john_doe </bdi> said: "Hello"
</p>
```

## 2. CSS Logical Properties

### The Core Concept

Logical properties use abstract directions (`inline`/`block`) instead of physical directions (`left`/`right`/`top`/`bottom`), making layouts automatically adapt to RTL.

**Mapping:**
- `inline-start` = Right in RTL, Left in LTR
- `inline-end` = Left in RTL, Right in LTR
- `block-start` = Top (same in both)
- `block-end` = Bottom (same in both)

### Margin Properties

```css
/* Instead of margin-left / margin-right */
margin-inline-start: 1rem;    /* Right in RTL, left in LTR */
margin-inline-end: 1rem;      /* Left in RTL, right in LTR */
margin-inline: 1rem 2rem;     /* Shorthand: start end */
margin-block: 1rem 2rem;      /* top bottom (same in both) */
```

### Padding Properties

```css
/* Instead of padding-left / padding-right */
padding-inline-start: 2rem;   /* Right in RTL */
padding-inline-end: 2rem;     /* Left in RTL */
padding-inline: 1.5rem;       /* Both inline sides */
padding-block: 1rem 2rem;     /* top bottom */
```

### Border Properties

```css
/* Instead of border-left / border-right */
border-inline: 2px solid #000;         /* Both inline borders */
border-inline-start: 3px dashed red;   /* Right border in RTL */
border-inline-end: 3px dashed red;     /* Left border in RTL */
border-inline-start-color: blue;
border-inline-end-width: thin;
border-inline-start-style: dotted;
```

### Sizing Properties

```css
/* Instead of width */
inline-size: 100%;             /* Maps to width in horizontal modes */

/* Instead of height */
block-size: 50vh;              /* Maps to height in horizontal modes */
```

### Positioning (Inset) Properties

```css
/* Instead of left / right */
inset-inline-start: 0;         /* Right edge in RTL */
inset-inline-end: 2rem;        /* Left edge in RTL */
inset-inline: 0 2rem;          /* Shorthand: start end */
inset-block: 1rem;             /* top bottom */
```

### Text Alignment

```css
/* Instead of text-align: left / right */
text-align: start;             /* Right-aligned in RTL */
text-align: end;               /* Left-aligned in RTL */

/* Float */
float: inline-start;           /* Float right in RTL */
clear: inline-end;             /* Clear left in RTL */
```

## 3. Practical RTL Layout Patterns

### Card Component

```css
.card {
  /* Logical margins */
  margin-inline: auto;
  margin-block: 2rem;

  /* Logical padding */
  padding-inline: 1.5rem;
  padding-block: 1rem;

  /* Logical borders */
  border-inline-start: 4px solid #3498db;
  border-inline-end: 1px solid #ddd;

  /* Logical sizing */
  max-inline-size: 800px;
  min-block-size: 200px;
}

.card-header {
  text-align: start;
}
```

### Sidebar Layout

```css
.layout {
  display: grid;
  grid-template-columns: auto 1fr;
  /* Automatically flips in RTL */
}

.sidebar {
  inset-inline-start: 0;  /* Left in LTR, right in RTL */
  inset-block: 0;
}

.main-content {
  padding-inline: 2rem;
}
```

### Icon with Text

```css
.icon-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  /* Icon automatically moves to the correct side */
}

.icon-button .icon {
  /* In RTL, icon appears on the right automatically
     when using flexbox with logical properties */
}
```

### Navigation Menu

```css
.nav {
  display: flex;
  gap: 1rem;
  padding-inline: 2rem;
}

.nav-item {
  padding-inline: 1rem;
  border-inline-start: 3px solid transparent;
}

.nav-item.active {
  border-inline-start-color: #3498db;
  text-decoration: underline;
  text-underline-offset: 4px;
}

/* Dropdown arrows flip automatically */
.nav-item::after {
  content: '→';
  margin-inline-start: 0.5rem;
}

[dir="rtl"] .nav-item::after {
  content: '←';
}
```

### Form Layout

```css
.form-group {
  margin-block-end: 1.5rem;
}

.form-label {
  display: block;
  margin-block-end: 0.5rem;
  text-align: start;
}

.form-input {
  width: 100%;
  padding-inline: 1rem;
  padding-block: 0.5rem;
  border-inline-start: 3px solid #ddd;
  border-inline-end: 3px solid #ddd;
}

.form-error {
  color: red;
  text-align: start;
  margin-block-start: 0.25rem;
}
```

### Table Layout

```css
.table {
  border-collapse: collapse;
  inline-size: 100%;
}

.table th,
.table td {
  padding-inline: 1rem;
  padding-block: 0.75rem;
  border-inline-end: 1px solid #ddd;
  text-align: start;
}

/* Right-align numbers regardless of direction */
.table .numeric {
  text-align: end;
  font-variant-numeric: tabular-nums;
}
```

## 4. Component-Level Patterns

### React RTL-Aware Component

```tsx
import {useLocale} from 'next-intl';

function BidirectionalCard({title, children, icon: Icon}) {
  const locale = useLocale();
  const isRtl = ['ar', 'he', 'fa', 'ur'].includes(locale);

  return (
    <div
      className="card"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        // Use logical properties in style objects too
        marginInline: 'auto',
        paddingInline: '1.5rem',
      }}
    >
      <div className="card-header">
        {Icon && <Icon style={{marginInlineEnd: '0.5rem'}} />}
        <h3>{title}</h3>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}
```

### RTL-Aware Flex Layout

```tsx
function FlexRow({children, reverse = false}) {
  const locale = useLocale();
  const isRtl = ['ar', 'he', 'fa', 'ur'].includes(locale);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isRtl && reverse ? 'row-reverse' : 'row',
        gap: '1rem',
        alignItems: 'center',
      }}
    >
      {children}
    </div>
  );
}
```

## 5. Common RTL Pitfalls and Solutions

### Problem: Hardcoded Directional Values

```css
/* Bad: Hardcoded left/right */
.button {
  margin-left: 10px;
  padding-right: 20px;
  border-left: 3px solid blue;
  text-align: left;
}

/* Good: Logical properties */
.button {
  margin-inline-start: 10px;
  padding-inline-end: 20px;
  border-inline-start: 3px solid blue;
  text-align: start;
}
```

### Problem: Flipping Background Images

```css
/* Bad: Background position hardcoded */
.icon-arrow {
  background: url('arrow-right.png') no-repeat left center;
}

/* Good: Use transforms */
.icon-arrow {
  background: url('arrow-right.png') no-repeat inline-end center;
}

/* Or flip in RTL */
[dir="rtl"] .icon-arrow {
  transform: scaleX(-1);
}
```

### Problem: Transforms and Animations

```css
/* Bad: Animation assumes LTR */
@keyframes slide-in {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

/* Good: Use logical-aware approaches */
@keyframes slide-in {
  from { transform: translate(inline-start, 0); }
  to { transform: translate(0, 0); }
}

/* Or use separate animations */
[dir="rtl"] .slide-in {
  animation: slide-in-rtl 0.3s ease;
}

@keyframes slide-in-rtl {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
```

### Problem: Overflow and Text Direction

```css
/* Long text in RTL */
.truncate {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  /* Works correctly in both directions */
}

/* Scroll containers */
.scroll-container {
  overflow-x: auto;
  /* Scrollbar appears on correct side */
  scrollbar-gutter: stable;
}
```

## 6. Testing RTL Layout

### Visual Testing

```ts
// Playwright RTL screenshot test
import {test, expect} from '@playwright/test';

test.describe('RTL Layout', () => {
  test('should render correctly in Arabic', async ({page}) => {
    await page.goto('/ar');
    await expect(page).toHaveScreenshot('rtl-home.png');
  });

  test('should render correctly in Hebrew', async ({page}) => {
    await page.goto('/he');
    await expect(page).toHaveScreenshot('rtl-home-he.png');
  });
});
```

### Automated RTL Checks

```ts
// Check all text is aligned correctly
async function checkRtlAlignment(page: Page) {
  const elements = await page.$$('[dir="rtl"] *');
  for (const el of elements) {
    const textAlign = await el.evaluate(
      (el) => window.getComputedStyle(el).textAlign
    );
    // In RTL, text should be right-aligned or start-aligned
    expect(['right', 'start', 'end']).toContain(textAlign);
  }
}
```

### CSS Property Validation

```ts
// Check no hardcoded left/right values
function checkNoHardcodedDirections(css: string): string[] {
  const issues: string[] = [];
  const patterns = [
    /margin-left/g,
    /margin-right/g,
    /padding-left/g,
    /padding-right/g,
    /border-left/g,
    /border-right/g,
    /text-align:\s*(left|right)/g,
    /float:\s*(left|right)/g,
  ];

  patterns.forEach(pattern => {
    const matches = css.match(pattern);
    if (matches) {
      issues.push(`Found hardcoded directional CSS: ${matches[0]}`);
    }
  });

  return issues;
}
```

## 7. Tailwind CSS RTL Support

### Official RTL Plugin

```bash
npm install @tailwindcss/rtl
```

```js
// tailwind.config.js
plugin(require('@tailwindcss/rtl'))
```

### Usage

```html
<!-- Logical properties in Tailwind -->
<div class="ms-4 me-2 ps-4 pe-2">
  <!-- ms = margin-inline-start -->
  <!-- me = margin-inline-end -->
  <!-- ps = padding-inline-start -->
  <!-- pe = padding-inline-end -->
</div>

<!-- Border -->
<div class="border-s-4 border-e-2 border-s-blue-500">
  <!-- border-s = border-inline-start -->
  <!-- border-e = border-inline-end -->
</div>

<!-- Text align -->
<p class="text-start">Aligned to start</p>
<p class="text-end">Aligned to end</p>

<!-- Float -->
<div class="float-start">Floats to start</div>
```

## 8. Responsive RTL Patterns

### Mobile-First RTL

```css
/* Mobile: stack vertically (direction-independent) */
.layout {
  display: flex;
  flex-direction: column;
}

/* Tablet+: side by side */
@media (min-width: 768px) {
  .layout {
    flex-direction: row;
    /* Automatically correct in RTL */
  }

  .sidebar {
    inline-size: 250px;
    padding-inline-end: 1.5rem;
    border-inline-end: 1px solid #ddd;
  }
}
```

### Container Queries RTL

```css
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card {
    display: flex;
    gap: 1rem;
  }

  .card-image {
    inline-size: 200px;
    flex-shrink: 0;
  }
}
```

## 9. Icon and Image Patterns

### Flip Icons for RTL

```css
/* Directional icons that need flipping */
.icon-arrow-left,
.icon-arrow-right,
.icon-chevron-left,
.icon-chevron-right,
.icon-back,
.icon-forward {
  transform: scaleX(-1);
}

/* Icons that should NOT flip (symmetrical) */
.icon-search,
.icon-home,
.icon-settings {
  /* No flip needed */
}
```

### SVG Icons with RTL

```tsx
function ArrowIcon({direction = 'forward'}) {
  const locale = useLocale();
  const isRtl = ['ar', 'he', 'fa', 'ur'].includes(locale);

  // In RTL, forward arrows should point left
  const shouldFlip = (direction === 'forward' && isRtl) ||
                     (direction === 'backward' && !isRtl);

  return (
    <svg
      style={{
        transform: shouldFlip ? 'scaleX(-1)' : 'none',
        marginInlineEnd: '0.5rem',
      }}
      // ...
    />
  );
}
```

## 10. Best Practices Summary

1. **Use CSS logical properties** - Replace `left/right` with `inline-start/inline-end`
2. **Set `dir` on `<html>`** - Let the browser handle most RTL automatically
3. **Use flexbox/grid** - They naturally adapt to RTL direction
4. **Flip directional icons** - Use `transform: scaleX(-1)` for directional icons
5. **Don't flip symmetrical icons** - Search, home, settings icons stay the same
6. **Test in both directions** - Visual regression testing for LTR and RTL
7. **Use `bdi` for user content** - Isolate user-generated bidirectional text
8. **Avoid hardcoded positions** - Use logical properties instead of physical ones
9. **Consider number formats** - Some RTL locales use different numeral systems
10. **Validate with real content** - Test with actual Arabic/Hebrew text, not placeholders
