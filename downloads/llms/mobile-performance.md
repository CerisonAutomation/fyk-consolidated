# Mobile Web App Performance Patterns

> Source: web.dev, Google Chrome team (2024)

## Core Web Vitals

Google's Core Web Vitals are the essential metrics for measuring user experience quality. All mobile web apps should target these thresholds at the 75th percentile.

### Current Core Web Vitals (Stable)

| Metric | Measures | Good Target | Poor |
|--------|----------|-------------|------|
| **LCP** (Largest Contentful Paint) | Loading performance | < 2.5 seconds | > 4.0 seconds |
| **INP** (Interaction to Next Paint) | Interactivity | < 200 milliseconds | > 500 milliseconds |
| **CLS** (Cumulative Layout Shift) | Visual stability | < 0.1 | > 0.25 |

### Supplementary Web Vitals

| Metric | Purpose | Notes |
|--------|---------|-------|
| **TTFB** (Time to First Byte) | Server response time | Useful for diagnosing LCP |
| **FCP** (First Contentful Paint) | First visible content | Useful for diagnosing LCP |
| **TBT** (Total Blocking Time) | Lab metric for INP | Use in Lighthouse testing |

## Measuring Performance

### JavaScript Measurement

```typescript
import { onCLS, onINP, onLCP } from 'web-vitals';

function sendToAnalytics(metric: any) {
  const body = JSON.stringify(metric);
  // Use sendBeacon for reliability
  (navigator.sendBeacon && navigator.sendBeacon('/analytics', body)) ||
    fetch('/analytics', { body, method: 'POST', keepalive: true });
}

onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onLCP(sendToAnalytics);
```

### Lab Testing Tools

| Tool | LCP | INP | CLS |
|------|-----|-----|-----|
| Chrome DevTools | Yes | Yes | Yes |
| Lighthouse | Yes | No (use TBT) | Yes |
| PageSpeed Insights | Yes | Yes | Yes |
| Chrome UX Report | Yes | Yes | Yes |

## LCP Optimization

### Common LCP Elements
- `<img>` element
- `<video>` poster image
- Background images via CSS
- Block-level text elements

### Optimization Strategies

#### 1. Optimize Images
```html
<!-- Use modern formats and responsive images -->
<picture>
  <source srcset="hero.avif" type="image/avif">
  <source srcset="hero.webp" type="image/webp">
  <img src="hero.jpg" alt="Hero" width="800" height="600"
       loading="eager" fetchpriority="high">
</picture>
```

#### 2. Preload Critical Resources
```html
<link rel="preload" as="image" href="hero.avif" type="image/avif">
<link rel="preload" as="font" href="font.woff2" type="font/woff2" crossorigin>
```

#### 3. Reduce Server Response Time
- Use CDN for static assets
- Implement server-side caching
- Optimize database queries
- Use HTTP/2 or HTTP/3

#### 4. Eliminate Render-Blocking Resources
```html
<!-- Defer non-critical CSS -->
<link rel="stylesheet" href="critical.css">
<link rel="stylesheet" href="non-critical.css" media="print" onload="this.media='all'">
```

#### 5. Optimize Font Loading
```css
@font-face {
  font-family: 'CustomFont';
  src: url('font.woff2') format('woff2');
  font-display: swap; /* Show fallback immediately */
}
```

## INP Optimization

### Understanding Interaction Latency
INP measures the latency of all interactions throughout the page lifecycle. It reports the worst-case interaction latency (excluding outliers).

### Optimization Strategies

#### 1. Break Up Long Tasks
```typescript
// Bad: Long synchronous task
const processData = (items: Item[]) => {
  items.forEach(item => heavyComputation(item));
};

// Good: Yield to main thread
const processDataAsync = async (items: Item[]) => {
  for (let i = 0; i < items.length; i++) {
    heavyComputation(items[i]);
    if (i % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
};
```

#### 2. Use Web Workers
```typescript
// Offload heavy computation
const worker = new Worker('heavy-task.worker.js');
worker.postMessage({ data: largeDataset });
worker.onmessage = (e) => {
  updateUI(e.data);
};
```

#### 3. Optimize Event Handlers
```typescript
// Bad: Synchronous DOM manipulation
button.addEventListener('click', () => {
  const result = expensiveCalculation();
  document.getElementById('output').textContent = result;
});

// Good: Debounce or use requestAnimationFrame
let pending = false;
button.addEventListener('click', () => {
  if (!pending) {
    requestAnimationFrame(() => {
      const result = expensiveCalculation();
      document.getElementById('output').textContent = result;
      pending = false;
    });
    pending = true;
  }
});
```

#### 4. Reduce JavaScript Execution
- Code splitting for route-based loading
- Tree shaking unused code
- Use dynamic imports: `const module = await import('./heavy-module.js')`
- Minify and compress JavaScript

## CLS Optimization

### Common Causes of Layout Shift
- Images without dimensions
- Dynamically injected content
- Web fonts causing FOIT/FOUT
- Ads or embeds without reserved space
- Late-loading CSS

### Prevention Strategies

#### 1. Always Set Dimensions
```html
<img src="photo.jpg" width="800" height="600" alt="Photo">
```

```css
/* Use aspect-ratio for responsive images */
.image-container {
  aspect-ratio: 16 / 9;
  width: 100%;
}
```

#### 2. Reserve Space for Dynamic Content
```css
/* Reserve space for ads */
.ad-slot {
  min-height: 250px;
  background-color: #f0f0f0;
}
```

#### 3. Use CSS Containment
```css
.card {
  contain: layout style paint;
}
```

#### 4. Font Loading Strategy
```css
@font-face {
  font-family: 'CustomFont';
  src: url('font.woff2') format('woff2');
  font-display: optional; /* Use fallback if font not ready */
}
```

## Mobile-Specific Performance Patterns

### WebView Optimization (Capacitor/Ionic)

```typescript
// Disable overscroll on iOS
document.body.style.overscrollBehavior = 'none';

// Use passive event listeners
document.addEventListener('touchmove', handler, { passive: true });

// Optimize scroll performance
const scrollHandler = () => {
  requestAnimationFrame(() => {
    // Update scroll-dependent UI
  });
};
window.addEventListener('scroll', scrollHandler, { passive: true });
```

### Bundle Optimization

```typescript
// Route-based code splitting
const Home = React.lazy(() => import('./pages/Home'));
const Settings = React.lazy(() => import('./pages/Settings'));

// Dynamic imports for heavy features
const openCamera = async () => {
  const { Camera } = await import('@capacitor/camera');
  return Camera.getPhoto({ quality: 80 });
};
```

### Caching Strategies

```typescript
// Service Worker for offline support
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    // Network first for API calls
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else {
    // Cache first for static assets
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});
```

### Image Optimization

```typescript
// Responsive images with lazy loading
const ResponsiveImage = ({ src, alt }) => (
  <img
    src={src}
    alt={alt}
    loading="lazy"
    decoding="async"
    srcSet={`${src}?w=400 400w, ${src}?w=800 800w`}
    sizes="(max-width: 600px) 400px, 800px"
  />
);
```

### Virtual Scrolling for Large Lists

```typescript
// For lists with 100+ items
const VirtualList = ({ items }) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });

  const handleScroll = (e) => {
    const scrollTop = e.target.scrollTop;
    const itemHeight = 60; // Fixed height per item
    const start = Math.floor(scrollTop / itemHeight);
    setVisibleRange({ start, end: start + 20 });
  };

  return (
    <div onScroll={handleScroll} style={{ height: '100vh', overflow: 'auto' }}>
      <div style={{ height: items.length * itemHeight }}>
        {items.slice(visibleRange.start, visibleRange.end).map((item, i) => (
          <div key={item.id} style={{ position: 'absolute', top: (visibleRange.start + i) * itemHeight }}>
            {item.content}
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Performance Budget

### Recommended Budgets (Mobile)

| Metric | Budget |
|--------|--------|
| Total JavaScript | < 300KB gzipped |
| Total CSS | < 100KB gzipped |
| Total Images | < 500KB per page |
| Time to Interactive | < 3.5 seconds |
| First Contentful Paint | < 1.8 seconds |
| LCP | < 2.5 seconds |
| CLS | < 0.1 |

### Monitoring

```typescript
// Log performance metrics
const reportMetrics = () => {
  const nav = performance.getEntriesByType('navigation')[0];
  console.log('TTFB:', nav.responseStart - nav.requestStart);
  console.log('DOM Ready:', nav.domContentLoadedEventEnd);
  console.log('Load Complete:', nav.loadEventEnd);
};

window.addEventListener('load', reportMetrics);
```

## Testing Checklist

- [ ] Test on slow 3G network throttling
- [ ] Test on low-end Android devices
- [ ] Run Lighthouse audit (target score > 90)
- [ ] Check Chrome DevTools Performance panel
- [ ] Measure real user metrics with CrUX or web-vitals
- [ ] Test offline behavior
- [ ] Validate image lazy loading
- [ ] Check JavaScript bundle size
- [ ] Test scroll performance with 1000+ items
