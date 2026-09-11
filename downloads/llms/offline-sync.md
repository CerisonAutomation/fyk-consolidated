# Offline Sync Patterns

Offline sync enables web applications to function without connectivity by queuing mutations and replaying them when the network returns. This covers the Background Sync API, queue-based patterns, and conflict resolution strategies.

---

## The Problem

Users create data offline (form submissions, messages, todo items). The app must:
1. Store the data locally
2. Queue the mutation for later
3. Replay when connectivity returns
4. Handle conflicts if the server state has changed

---

## Background Sync API

The native browser API for syncing data when connectivity returns, even if the user has left the page.

### Basic Usage (Service Worker)

```javascript
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  const db = await openDB();
  const messages = await db.getAll('outbox');

  for (const message of messages) {
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (response.ok) {
        await db.delete('outbox', message.id);
      }
    } catch (error) {
      // Will retry on next sync event
      console.error('Sync failed:', error);
    }
  }
}
```

### Triggering a Sync from the Page

```javascript
// In your page JavaScript
async function sendMessage(data) {
  // 1. Save to local outbox
  const db = await openDB();
  await db.add('outbox', {
    ...data,
    timestamp: Date.now(),
    status: 'pending',
  });

  // 2. Register a sync event
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('sync-messages');
  } else {
    // Fallback: try immediately
    await retryNow(data);
  }
}
```

### Handling Sync Results in the Page

```javascript
// Listen for sync completion via BroadcastChannel
const channel = new BroadcastChannel('sync-updates');
channel.onmessage = (event) => {
  if (event.data.type === 'sync-complete') {
    showNotification('Your changes have been saved');
  }
};
```

---

## Periodic Background Sync

Sync periodically even when the user is not actively using the app.

```javascript
// Register periodic sync (service worker)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-feed') {
    event.waitUntil(updateFeed());
  }
});

async function updateFeed() {
  const response = await fetch('/api/feed/latest');
  const data = await response.json();
  const cache = await caches.open('feed-cache');
  await cache.put('/api/feed/latest', new Response(JSON.stringify(data)));
}
```

```javascript
// From the page
const registration = await navigator.serviceWorker.ready;

if ('periodicSync' in registration) {
  const status = await navigator.permissions.query({
    name: 'periodic-background-sync',
  });

  if (status.state === 'granted') {
    await registration.periodicSync.register('update-feed', {
      minInterval: 60 * 60 * 1000, // 1 hour minimum
    });
  }
}
```

**Note:** Periodic Background Sync is only available in Chromium browsers and requires the app to be installed (PWA).

---

## Queue-Based Sync Pattern

A more robust approach using IndexedDB as an outbox with explicit queue management.

### Outbox Schema

```javascript
// IndexedDB setup
const db = await openDB('offline-app', 1, {
  upgrade(db) {
    const outbox = db.createObjectStore('outbox', {
      keyPath: 'id',
      autoIncrement: true,
    });
    outbox.createIndex('status', 'status');
    outbox.createIndex('timestamp', 'timestamp');
  },
});
```

### Queue Manager Class

```javascript
class SyncQueue {
  constructor(dbName = 'offline-app') {
    this.dbName = dbName;
    this.db = null;
  }

  async init() {
    this.db = await openDB(this.dbName, 1, {
      upgrade(db) {
        const store = db.createObjectStore('outbox', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('status', 'status');
        store.createIndex('timestamp', 'timestamp');
      },
    });
  }

  // Add a mutation to the queue
  async enqueue(action) {
    const entry = {
      ...action,
      status: 'pending',
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3,
    };

    await this.db.add('outbox', entry);
    this.requestSync();
    return entry;
  }

  // Request background sync
  async requestSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('process-queue');
    } else {
      // Fallback: process immediately
      await this.processQueue();
    }
  }

  // Process all pending items
  async processQueue() {
    const pending = await this.db.getAllFromIndex('outbox', 'status', 'pending');

    for (const entry of pending) {
      try {
        await this.executeAction(entry);
        await this.db.put('outbox', { ...entry, status: 'completed' });
      } catch (error) {
        entry.retries += 1;
        if (entry.retries >= entry.maxRetries) {
          await this.db.put('outbox', { ...entry, status: 'failed' });
        } else {
          await this.db.put('outbox', entry);
        }
      }
    }
  }

  // Execute the actual network request
  async executeAction(entry) {
    const response = await fetch(entry.url, {
      method: entry.method,
      headers: entry.headers || { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry.body),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  // Get queue status
  async getStats() {
    const all = await this.db.getAll('outbox');
    return {
      pending: all.filter((e) => e.status === 'pending').length,
      completed: all.filter((e) => e.status === 'completed').length,
      failed: all.filter((e) => e.status === 'failed').length,
    };
  }

  // Clean up old completed entries
  async cleanup(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    const all = await this.db.getAll('outbox');

    for (const entry of all) {
      if (entry.status === 'completed' && entry.timestamp < cutoff) {
        await this.db.delete('outbox', entry.id);
      }
    }
  }
}
```

### Service Worker Sync Handler

```javascript
import { Queue } from 'workbox-background-sync';

const syncQueue = new Queue('offline-mutations', {
  maxRetentionTime: 60 * 24, // 24 hours
});

self.addEventListener('fetch', (event) => {
  if (event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(event.request.clone());
          return response;
        } catch (error) {
          await syncQueue.pushRequest({ request: event.request });
          return new Response(
            JSON.stringify({ queued: true, message: 'Saved for later sync' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
      })()
    );
  }
});
```

---

## Optimistic UI with Offline Sync

Update the UI immediately, sync in the background:

```javascript
class OptimisticSync {
  constructor(queue) {
    this.queue = queue;
    this.listeners = new Map();
  }

  // Add a todo optimistically
  async addTodo(todo) {
    const optimisticId = `temp-${Date.now()}`;

    // 1. Emit optimistic update
    this.emit('todo-added', { ...todo, id: optimisticId, _optimistic: true });

    // 2. Add to local DB
    const db = await openDB('todos', 1, {
      upgrade(db) {
        db.createObjectStore('todos', { keyPath: 'id' });
      },
    });
    await db.put('todos', { ...todo, id: optimisticId, synced: false });

    // 3. Queue for sync
    const entry = await this.queue.enqueue({
      url: '/api/todos',
      method: 'POST',
      body: todo,
    });

    return { optimisticId, queueEntry: entry };
  }

  // Handle sync result
  async onSyncResult(optimisticId, serverId, success) {
    const db = await openDB('todos');

    if (success) {
      // Replace temp ID with server ID
      await db.delete('todos', optimisticId);
      await db.put('todos', { id: serverId, synced: true });
      this.emit('todo-synced', { optimisticId, serverId });
    } else {
      // Mark as failed, show retry option
      await db.put('todos', { id: optimisticId, syncFailed: true });
      this.emit('todo-sync-failed', { optimisticId });
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach((cb) => cb(data));
  }
}
```

---

## Conflict Resolution Strategies

### Last Writer Wins (Simple)

```javascript
async function resolveConflict(local, remote) {
  // Simple: latest timestamp wins
  if (local.timestamp > remote.timestamp) {
    return local; // Local is newer
  }
  return remote; // Remote is newer (or equal)
}
```

### Server Wins

```javascript
async function resolveConflict(local, remote) {
  // Server always wins
  return remote;
}
```

### Client Wins

```javascript
async function resolveConflict(local, remote) {
  // Client always wins
  return local;
}
```

### Merge (Field-Level)

```javascript
async function mergeConflicts(local, remote) {
  const merged = { ...remote }; // Start with server state

  // Apply local changes that differ from the common ancestor
  for (const key of Object.keys(local)) {
    if (local[key] !== remote[key]) {
      // Use local value if it was modified more recently
      if (local._fieldTimestamps?.[key] > remote._fieldTimestamps?.[key]) {
        merged[key] = local[key];
      }
    }
  }

  return merged;
}
```

### Version Vector / Vector Clock

```javascript
// Each mutation carries a vector clock
const mutation = {
  data: { title: 'Updated Title' },
  vectorClock: { client1: 3, client2: 1 },
  baseVersion: { client1: 2, client2: 1 }, // Version at time of edit
};

async function resolveWithVectorClock(local, remote, base) {
  // Check for concurrent edits
  const localConcurrent = Object.keys(local.vectorClock).some(
    (k) => (local.vectorClock[k] || 0) > (base.vectorClock[k] || 0)
      && (remote.vectorClock[k] || 0) > (base.vectorClock[k] || 0)
  );

  if (!localConcurrent) {
    // No conflict -- one is descendant of the other
    return local.vectorClock.timestamp > remote.vectorClock.timestamp
      ? local : remote;
  }

  // True conflict -- need manual merge or custom resolution
  return mergeConflicts(local, remote);
}
```

---

## Network Status Detection

```javascript
class NetworkMonitor {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = [];

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notify('online');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notify('offline');
    });

    // Polling fallback for unreliable connections
    this.startPolling();
  }

  startPolling() {
    setInterval(async () => {
      try {
        const response = await fetch('/api/health', {
          method: 'HEAD',
          cache: 'no-store',
        });
        if (!this.isOnline) {
          this.isOnline = true;
          this.notify('online');
        }
      } catch {
        if (this.isOnline) {
          this.isOnline = false;
          this.notify('offline');
        }
      }
    }, 30000); // Check every 30 seconds
  }

  onStatusChange(callback) {
    this.listeners.push(callback);
  }

  notify(status) {
    this.listeners.forEach((cb) => cb(status));
  }
}
```

---

## Retry with Exponential Backoff

```javascript
async function retryWithBackoff(fn, { maxRetries = 5, baseDelay = 1000 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * delay * 0.1;
      await new Promise((r) => setTimeout(r, delay + jitter));
    }
  }
}

// Usage
await retryWithBackoff(() => fetch('/api/messages', {
  method: 'POST',
  body: JSON.stringify(message),
}));
```

---

## Complete Offline Sync Architecture

```
Page (Online/Offline)
  |
  +-- Optimistic UI Update (immediate)
  |
  +-- Write to IndexedDB (local persistence)
  |
  +-- Add to Outbox (sync queue)
  |
  +-- Request Background Sync
        |
        +-- Service Worker: process-queue event
              |
              +-- Read pending items from outbox
              +-- Execute network requests
              +-- On success: mark completed, notify page
              +-- On failure: retry with backoff, mark failed
```

---

## Best Practices

1. **Always save locally first.** Never depend on network for data persistence.
2. **Use optimistic UI.** Show the result immediately, sync silently.
3. **Queue with metadata.** Include timestamps, retry counts, and operation types.
4. **Handle conflicts explicitly.** Choose a resolution strategy per data type.
5. **Clean up completed entries.** Don't let the outbox grow unbounded.
6. **Provide visual feedback.** Show sync status (pending, syncing, failed).
7. **Test offline thoroughly.** Disable network at the OS level, not just DevTools.
8. **Handle partial connectivity.** Flaky connections are worse than no connection.
9. **Use exponential backoff.** Don't hammer the server on retry.
10. **Request persistent storage.** Prevent browser from evicting your outbox data.

---

**Sources:** MDN Web Docs, web.dev, Chrome Developers, Workbox documentation
