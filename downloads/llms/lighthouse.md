# Lighthouse Score Optimization

## Overview

Lighthouse is an open-source tool by Google that audits web pages for performance, accessibility, best practices, and SEO. It runs a series of audits and generates a report with scores (0-100) across five categories.

---

## Audit Categories

| Category | What It Measures |
|----------|-----------------|
| **Performance** | Loading speed, interactivity, visual stability (Core Web Vitals) |
| **Accessibility** | Usability for users with disabilities |
| **Best Practices** | Security, modern web standards, correctness |
| **SEO** | Search engine discoverability and friendliness |
| **Agentic Browsing** | Browser agent compatibility (newer category) |

---

## Performance Score Composition

The Lighthouse Performance score is a weighted combination of these metrics:

| Metric | Weight | What It Measures |
|--------|--------|-----------------|
| **Total Blocking Time (TBT)** | ~30% | Main thread blocking during load (INP proxy) |
| **Largest Contentful Paint (LCP)** | ~25% | Time for largest content to render |
| **Cumulative Layout Shift (CLS)** | ~25% | Visual stability of page |
| **Speed Index** | ~15% | How quickly content is visually displayed |
| **First Contentful Paint (FCP)** | ~5% | Time for first visible content |

**Score thresholds:**
- **90-100** (Green): Good performance
- **50-89** (Orange): Needs improvement
- **0-49** (Red): Poor performance

---

## Optimization Patterns by Audit

### 1. Reduce Unused JavaScript

**Audit:** "Reduce unused JavaScript"

```javascript
// BAD: Import entire library for one function
import _ from 'lodash';
const result = _.debounce(fn, 300);

// GOOD: Import only what you need
import debounce from 'lodash/debounce';
const result = debounce(fn, 300);

// BETTER: Use native APIs when possible
let timeoutId;
function debounce(fn, ms) {
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}
```

### 2. Eliminate Render-Blocking Resources

**Audit:** "Eliminate render-blocking resources"

```html
<!-- BAD: Synchronous CSS blocks rendering -->
<head>
  <link rel="stylesheet" href="/styles.css">
</head>

<!-- GOOD: Inline critical CSS, defer the rest -->
<head>
  <style>/* Critical above-the-fold CSS */</style>
  <link rel="preload" href="/non-critical.css" as="style" onload="this.rel='stylesheet'">
</head>

<!-- GOOD: Defer non-critical JS -->
<script src="/analytics.js" defer></script>
```

### 3. Properly Size Images

**Audit:** "Properly size images"

- Serve images at the size they display on screen
- Use `srcset` for responsive images
- Avoid serving 3000px wide images in a 300px container

```html
<img
  srcset="hero-400.jpg 400w, hero-800.jpg 800w, hero-1200.jpg 1200w"
  sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw"
  src="hero-800.jpg"
  alt="Hero image"
  width="1200"
  height="600"
>
```

### 4. Minimize Main-Thread Work

**Audit:** "Reduce the impact of third-party code" / "Avoid long main-thread tasks"

```javascript
// BAD: Heavy computation on main thread
function processLargeDataset(data) {
  return data.map(item => complexTransformation(item));
}

// GOOD: Use Web Workers for heavy computation
const worker = new Worker('/worker.js');
worker.postMessage({ data: largeDataset });
worker.onmessage = (e) => {
  updateUI(e.data);
};

// GOOD: Break up long tasks
async function processItems(items) {
  const CHUNK_SIZE = 50;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    processChunk(chunk);

    // Yield to main thread between chunks
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
```

### 5. Avoid Excessive DOM Size

**Audit:** "Avoids an excessive DOM size"

- Target fewer than 1,500 DOM nodes
- Maximum DOM depth of 32 nodes
- Maximum parent-child relationship of 60 nodes

```javascript
// Use virtual scrolling for large lists
class VirtualList {
  constructor(container, items, itemHeight) {
    this.container = container;
    this.items = items;
    this.itemHeight = itemHeight;
    this.visibleCount = Math.ceil(container.clientHeight / itemHeight);

    this.container.addEventListener('scroll', () => this.render());
    this.render();
  }

  render() {
    const scrollTop = this.container.scrollTop;
    const start = Math.floor(scrollTop / this.itemHeight);
    const end = Math.min(start + this.visibleCount + 5, this.items.length);

    // Only render visible items
    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const el = this.createItem(this.items[i]);
      el.style.position = 'absolute';
      el.style.top = `${i * this.itemHeight}px`;
      fragment.appendChild(el);
    }
    this.container.innerHTML = '';
    this.container.appendChild(fragment);
  }
}
```

### 6. Efficiently Encode Images

**Audit:** "Efficiently encode images"

```bash
# Use modern formats and compression

# WebP conversion (25-35% smaller than JPEG)
cwebp -q 80 input.jpg -o output.webp

# AVIF conversion (even smaller, ~50% vs JPEG)
avifenc --min 0 --max 63 -a end-usage=q -a cq-level=30 input.jpg output.avif

# Use image CDNs for automatic format negotiation
# Example: imgix, Cloudinary, or Imgproxy
```

### 7. Serve Images in Next-Gen Formats

**Audit:** "Serve images in next-gen formats"

```html
<!-- Use <picture> for format negotiation -->
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Description" width="800" height="600">
</picture>
```

### 8. Enable Text Compression

**Audit:** "Enable text compression"

```nginx
# Nginx configuration for Brotli (preferred)
brotli on;
brotli_types text/plain text/css application/javascript application/json text/xml;
brotli_comp_level 6;

# Gzip fallback
gzip on;
gzip_types text/plain text/css application/javascript application/json text/xml;
gzip_comp_level 6;
```

```apache
# Apache configuration
<IfModule mod_brotli.c>
  AddOutputFilterByType BROTLI_COMPRESS text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>
```

### 9. Reduce Unused CSS

**Audit:** "Reduce unused CSS"

```bash
# Use PurgeCSS to remove unused CSS
npx purgecss --css ./styles.css --content ./src/**/*.html ./src/**/*.js --output ./dist/

# Or use tools like Lightning CSS for automatic dead code elimination
```

### 10. Preconnect to Required Origins

**Audit:** "Preconnect to required origins"

```html
<!-- Establish early connections to critical third-party origins -->
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://api.example.com">

<!-- DNS prefetch for less critical origins -->
<link rel="dns-prefetch" href="https://analytics.example.com">
```

---

## Running Lighthouse

### CLI

```bash
# Install
npm install -g lighthouse

# Run against a URL
lighthouse https://example.com --output html --output-path ./report.html

# Run with specific categories
lighthouse https://example.com --only-categories=performance,accessibility

# Run in CI (JSON output for automation)
lighthouse https://example.com --output=json --output-path=./report.json --chrome-flags="--headless"
```

### CI Integration

```yaml
# GitHub Actions example
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx @lhci/cli autorun
```

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
  },
};
```

### Chrome DevTools Integration

1. Open Chrome DevTools (F12)
2. Go to **Lighthouse** tab
3. Select categories and device type
4. Click **Analyze page load**
5. Review each failed audit for specific fix recommendations

---

## Common Fixes Quick Reference

| Audit | Quick Fix |
|-------|-----------|
| Eliminate render-blocking resources | Inline critical CSS, defer non-critical |
| Reduce unused JavaScript | Tree-shake, code-split, dynamic imports |
| Properly size images | Use `srcset` and `sizes` attributes |
| Minimize main-thread work | Web Workers, break up long tasks |
| Avoid excessive DOM | Virtual scrolling, component-level rendering |
| Efficiently encode images | WebP/AVIF, CDN with auto-format |
| Enable text compression | Brotli (or gzip) on server |
| Reduce unused CSS | PurgeCSS, CSS Modules, CSS-in-JS |
| Preconnect to required origins | `<link rel="preconnect">` tags |
| Lazy load offscreen images | `loading="lazy"` attribute |

---

## Performance Budget Example

```json
{
  "budgets": [
    {
      "path": "/",
      "timings": [
        { "metric": "first-contentful-paint", "budget": 1500 },
        { "metric": "largest-contentful-paint", "budget": 2500 },
        { "metric": "cumulative-layout-shift", "budget": 0.1 },
        { "metric": "total-blocking-time", "budget": 200 },
        { "metric": "speed-index", "budget": 3000 }
      ]
    }
  ]
}
```

---

*Sources: Lighthouse documentation (developer.chrome.com/docs/lighthouse), web.dev performance guides*
