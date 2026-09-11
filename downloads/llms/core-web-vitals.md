# Core Web Vitals - Optimization Patterns

## Overview

Core Web Vitals are a set of metrics that measure real-world user experience on the web. Scores are evaluated at the **75th percentile** across both mobile and desktop. A "good" score means at least 75% of users are experiencing your page within the target thresholds.

---

## 1. Largest Contentful Paint (LCP)

**What it measures:** Loading performance -- how long it takes for the largest visible content element (hero image, heading, or video poster) to render.

**Thresholds:**
| Rating | LCP |
|--------|-----|
| Good | <= 2.5s |
| Needs Improvement | 2.5s - 4.0s |
| Poor | > 4.0s |

### Optimization Patterns

#### A. Eliminate Resource Load Delay

Ensure the LCP resource starts loading as early as possible.

```html
<!-- Preload the LCP image -->
<link rel="preload" fetchpriority="high" as="image" href="/hero.webp" type="image/webp">

<!-- Hint to browser this is the LCP element -->
<img fetchpriority="high" src="/hero.webp" alt="Hero image">

<!-- De-prioritize non-critical images -->
<img fetchpriority="low" src="/carousel-slide-3.webp" alt="">
```

**Never lazy-load your LCP image.** Lazy loading always introduces unnecessary delay for the most important visual element.

#### B. Eliminate Element Render Delay

The LCP element must render immediately after its resource loads.

```html
<!-- Inline critical CSS instead of blocking stylesheet -->
<style>
  /* Critical above-the-fold styles */
  .hero { width: 100%; height: auto; }
</style>

<!-- Defer non-critical CSS -->
<link rel="preload" href="/non-critical.css" as="style" onload="this.rel='stylesheet'">

<!-- Inline small critical scripts -->
<script>
  // Critical initialization code
</script>
```

- Remove unused CSS
- Split stylesheets into critical vs. non-critical
- Avoid synchronous `<script>` tags in `<head>`
- Use Server-Side Rendering (SSR) or Static Site Generation (SSG)
- Break up long JavaScript tasks on the main thread

#### C. Reduce Resource Load Duration

- Use modern formats (WebP, AVIF) with proper compression
- Serve images with correct dimensions for the viewport
- Use a CDN for geographically closer delivery
- Set strong cache headers for repeat visitors
- Reduce network contention by prioritizing LCP resources

#### D. Reduce Time to First Byte (TTFB)

- Minimize redirects (each adds latency)
- Use CDN edge caching for HTML documents
- Optimize server response times
- Consider static generation for content that doesn't change often

---

## 2. Interaction to Next Paint (INP)

**What it measures:** Responsiveness -- how quickly the page responds to user interactions (clicks, taps, key presses).

**Thresholds:**
| Rating | INP |
|--------|-----|
| Good | <= 200ms |
| Needs Improvement | 200ms - 500ms |
| Poor | > 500ms |

### Optimization Patterns

#### A. Optimize Input Delay

Reduce the time between user input and the browser starting to process the event.

- Minimize long tasks caused by script loading, parsing, and compilation
- Break up or defer heavy script execution
- Reduce main thread work during startup

#### B. Optimize Processing Duration (Event Callbacks)

Yield to the main thread by breaking long tasks into smaller chunks.

```javascript
// BAD: Long synchronous task blocks the main thread
textBox.addEventListener('input', (e) => {
  updateTextBox(e);
  const text = textBox.textContent;
  updateWordCount(text);
  checkSpelling(text);
  saveChanges(text);  // All of this blocks rendering
});

// GOOD: Yield to allow frame rendering between tasks
textBox.addEventListener('input', (e) => {
  // Update UI immediately for visual feedback
  updateTextBox(e);

  // Defer non-critical work after the next frame
  requestAnimationFrame(() => {
    setTimeout(() => {
      const text = textBox.textContent;
      updateWordCount(text);
      checkSpelling(text);
      saveChanges(text);
    }, 0);
  });
});
```

#### C. Minimize Presentation Delay

- Reduce DOM size (large DOMs increase render times)
- Use `content-visibility: auto` for off-screen content
- Avoid client-side rendering of large HTML blocks
- Minimize forced synchronous layouts (layout thrashing)

```css
/* Use content-visibility for lazy rendering */
.below-fold-section {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* estimated height */
}
```

#### D. Avoid Layout Thrashing

```javascript
// BAD: Forces synchronous layout
for (let i = 0; i < items.length; i++) {
  items[i].style.width = items[i].offsetWidth + 10 + 'px'; // Read then write
}

// GOOD: Batch reads and writes
const widths = items.map(el => el.offsetWidth);
items.forEach((el, i) => {
  el.style.width = widths[i] + 10 + 'px';
});
```

---

## 3. Cumulative Layout Shift (CLS)

**What it measures:** Visual stability -- whether page elements shift unexpectedly during loading or interaction.

**Thresholds:**
| Rating | CLS |
|--------|-----|
| Good | <= 0.1 |
| Needs Improvement | 0.1 - 0.25 |
| Poor | > 0.25 |

### Optimization Patterns

#### A. Images and Video -- Always Set Dimensions

```html
<!-- Always include width and height attributes -->
<img src="puppy.jpg" width="640" height="360" alt="Puppy playing">

<!-- For responsive images -->
<img
  srcset="puppy-640.jpg 640w, puppy-1280.jpg 1280w, puppy-1920.jpg 1920w"
  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
  src="puppy-640.jpg"
  width="640"
  height="360"
  alt="Puppy playing"
>
```

```css
/* Make images responsive with CSS */
img {
  height: auto;
  width: 100%;
}
```

#### B. Ads, Embeds, and Dynamic Content -- Reserve Space

```css
/* Reserve space for ads before they load */
.ad-container {
  aspect-ratio: 16 / 9;
  background: #f0f0f0;
}

/* Reserve space for embedded content */
.embed-container {
  min-height: 400px;
}
```

- Place dynamically injected content lower in the viewport to minimize visible shifts
- Use "Load More" buttons instead of automatic infinite scroll
- Pre-fetch content on hover/focus so it appears within 500ms of interaction

#### C. Web Fonts -- Prevent FOUT/FOIT

```css
/* Use font-display: optional for zero CLS */
@font-face {
  font-family: 'MyFont';
  src: url('/fonts/myfont.woff2') format('woff2');
  font-display: optional;
}

/* Match fallback font metrics to custom font */
@font-face {
  font-family: 'MyFont Fallback';
  src: local('Arial');
  size-adjust: 95%;
  ascent-override: 90%;
  descent-override: 20%;
  line-gap-override: 0%;
}
```

```html
<!-- Preload critical fonts -->
<link rel="preload" href="/fonts/myfont.woff2" as="font" type="font/woff2" crossorigin>
```

#### D. Animations -- Use Transform Instead of Layout Properties

```css
/* BAD: Animating layout properties causes reflow */
.element {
  animation: slide 0.3s ease;
}
@keyframes slide {
  from { top: 0; }
  to { top: 100px; }
}

/* GOOD: Use transform -- composited, no layout shift */
.element {
  animation: slide 0.3s ease;
}
@keyframes slide {
  from { transform: translateY(0); }
  to { transform: translateY(100px); }
}
```

#### E. Leverage bfcache

Ensure pages are eligible for the browser's back/forward cache. This restores the page instantly without reloading, eliminating all load-time CLS.

- Check eligibility with `performance.getEntriesByType('navigation')[0].type === 'back_forward'`
- Avoid `Cache-Control: no-store` headers
- Avoid unload event listeners (they prevent bfcache eligibility)

---

## Measurement and Monitoring

### Field Data (Real User Monitoring)

```javascript
import { onLCP, onINP, onCLS } from 'web-vitals';

function sendToAnalytics(metric) {
  console.log(`${metric.name}: ${metric.value} (${metric.rating})`);
  // Send to your analytics service
  fetch('/api/metrics', {
    method: 'POST',
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
    }),
  });
}

onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
```

### Tools

- **PageSpeed Insights** -- CrUX field data + Lighthouse lab data
- **Chrome DevTools Performance panel** -- Layout Shift tracks for debugging
- **Lighthouse** -- Lab-based audits with specific fix recommendations
- **Chrome UX Report (CrUX)** -- Real-world Chrome user data

---

## Key Principles

1. **Field data over lab data** -- Real user experience matters most
2. **75th percentile** -- Optimize for the majority, not the best-case
3. **Mobile-first** -- Measure and optimize mobile first, then desktop
4. **Iterative process** -- Fix one metric, then move to the next
5. **Use the web-vitals library** -- Automate metric collection and reporting

---

*Sources: web.dev (vitals, optimize-lcp, optimize-inp, optimize-cls)*
