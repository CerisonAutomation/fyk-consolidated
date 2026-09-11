# Service Worker Caching Strategies

Service worker caching strategies define how a service worker's `fetch` event interacts with the Cache API to serve responses. Choosing the right strategy per resource type is the core of offline-first web development.

## Overview

A service worker is a script the browser runs in its own thread, separate from any page. It can intercept every network request your pages make and decide how to answer: from the network, from a cache, or a combination.

---

## Five Core Caching Strategies

### 1. Cache Only

Serve exclusively from the cache. Assets must be precached during the service worker's `install` event.

```javascript
const CACHE = 'app-shell-v1';
const PRECACHE = ['/', '/offline.html', '/css/app.css'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isPrecached = PRECACHE.includes(url.pathname);
  if (isPrecached) {
    event.respondWith(
      caches.open(CACHE).then((cache) => cache.match(event.request.url))
    );
  }
});
```

**When to use:** Static assets bundled with the application (app shell, hashed bundles).
**Pros:** Blazing fast. Works offline immediately.
**Cons:** Content is never updated until the service worker version changes.

---

### 2. Cache First (Falling Back to Network)

Check cache first. On miss, fetch from network, cache the response, and return it.

```javascript
self.addEventListener('fetch', (event) => {
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.open(CACHE).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request).then((fetchedResponse) => {
            cache.put(event.request, fetchedResponse.clone());
            return fetchedResponse;
          });
        });
      })
    );
  }
});
```

**When to use:** Static assets with versioned filenames (CSS, JS bundles, fonts, icons).
**Pros:** Excellent performance and offline availability. Bypasses HTTP cache.
**Cons:** May serve stale content if URLs are reused.

---

### 3. Network First (Falling Back to Cache)

Fetch from network first. If it succeeds, cache and return. If it fails, fall back to cache.

```javascript
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE).then((cache) => {
        return fetch(event.request)
          .then((fetchedResponse) => {
            cache.put(event.request, fetchedResponse.clone());
            return fetchedResponse;
          })
          .catch(() => cache.match(event.request));
      })
    );
  }
});
```

**When to use:** HTML pages, API requests where freshness is critical.
**Pros:** Always shows latest content. Cache serves as offline fallback.
**Cons:** Slower on slow networks. Only as fast as the network when online.

---

### 4. Stale While Revalidate

Serve cached response immediately. In the background, fetch a fresh copy to update the cache.

```javascript
self.addEventListener('fetch', (event) => {
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.open(CACHE).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});
```

**When to use:** News feeds, social posts, product catalogs, avatars.
**Pros:** Instant response from cache, then async update.
**Cons:** User sees slightly stale data on first visit.

---

### 5. Network Only

Never cache. Requests pass directly to the network.

```javascript
self.addEventListener('fetch', (event) => {
  // For non-GET requests, analytics, and authenticated calls:
  // Simply do not call event.respondWith(), or:
  if (event.request.method !== 'GET') {
    return; // Pass through to network
  }
});
```

**When to use:** Form submissions, checkout flows, analytics beacons, admin pages.
**Pros:** Always fresh. No cache storage used.
**Cons:** Does not work offline.

---

### 6. Network Only with Fallback

Try the network first. If it fails, serve a cached offline page.

```javascript
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline.html'))
    );
  }
});
```

**When to use:** Critical pages that need freshness but also a graceful offline experience.

---

## Strategy Selection Guide

| Resource Type | Strategy | Rationale |
|---|---|---|
| App shell (HTML, CSS, JS) | Precache / Cache First | Immutable, versioned bundles |
| Images & Fonts | Cache First | Rarely change, large files |
| API data (read) | Network First or Stale While Revalidate | Balance freshness vs speed |
| API data (write/mutations) | Network Only | Must reach server |
| HTML navigation | Network First with offline fallback | Freshness preferred |
| Analytics / beacons | Network Only | No caching needed |
| Third-party assets | Stale While Revalidate | Update in background |

---

## Composite Strategy Handler

Route different request types to different strategies:

```javascript
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Critical API data: Network First
  if (url.pathname.startsWith('/api/critical/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // General API data: Stale While Revalidate
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Static assets: Cache First
  if (['image', 'font', 'style', 'script'].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default: network
  event.respondWith(fetch(request));
});
```

---

## Lifecycle Events

### Install Event -- Precaching

```javascript
const CACHE_NAME = 'app-v2';
const PRECACHE_URLS = ['/', '/styles/main.css', '/scripts/app.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Skip waiting to activate new SW immediately
  self.skipWaiting();
});
```

### Activate Event -- Cache Cleanup

Delete old caches when a new service worker activates:

```javascript
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Claim all open clients immediately
  self.clients.claim();
});
```

---

## Critical Implementation Rules

1. **Only cache GET requests.** Never cache POST, PUT, DELETE.
2. **Only cache successful responses.** Check `response.ok` before caching.
3. **Never cache personalized HTML with cache-first.** Use network-first or network-only.
4. **Do not cache cross-origin opaque responses.** They cannot be inspected or validated.
5. **Use versioned cache names** (`app-v1`, `app-v2`) and clean up old caches in `activate`.
6. **Implement LRU eviction.** Monitor cache size; browser storage is limited.
7. **Request persistent storage** via `navigator.storage.persist()` for critical caches.

---

## Request Persistent Storage

Prevent the browser from evicting your caches:

```javascript
// In your page JS
if (navigator.storage && navigator.storage.persist) {
  const isPersisted = await navigator.storage.persist();
  if (isPersisted) {
    console.log('Storage persisted -- caches will not be evicted');
  }
}
```

---

## Testing Service Workers

- **Chrome DevTools:** Application > Service Workers (update, unregister, offline)
- **Lighthouse:** Checks for valid SW registration and offline capability
- **Cache Storage:** Application > Cache Storage to inspect cached responses
- **Network throttling:** Simulate offline and slow connections

---

## Browser Support Notes

- Service Workers require HTTPS (or localhost for development).
- Supported in all modern browsers (Chrome, Firefox, Safari 11.1+, Edge).
- Safari has limitations with background sync and push notifications.
- Always use feature detection: `if ('serviceWorker' in navigator) { ... }`

---

**Sources:** Chrome Developers (developer.chrome.com), MDN Web Docs, web.dev
