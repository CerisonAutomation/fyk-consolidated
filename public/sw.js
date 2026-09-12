/*
 * FYK service worker — offline shell, push delivery, and nothing else.
 *
 * Why it is deliberately boring, and why the previous version of this file (a
 * cache-first `caches.match(event.request)` around *every* request, with `/` and
 * `/offline` precached) would have broken the app harder than it fixed anything:
 *
 *  1. Every document this app serves is `cache-control: private, no-store`
 *     (src/lib/security.ts, through `__root.tsx`'s `headers()`), because a rendered
 *     screen belongs to whoever asked. A precached `/` is a snapshot of one person's
 *     signed-out home screen, handed to whoever opens the app offline — and while the
 *     page is cached, no deploy reaches anybody. So documents are never written to a
 *     cache. They are requested from the network and, if the network fails, the static
 *     `/offline.html` is shown instead. That is the entire offline story this app can
 *     honestly tell, and it is a real one: the install works, and a user in a tunnel
 *     sees a notice rather than a browser error page.
 *  2. `/api/*` is the app's source of truth (wallet, taps, safety check-ins). Cache-first
 *     on those paths means "your boost did not apply" and worse. They are network-only,
 *     and offline they answer `504` with JSON, because the browser client parses JSON
 *     and an HTML error body would surface as "Failed to fetch" with no reason.
 *  3. `push` and `notificationclick` are what the subscription at
 *     src/lib/push.ts is for. A subscription is only usable if the worker handling it
 *     declares the events: without a `push` listener the browser accepts the
 *     subscription, hands the payload to nothing, and every delivery is dropped silently
 *     — which is exactly how this repo's push looked from the outside.
 *
 * The payload contract is `{title, body, href}`, sent by `supabase/functions/notify`
 * and asserted against by `src/lib/migration-invariants.test.ts`. `src/` and this file
 * are compiled separately, so that test is the only thing standing between a rename
 * there and ten thousand notifications reading `undefined` here.
 */
"use strict";

const VERSION = "fyk-v2";
const OFFLINE_URL = "/offline.html";
/**
 * Precached at install. Static files only — `public/` is served verbatim by Vite, so
 * every entry here is a real URL, and `src/lib/app-shell.test.ts` fails the build if one
 * stops being true. (`/offline` was this file's original second entry: there is no
 * `/offline` *route*, only `public/offline.html`, so `cache.addAll` rejected, `install`
 * failed, and the worker never activated at all.)
 */
const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/badge-72.png",
  "/logo-square.svg",
  "/theme-init.js",
];

const immutable = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith("/_build/") ||
    url.pathname.startsWith("/assets/") ||
    /\.(?:css|js|woff2?|png|jpe?g|webp|svg|ico)$/i.test(url.pathname) &&
      !url.pathname.startsWith("/api/"));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(`${VERSION}-static`)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Cache-first for content-hashed static assets, with a bounded runtime cache. */
async function fromStaticCache(request) {
  const cache = await caches.open(`${VERSION}-runtime`);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && (response.type === "basic" || response.type === "default")) {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    // Vite emits a new hashed chunk per deploy; without a cap the cache is a disk
    // quota failure waiting to happen on a phone with a full storage partition.
    if (keys.length > 120) await cache.delete(keys[0]);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;

  // The API is never answered from a cache, and never answered with HTML.
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: "You appear to be offline." }), {
            status: 504,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          }),
      ),
    );
    return;
  }

  if (immutable(url)) {
    event.respondWith(fromStaticCache(request));
    return;
  }

  // Documents and anything else same-origin: network first, offline notice as the only
  // fallback. A navigation that fails offline shows `/offline.html` even for a deep link;
  // going back and re-opening is the intended recovery.
  event.respondWith(
    fetch(request).catch(async () => {
      if (request.mode === "navigate") {
        const offline = await caches.match(OFFLINE_URL);
        if (offline) return offline;
      }
      return new Response("offline", {
        status: 504,
        headers: { "content-type": "text/plain", "cache-control": "no-store" },
      });
    }),
  );
});

/* --------------------------------------------------------------------------
 * Push
 * -------------------------------------------------------------------------- */

/**
 * `href` comes from a database column, so it is filtered exactly the way
 * `safeDeepLink()` in src/components/notifications/notifications-client.tsx filters it
 * before it reaches an `<a href>`: app-relative, same-origin, never a protocol, never a
 * `//host`. The protocol test below is deliberately a copy of that file's `UNSAFE_SCHEME`
 * literal, and `src/lib/app-shell.test.ts` fails if the two stop matching — this file is
 * not compiled with the app, so a comment would be the only thing keeping them together.
 *
 * Why the filter matters more here than in the inbox: a notification that opened
 * `https://attacker.example/...` would be the most convincing phishing message a user's
 * phone had ever shown them, sent under this app's name and icon.
 */
function safeHref(value) {
  if (typeof value !== "string" || !value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null; /* UNSAFE_SCHEME */
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? url.pathname + url.search : null;
  } catch {
    return null;
  }
}

self.addEventListener("push", (event) => {
  let payload = null;
  try {
    payload = event.data ? JSON.parse(event.data.text()) : null;
  } catch {
    payload = null;
  }

  // A push with no usable body is treated as an invalidation signal rather than shown:
  // it means "something happened in your inbox", and telling the user that in the
  // window they are already in is better than a second, vaguer copy of it.
  if (!payload || typeof payload.title !== "string" || !payload.title) {
    event.waitUntil(
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((list) => {
          for (const client of list) client.postMessage({ type: "fyk:inbox-dirty" });
        }),
    );
    return;
  }

  const href = safeHref(payload.href);
  const body = typeof payload.body === "string" ? payload.body.slice(0, 600) : "";
  const tag = href ? `fyk-${href}` : "fyk";

  event.waitUntil(
    self.registration.showNotification(payload.title.slice(0, 200), {
      body,
      tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      data: { href },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data && event.notification.data.href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus the app if it is open and hand it the route; a full navigation from an
        // already-correct document would throw away what the user was doing.
        for (const client of clients) {
          if (!("focus" in client)) continue;
          const at = (() => {
            try {
              return new URL(client.url);
            } catch {
              return null;
            }
          })();
          const already = at && href && at.pathname + at.search === href;
          return client.focus().then(() => {
            if (href && !already) client.postMessage({ type: "fyk:navigate", href });
          });
        }
        return href
          ? self.clients.openWindow(href)
          : self.clients.openWindow("/");
      }),
  );
});

/* --------------------------------------------------------------------------
 * Subscription lifecycle
 * -------------------------------------------------------------------------- */

/**
 * The browser drops a subscription it can no longer renew (keys rotated, service
 * re-registered, provider-side expiry). The VAPID public key lives in the app's build
 * environment, not here, so re-subscribing is the page's job: this posts a request and
 * `syncPushSubscription()` in src/lib/push.ts does the work. Doing nothing here would
 * leave a row in `push_subscriptions` pointing at a dead endpoint, which is what made
 * "notifications stopped working last week" unanswerable in apps like this one.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .getSubscription()
      .then((current) => (current ? current.unsubscribe() : null))
      .then(() =>
        self.clients.matchAll({ type: "window", includeUncontrolled: true }),
      )
      .then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: "fyk:push-resync" });
        }
      }),
  );
});

self.addEventListener("notificationclose", (event) => {
  // Dismissed without opening is still a read signal for the in-app inbox: the row
  // exists either way, and the screen the user is looking at should notice.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) client.postMessage({ type: "fyk:inbox-dirty" });
      }),
  );
});
