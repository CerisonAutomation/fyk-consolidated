# VAPID & Web Push — Production Patterns

## Overview
VAPID (Voluntary Application Server Identification) enables web push notifications without relying on a third-party service like Firebase Cloud Messaging.

## Key Concepts

### VAPID Keys
- **Public Key**: Shared with the browser during subscription (safe to expose)
- **Private Key**: Never leave the server (use env vars)
- **Subject**: Contact URL for push service (mailto: or https://)

### Flow
1. Client requests permission via `Notification.requestPermission()`
2. Client subscribes via `PushManager.subscribe()` with VAPID public key
3. Client sends subscription to server for storage
4. Server sends push via `web-push` library using VAPID private key

## Implementation

### Client-Side (Service Worker)
```typescript
// Register service worker
const registration = await navigator.serviceWorker.register('/sw.js');

// Request permission
const permission = await Notification.requestPermission();

// Subscribe to push
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
});

// Send subscription to server
await fetch('/api/push/subscribe', {
  method: 'POST',
  body: JSON.stringify(subscription),
  headers: { 'Content-Type': 'application/json' }
});
```

### Server-Side (Supabase Edge Function)
```typescript
import webPush from "https://esm.sh/web-push@3.6.7";

// Configure VAPID
webPush.setVapidDetails(
  'mailto:noreply@fyk.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Send push notification
const subscription = { endpoint, keys: { p256dh, auth } };
await webPush.sendNotification(subscription, JSON.stringify({
  title: 'New message',
  body: 'You have a new message from someone',
  href: '/chat/conversation-id'
}));
```

### Service Worker (sw.js)
```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      data: { href: data.href }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.href)
  );
});
```

## Best Practices

1. **Request timing**: Ask for permission after user engagement, not on page load
2. **Notification content**: Keep title < 50 chars, body < 120 chars
3. **Batch notifications**: Don't send per-event; batch for efficiency
4. **Handle expiration**: Detect 404/410 responses and delete stale subscriptions
5. **Respect preferences**: Let users control notification types
6. **Test across browsers**: Chrome, Firefox, Safari have different behaviors

## Supabase Integration

### Store Subscription
```sql
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### Edge Function
```typescript
// supabase/functions/notify/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webPush from "https://esm.sh/web-push@3.6.7";

serve(async (req) => {
  const { userId, title, body, href } = await req.json();
  
  // Get subscriptions
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);
  
  // Send to each
  for (const sub of subs) {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, href })
      );
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Stale subscription, remove it
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }
  
  return new Response(JSON.stringify({ sent: subs.length }));
});
```

## Environment Variables
```
VITE_VAPID_PUBLIC_KEY=<base64url public key>
VAPID_PRIVATE_KEY=<base64url private key>
VAPID_SUBJECT=mailto:noreply@fyk.app
```

## Generate VAPID Keys
```bash
npx web-push generate-vapid-keys
```
