# Lazy Loading Patterns for Web Applications

## Overview

Lazy loading defers the loading of non-critical resources until they are actually needed -- typically when they enter or approach the viewport. This reduces initial page weight, improves load time (LCP), and frees up bandwidth for above-the-fold content.

---

## 1. Native Image Lazy Loading

The simplest approach using the browser's built-in `loading` attribute.

### Basic Usage

```html
<!-- Lazy load a below-the-fold image -->
<img
  src="photo.jpg"
  alt="Description"
  loading="lazy"
  decoding="async"
  width="800"
  height="600"
>
```

### Key Rules

- **Always set `width` and `height`** -- the browser needs these to reserve space before the image loads (prevents CLS)
- **Never lazy-load LCP images** -- the hero/above-the-fold image should load immediately with `fetchpriority="high"`
- **Combine with `decoding="async"`** -- allows the browser to decode the image off the main thread

```html
<!-- LCP image: load immediately, high priority -->
<img src="hero.webp" fetchpriority="high" width="1200" height="600" alt="Hero">

<!-- Below-the-fold image: lazy load -->
<img src="content-photo.webp" loading="lazy" decoding="async" width="800" height="400" alt="Content">
```

### Browser Support

- Chrome 76+
- Firefox 75+
- Safari 15.4+
- Edge 76+

---

## 2. Intersection Observer Pattern

Provides more control over when and how resources are lazy loaded.

### Image Lazy Loading with Preload Buffer

```javascript
class LazyImageLoader {
  constructor(options = {}) {
    this.rootMargin = options.rootMargin || '200px 0px';
    this.threshold = options.threshold || 0.01;

    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        rootMargin: this.rootMargin,
        threshold: this.threshold,
      }
    );
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        this.loadImage(img);
        this.observer.unobserve(img);
      }
    });
  }

  loadImage(img) {
    if (img.dataset.src) {
      img.src = img.dataset.src;
    }
    if (img.dataset.srcset) {
      img.srcset = img.dataset.srcset;
    }
    img.classList.add('loaded');
    img.classList.remove('lazy');
  }

  observe(elements) {
    elements.forEach(el => this.observer.observe(el));
  }

  disconnect() {
    this.observer.disconnect();
  }
}

// Usage
const loader = new LazyImageLoader({ rootMargin: '300px 0px' });
loader.observe(document.querySelectorAll('img.lazy'));
```

### HTML Setup

```html
<img
  class="lazy"
  src="placeholder-blur.jpg"
  data-src="full-image.jpg"
  data-srcset="full-image-400.jpg 400w, full-image-800.jpg 800w"
  alt="Description"
  width="800"
  height="600"
>
```

```css
/* Visual feedback for loading state */
img.lazy {
  filter: blur(10px);
  transition: filter 0.3s ease;
}

img.lazy.loaded {
  filter: blur(0);
}
```

---

## 3. Intersection Observer Configuration

### Threshold Configuration

```javascript
// Single threshold: callback fires when 50% visible
const observer1 = new IntersectionObserver(callback, { threshold: 0.5 });

// Multiple thresholds: callback fires at each crossing
const observer2 = new IntersectionObserver(callback, {
  threshold: [0, 0.25, 0.5, 0.75, 1]
});

// Any visibility: callback fires as soon as 1% is visible
const observer3 = new IntersectionObserver(callback, { threshold: 0.01 });
```

### Root Margin Configuration

```javascript
// Load 200px before element enters viewport (preload buffer)
const observer1 = new IntersectionObserver(callback, {
  rootMargin: '200px 0px'  // Top, Right, Bottom, Left
});

// Load when element is 100px inside the viewport (delay loading)
const observer2 = new IntersectionObserver(callback, {
  rootMargin: '-100px 0px'
});

// Asymmetric margins
const observer3 = new IntersectionObserver(callback, {
  rootMargin: '100px 0px 300px 0px'  // 100px top, 300px bottom
});
```

### Using Custom Scroll Container

```javascript
const scrollContainer = document.querySelector('.scroll-container');

const observer = new IntersectionObserver(callback, {
  root: scrollContainer,  // Observe within this container
  rootMargin: '100px',
  threshold: 0.1,
});

observer.observe(document.querySelector('.item-to-lazy-load'));
```

---

## 4. Lazy Loading Components and Routes

### React -- Route-Based Lazy Loading

```javascript
import { lazy, Suspense } from 'react';

// Lazy load route components
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

### React -- Component-Level Lazy Loading

```javascript
import { lazy, Suspense, useState } from 'react';

// Lazy load heavy components that aren't always needed
const RichTextEditor = lazy(() => import('./RichTextEditor'));
const DataChart = lazy(() => import('./DataChart'));
const VideoPlayer = lazy(() => import('./VideoPlayer'));

function ArticlePage({ article }) {
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div>
      <h1>{article.title}</h1>
      <p>{article.content}</p>

      {/* Only load editor when user clicks to edit */}
      <button onClick={() => setShowEditor(true)}>
        Edit Article
      </button>

      {showEditor && (
        <Suspense fallback={<div>Loading editor...</div>}>
          <RichTextEditor content={article.content} />
        </Suspense>
      )}
    </div>
  );
}
```

### Vue -- Route-Based Lazy Loading

```javascript
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    component: () => import('./pages/Home.vue'),
  },
  {
    path: '/dashboard',
    component: () => import('./pages/Dashboard.vue'),
    // Lazy load child routes too
    children: [
      {
        path: 'analytics',
        component: () => import('./pages/analytics/Analytics.vue'),
      },
      {
        path: 'settings',
        component: () => import('./pages/settings/Settings.vue'),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Preload on hover (optional enhancement)
router.beforeResolve((to, from, next) => {
  // Trigger component preload when route is about to be entered
  next();
});
```

---

## 5. Lazy Loading Below-the-Fold Content

### Infinite Scroll with Sentinel Element

```javascript
class InfiniteScroll {
  constructor(container, loadMore) {
    this.container = container;
    this.loadMore = loadMore;
    this.loading = false;

    // Create sentinel element at the bottom
    this.sentinel = document.createElement('div');
    this.sentinel.className = 'scroll-sentinel';
    this.container.appendChild(this.sentinel);

    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      { rootMargin: '200px' }
    );

    this.observer.observe(this.sentinel);
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting && !this.loading) {
        this.loading = true;
        this.loadMore().then(() => {
          this.loading = false;
        });
      }
    });
  }

  disconnect() {
    this.observer.disconnect();
  }
}

// Usage
const scroll = new InfiniteScroll(
  document.querySelector('.feed'),
  async () => {
    const newItems = await fetchNextPage();
    renderItems(newItems);
  }
);
```

### "Load More" Button Pattern (Better for Accessibility)

```javascript
class LoadMoreButton {
  constructor(button, loadMore) {
    this.button = button;
    this.loadMore = loadMore;

    this.button.addEventListener('click', async () => {
      this.button.disabled = true;
      this.button.textContent = 'Loading...';

      try {
        const hasMore = await this.loadMore();
        if (!hasMore) {
          this.button.textContent = 'No more content';
          this.button.disabled = true;
        } else {
          this.button.textContent = 'Load More';
          this.button.disabled = false;
        }
      } catch (error) {
        this.button.textContent = 'Error. Try again.';
        this.button.disabled = false;
      }
    });
  }
}
```

---

## 6. Lazy Loading Background Images

```javascript
class LazyBackground {
  constructor(options = {}) {
    this.rootMargin = options.rootMargin || '200px 0px';

    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      { rootMargin: this.rootMargin }
    );

    document.querySelectorAll('[data-bg]').forEach(el => {
      this.observer.observe(el);
    });
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const bgUrl = el.dataset.bg;
        el.style.backgroundImage = `url(${bgUrl})`;
        el.classList.add('bg-loaded');
        this.observer.unobserve(el);
      }
    });
  }
}

// Usage
new LazyBackground();
```

```html
<div
  class="hero-section"
  data-bg="/images/hero-bg.jpg"
  style="min-height: 500px; background-color: #1a1a1a;"
>
  <h1>Content loads first</h1>
</div>
```

---

## 7. Lazy Loading Video

### Native Lazy Loading for Video

```html
<video
  controls
  preload="none"
  poster="video-poster.jpg"
  width="800"
  height="450"
  loading="lazy"
>
  <source src="video.webm" type="video/webm">
  <source src="video.mp4" type="video/mp4">
</video>
```

### Intersection Observer for Video

```javascript
class LazyVideo {
  constructor(options = {}) {
    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      { rootMargin: options.rootMargin || '100px' }
    );

    document.querySelectorAll('video[data-src]').forEach(video => {
      this.observer.observe(video);
    });
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const video = entry.target;
        video.src = video.dataset.src;
        video.querySelectorAll('source').forEach(source => {
          source.src = source.dataset.src;
        });
        video.load();
        this.observer.unobserve(video);
      }
    });
  }
}
```

### Embed Lazy Loading (YouTube, etc.)

```javascript
class LazyEmbed {
  constructor() {
    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      { rootMargin: '200px' }
    );

    document.querySelectorAll('.lazy-embed').forEach(el => {
      this.observer.observe(el);
    });
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const iframe = document.createElement('iframe');
        iframe.src = el.dataset.src;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.width = '100%';
        iframe.height = '100%';
        iframe.style.border = '0';

        el.innerHTML = '';
        el.appendChild(iframe);
        this.observer.unobserve(el);
      }
    });
  }
}
```

```html
<!-- YouTube embed: loads iframe only when scrolled into view -->
<div
  class="lazy-embed"
  data-src="https://www.youtube.com/embed/dQw4w9WgXcQ"
  style="aspect-ratio: 16/9; background: #000;"
>
  <!-- Placeholder thumbnail shown until scrolled into view -->
  <img src="video-thumbnail.jpg" alt="Video" style="width: 100%; height: 100%; object-fit: cover;">
</div>
```

---

## 8. Lazy Loading Fonts

```javascript
class LazyFont {
  constructor(fontFamily, fontWeight = 'normal') {
    this.fontFamily = fontFamily;
    this.fontWeight = fontWeight;
    this.loaded = false;
  }

  load() {
    if (this.loaded) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const font = new FontFace(this.fontFamily, `url(/fonts/${this.fontFamily}.woff2)`, {
        weight: this.fontWeight,
        display: 'swap',
      });

      font.load().then(() => {
        document.fonts.add(font);
        this.loaded = true;
        resolve();
      }).catch(reject);
    });
  }
}

// Usage: Load font only when element with that font is visible
const headingFont = new LazyFont('Playfair Display', '700');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      headingFont.load().then(() => {
        entry.target.classList.add('font-loaded');
      });
      observer.unobserve(entry.target);
    }
  });
});

document.querySelectorAll('.fancy-heading').forEach(el => {
  observer.observe(el);
});
```

---

## 9. Performance Considerations

### When NOT to Lazy Load

| Resource | Reason |
|----------|--------|
| LCP image (hero) | Must load immediately for fast LCP |
| Critical CSS | Must load with HTML for rendering |
| Core JavaScript | Must load for interactivity |
| Above-the-fold images | Should load immediately |

### Optimal Preload Buffer Sizes

| Resource Type | Recommended rootMargin |
|---------------|----------------------|
| Images | 200px - 300px |
| Background images | 100px - 200px |
| Videos/Embeds | 100px - 200px |
| Infinite scroll sentinel | 200px - 500px |

### Memory Management

```javascript
// Disconnect observer when no longer needed
class LazyLoader {
  constructor() {
    this.observer = new IntersectionObserver(this.handleIntersection.bind(this));
  }

  observe(elements) {
    elements.forEach(el => this.observer.observe(el));
  }

  // Clean up when page unloads or component unmounts
  destroy() {
    this.observer.disconnect();
  }
}

// React: Clean up in useEffect
useEffect(() => {
  const loader = new LazyLoader();
  loader.observe(document.querySelectorAll('.lazy'));

  return () => {
    loader.destroy();
  };
}, []);
```

### Avoid Over-Lazy-Loading

Lazy loading too many elements can actually hurt performance:

- Each Intersection Observer has overhead
- Too many observers can cause layout thrashing
- Users may experience jank as images load in batches
- FOUT (Flash of Unstyled Text) with fonts

**Rule of thumb:** Lazy load resources that are below the fold AND not critical for the initial user experience.

---

## 10. Framework-Specific Patterns

### Next.js Image Component

```jsx
import Image from 'next/image';

// Automatic lazy loading (below the fold)
<Image src="/photo.jpg" alt="Description" width={800} height={600} />

// Priority images (above the fold, no lazy loading)
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority  // Disables lazy loading, adds preload
/>

// Custom loading behavior
<Image
  src="/photo.jpg"
  alt="Description"
  width={800}
  height={600}
  loading="eager"  // Force immediate loading
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>
```

### Astro Component Loading

```astro
---
// Only render component when visible
import HeavyChart from './HeavyChart.astro';
---

<div class="chart-container">
  <HeavyChart client:visible />
</div>
```

### Svelte Lazy Loading

```svelte
<script>
  import { onMount } from 'svelte';

  let visible = false;
  let container;

  onMount(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        visible = true;
        observer.disconnect();
      }
    }, { rootMargin: '200px' });

    observer.observe(container);

    return () => observer.disconnect();
  });
</script>

<div bind:this={container}>
  {#if visible}
    <HeavyComponent />
  {/if}
</div>
```

---

## Quick Reference

| Pattern | Use Case | Complexity |
|---------|----------|------------|
| `loading="lazy"` | Simple image lazy loading | Low |
| Intersection Observer | Custom lazy loading with buffer | Medium |
| Route-based splitting | React/Vue route components | Medium |
| Component-level splitting | Heavy interactive components | Medium |
| Infinite scroll | Long feeds/lists | Medium |
| Video lazy loading | Below-the-fold videos | Low-Medium |
| Embed lazy loading | YouTube, Vimeo iframes | Low |
| Font lazy loading | Non-critical custom fonts | Low |
| Background image lazy loading | Decorative backgrounds | Low |

---

*Sources: MDN (Intersection Observer API), web.dev (lazy-loading, native-lazy-loading), React docs (lazy), Vue Router docs*
