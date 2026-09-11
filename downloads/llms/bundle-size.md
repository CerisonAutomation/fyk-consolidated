# JavaScript Bundle Size Optimization

## Overview

Bundle size directly impacts page load time, Time to Interactive (TTI), and Total Blocking Time (TBT). Larger bundles require more download time, parsing time, and compilation time -- all of which block the main thread and delay interactivity.

---

## 1. Code Splitting

Divide your bundle into smaller chunks that load on demand.

### Route-Based Splitting

```javascript
// React: Lazy load routes
import { lazy, Suspense } from 'react';

const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

```javascript
// Vue: Lazy load routes
const routes = [
  {
    path: '/',
    component: () => import('./pages/Home.vue'),
  },
  {
    path: '/dashboard',
    component: () => import('./pages/Dashboard.vue'),
  },
];
```

```javascript
// Next.js: Dynamic imports with ssr: false
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('./components/HeavyChart'), {
  ssr: false,
  loading: () => <p>Loading chart...</p>,
});
```

### Component-Level Splitting

```javascript
// React: Lazy load heavy components
const DataVisualization = lazy(() => import('./components/DataVisualization'));
const RichTextEditor = lazy(() => import('./components/RichTextEditor'));

function Article({ content, hasChart }) {
  return (
    <div>
      <p>{content}</p>
      {hasChart && (
        <Suspense fallback={<div className="chart-placeholder" />}>
          <DataVisualization />
        </Suspense>
      )}
    </div>
  );
}
```

### Conditional Splitting

```javascript
// Load features based on user permissions or conditions
async function loadAdminPanel() {
  const { AdminDashboard } = await import('./admin/AdminDashboard');
  return AdminDashboard;
}

// Load based on feature flags
if (featureFlags.enableNewEditor) {
  const editor = await import('./features/new-editor');
  editor.init();
}
```

---

## 2. Tree Shaking

Remove unused code from your bundles.

### How It Works

Tree shaking relies on ES module static analysis (`import`/`export`). Only code that is actually imported and used gets included in the final bundle.

```javascript
// BAD: Import entire library
import _ from 'lodash';
const result = _.debounce(fn, 300);
// Entire lodash library is included

// GOOD: Import specific function
import debounce from 'lodash/debounce';
const result = debounce(fn, 300);
// Only debounce function is included

// BEST: Use native APIs or small focused packages
// No import needed -- use native implementation
```

### Enabling Tree Shaking

```javascript
// webpack.config.js
module.exports = {
  mode: 'production', // Enables tree shaking
  optimization: {
    usedExports: true,
    sideEffects: false, // Tells webpack all modules are pure
  },
};
```

```javascript
// package.json -- Mark packages as side-effect-free
{
  "sideEffects": false
}

// Or specify which files have side effects
{
  "sideEffects": ["*.css", "./src/polyfills.js"]
}
```

### Tree-Shaking-Friendly Libraries

```javascript
// Instead of moment.js (280KB, not tree-shakeable)
import moment from 'moment'; // BAD

// Use date-fns (tree-shakeable)
import { format } from 'date-fns'; // GOOD -- only imports format

// Instead of lodash (full bundle)
import _ from 'lodash'; // BAD

// Use lodash-es or individual packages
import debounce from 'lodash-es/debounce'; // GOOD
```

---

## 3. Dynamic Imports

Load JavaScript only when it's actually needed.

### Basic Dynamic Import

```javascript
// Standard dynamic import
async function loadModule() {
  const module = await import('./heavy-module.js');
  module.init();
}

// Load on user interaction
button.addEventListener('click', async () => {
  const { default: Modal } = await import('./Modal');
  showModal(Modal);
});
```

### Dynamic Import with Error Handling

```javascript
async function loadFeature(featureName) {
  try {
    const module = await import(`./features/${featureName}`);
    return module.default;
  } catch (error) {
    console.error(`Failed to load feature: ${featureName}`, error);
    // Fallback to a simple version
    const fallback = await import('./features/fallback');
    return fallback.default;
  }
}
```

### Prefetching Dynamic Imports

```javascript
// Prefetch on hover -- load before user needs it
link.addEventListener('mouseenter', () => {
  // Tell browser to prefetch during idle time
  const linkEl = document.createElement('link');
  linkEl.rel = 'prefetch';
  linkEl.href = '/static/js/heavy-page.chunk.js';
  document.head.appendChild(linkEl);
});

// Or use webpack magic comments
const module = import(
  /* webpackPrefetch: true */
  './HeavyComponent'
);
```

---

## 4. Minification and Compression

### Minification

Remove whitespace, comments, and shorten variable names.

```javascript
// Before minification
function calculateTotalPrice(items) {
  const taxRate = 0.08;
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total * (1 + taxRate);
}

// After minification
function calculateTotalPrice(e){const t=.08;let n=0;for(let r=0;r<e.length;r++)n+=e[r].price*e[r].quantity;return n*(1+t)}
```

### Brotli Compression (Preferred)

```nginx
# Nginx
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/javascript application/json text/xml;
```

```apache
# Apache
<IfModule mod_brotli.c>
  AddOutputFilterByType BROTLI_COMPRESS text/html text/plain text/css text/javascript application/javascript
</IfModule>
```

### Gzip Compression (Fallback)

```nginx
# Nginx
gzip on;
gzip_comp_level 6;
gzip_types text/plain text/css application/javascript application/json text/xml;
gzip_min_length 256;
```

### Compression Comparison

| Algorithm | Compression Ratio | Speed | Browser Support |
|-----------|------------------|-------|-----------------|
| Brotli | 15-25% better than gzip | Slower compression | 97%+ |
| Gzip | Good baseline | Fast compression | Universal |
| Zstandard | Comparable to Brotli | Fastest decompression | Limited |

---

## 5. Analyze and Monitor Bundle Size

### Bundle Analyzer Tools

```bash
# webpack bundle analyzer
npm install webpack-bundle-analyzer --save-dev
```

```javascript
// webpack.config.js
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: 'bundle-report.html',
      openAnalyzer: false,
    }),
  ],
};
```

```bash
# Rollup/Rollup-plugin-visualizer
npm install rollup-plugin-visualizer --save-dev
```

```javascript
// rollup.config.js
import { visualizer } from 'rollup-plugin-visualizer';

export default {
  plugins: [
    visualizer({
      filename: 'bundle-report.html',
      open: true,
    }),
  ],
};
```

```bash
# Source map explorer
npx source-map-explorer 'dist/**/*.js' --html bundle-report.html
```

### Budget Enforcement

```json
// package.json -- performance budgets
{
  "budgets": [
    {
      "type": "initial",
      "maximumWarning": "200kb",
      "maximumError": "300kb"
    },
    {
      "type": "anyComponentStyle",
      "maximumWarning": "4kb",
      "maximumError": "8kb"
    }
  ]
}
```

```javascript
// webpack.config.js -- budget plugin
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'disabled',
      stats: true,
      statsOptions: { assets: true },
    }),
  ],
  performance: {
    hints: 'error',
    maxEntrypointSize: 200000,  // 200KB
    maxAssetSize: 100000,       // 100KB
  },
};
```

---

## 6. Third-Party Script Management

### Audit Third-Party Scripts

```javascript
// Measure impact of third-party scripts
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.initiatorType === 'script') {
      console.log(`${entry.name}: ${entry.duration.toFixed(0)}ms`);
    }
  }
});

observer.observe({ type: 'resource', filter: { initiatorType: 'script' } });
```

### Lazy Load Third-Party Scripts

```html
<!-- Defer analytics until after page load -->
<script>
  window.addEventListener('load', () => {
    // Load analytics after page is interactive
    const script = document.createElement('script');
    script.src = 'https://analytics.example.com/script.js';
    script.async = true;
    document.head.appendChild(script);
  });
</script>

<!-- Or use requestIdleCallback for truly idle loading -->
<script>
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      const script = document.createElement('script');
      script.src = 'https://analytics.example.com/script.js';
      script.async = true;
      document.head.appendChild(script);
    });
  } else {
    window.addEventListener('load', () => {
      const script = document.createElement('script');
      script.src = 'https://analytics.example.com/script.js';
      script.async = true;
      document.head.appendChild(script);
    });
  }
</script>
```

### Self-Hosting Third-Party Scripts

```bash
# Download and self-host third-party scripts
# This eliminates the DNS lookup, connection, and negotiation overhead

# Example: Self-host Google Fonts
curl -o fonts/inter.woff2 "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjQ.woff2"
```

---

## 7. Optimization Patterns Summary

| Pattern | Impact | Difficulty | When to Use |
|---------|--------|------------|-------------|
| Code splitting | High | Medium | Always |
| Tree shaking | Medium-High | Low | Always |
| Dynamic imports | High | Medium | Features below the fold |
| Brotli compression | Medium | Low | Always (server config) |
| Minification | Medium | Low | Always (build tool) |
| Bundle analysis | N/A | Low | During optimization |
| Remove unused deps | Medium-High | Medium | After analysis |
| Self-host third-party | Medium | Medium | After audit |
| Performance budgets | N/A | Low | Always |

---

## 8. Common Pitfalls

### Barrel File Explosion

```javascript
// BAD: Re-exporting everything in index.js (prevents tree shaking)
// utils/index.js
export * from './date-utils';
export * from './string-utils';
export * from './array-utils';

// Importing any single function pulls in all of them
import { debounce } from './utils'; // Includes ALL utils

// GOOD: Direct imports
import { debounce } from './utils/string-utils';
```

### Side Effects Preventing Tree Shaking

```javascript
// BAD: Module with side effects
// utils.js
export const formatDate = (date) => { /* ... */ };
console.log('utils loaded'); // Side effect! Prevents tree shaking

// GOOD: Pure module
// utils.js
export const formatDate = (date) => { /* ... */ };
// No side effects -- tree shaking works
```

### Large Monolithic Dependencies

```javascript
// BAD: Full firebase import
import firebase from 'firebase'; // ~400KB

// GOOD: Modular firebase imports
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
```

---

*Sources: web.dev (code-splitting, reduce-network-payloads), webpack documentation, bundlephobia*
