# Supabase Realtime Patterns

> Practical implementation patterns for Supabase Realtime: Broadcast, Presence, and Postgres Changes.
> Sources: supabase.com/docs/guides/realtime, supabase.com/docs/guides/realtime/presence, community guides.

---

## Overview

Supabase Realtime provides three core features:

| Feature | Use Case | Delivery |
|---------|----------|----------|
| **Broadcast** | Low-latency peer-to-peer messages (cursors, drawing, gaming) | No persistence, fire-and-forget |
| **Presence** | Track synchronized state (online status, active document) | State synced through server |
| **Postgres Changes** | Push database mutations to clients in real-time | Debezium-based CDC |

**When to use which:**
- **Broadcast** for chat, cursor tracking, game events, custom notifications
- **Presence** for online/offline status, typing indicators, active user lists
- **Postgres Changes** for auto-updating lists when DB rows change

---

## 1. Broadcast Patterns

### Basic Broadcast Messaging

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Subscribe to a channel and listen for broadcast events
const channel = supabase.channel('room-1')

channel
  .on('broadcast', { event: 'message' }, (payload) => {
    console.log('Received:', payload)
  })
  .subscribe()

// Send a broadcast message
await channel.send({
  type: 'broadcast',
  event: 'message',
  payload: { text: 'Hello everyone!', userId: 'user-1' },
})
```

### Realtime Cursor Tracking (Broadcast)

```typescript
const channel = supabase.channel('cursors')

// Listen for cursor movements from other users
channel
  .on('broadcast', { event: 'cursor-move' }, (payload) => {
    updateCursorPosition(payload.payload.userId, payload.payload.x, payload.payload.y)
  })
  .subscribe()

// Broadcast cursor position on mouse move (throttle to ~30fps)
let lastBroadcast = 0
document.addEventListener('mousemove', (e) => {
  const now = Date.now()
  if (now - lastBroadcast > 33) { // ~30fps
    channel.send({
      type: 'broadcast',
      event: 'cursor-move',
      payload: { userId: currentUser.id, x: e.clientX, y: e.clientY },
    })
    lastBroadcast = now
  }
})
```

### Broadcast with Authorization

```typescript
// Server-side: Enable realtime authorization in your Supabase project
// Broadcast and Presence now support authorization (Public Beta)

const channel = supabase.channel('authenticated-room', {
  config: {
    broadcast: { self: false }, // Don't echo own messages back
  },
})
```

### Database-Triggered Broadcast

```sql
-- Broadcast from a database trigger using pg_notify
CREATE OR REPLACE FUNCTION broadcast_change()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'realtime',
    json_build_object(
      'event', 'broadcast',
      'channel', 'db-changes',
      'payload', row_to_json(NEW)
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 2. Presence Patterns

### Basic Presence Tracking

```typescript
const channel = supabase.channel('room_01')

// Listen for presence events
channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    console.log('All online users:', state)
    renderOnlineUsers(state)
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    console.log('User joined:', key, newPresences)
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    console.log('User left:', key, leftPresences)
  })
  .subscribe(async (status) => {
    if (status !== 'SUBSCRIBED') return

    // Track this client's presence
    await channel.track({
      userId: currentUser.id,
      username: currentUser.username,
      online_at: new Date().toISOString(),
    })
  })
```

### Presence with Custom Key

```typescript
const channel = supabase.channel('team-room', {
  config: {
    presence: {
      key: `user-${currentUser.id}`, // Custom unique key
    },
  },
})

channel.subscribe(async (status) => {
  if (status !== 'SUBSCRIBED') return

  await channel.track({
    userId: currentUser.id,
    status: 'active',
    cursor: null,
  })
})
```

### Online Status Dashboard

```typescript
function OnlineStatusPanel() {
  const [users, setUsers] = useState({})

  useEffect(() => {
    const channel = supabase.channel('online-users')

    channel
      .on('presence', { event: 'sync' }, () => {
        setUsers(channel.presenceState())
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return
        await channel.track({
          userId: user.id,
          status: 'online',
          lastSeen: new Date().toISOString(),
        })
      })

    // Cleanup: untrack when component unmounts
    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div>
      <h3>Online ({Object.keys(users).length})</h3>
      {Object.entries(users).map(([key, presences]) => (
        <div key={key}>{presences[0].userId}</div>
      ))}
    </div>
  )
}
```

### Important: Presence Limitations

- **Not for high-frequency updates** -- calling `track()` rapidly floods the channel
- Use **Broadcast** for high-frequency updates like cursor positions
- Best suited for slow-changing state: online/offline status, active document, current page
- During `sync` events, you may receive simultaneous `join`/`leave` events (state reconciliation, not real user movement)

---

## 3. Postgres Changes Patterns

### Listen to Database Changes

```typescript
const channel = supabase
  .channel('db-changes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'messages' },
    (payload) => {
      console.log('Change received:', payload.eventType, payload.new)
      // eventType: 'INSERT', 'UPDATE', 'DELETE'
    }
  )
  .subscribe()
```

### Filtered Postgres Changes

```typescript
// Listen only to changes for a specific user
const channel = supabase
  .channel('user-messages')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `room_id=eq.${roomId}`, // Filter by column value
    },
    (payload) => {
      addMessage(payload.new)
    }
  )
  .subscribe()
```

### Postgres Changes with RLS

```sql
-- Postgres Changes respects RLS policies
-- Only changes visible to the current user's role are sent
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see messages in their rooms"
  ON messages FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM room_members
      WHERE user_id = auth.uid()
    )
  );
```

---

## 4. Combined Patterns

### Chat Application with Typing Indicators

```typescript
function ChatRoom({ roomId }) {
  const [messages, setMessages] = useState([])
  const [typingUsers, setTypingUsers] = useState([])

  useEffect(() => {
    // 1. Postgres Changes for persistent messages
    const dbChannel = supabase
      .channel(`chat-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => setMessages((prev) => [...prev, payload.new])
      )
      .subscribe()

    // 2. Broadcast for typing indicators (ephemeral)
    const typingChannel = supabase.channel(`typing-${roomId}`)
    typingChannel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        setTypingUsers((prev) => {
          const filtered = prev.filter((u) => u.userId !== payload.userId)
          return [...filtered, { userId: payload.userId, username: payload.username }]
        })
        // Remove after 3 seconds
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId))
        }, 3000)
      })
      .subscribe()

    // 3. Presence for online users
    const presenceChannel = supabase.channel(`presence-${roomId}`)
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        // Update online user list
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ userId: user.id, online_at: new Date().toISOString() })
        }
      })

    return () => {
      supabase.removeChannel(dbChannel)
      supabase.removeChannel(typingChannel)
      supabase.removeChannel(presenceChannel)
    }
  }, [roomId])

  // Send typing indicator (throttled)
  const handleTyping = throttle(() => {
    const channel = supabase.channel(`typing-${roomId}`)
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id, username: user.username },
    })
  }, 2000)

  return { messages, typingUsers }
}
```

---

## 5. Performance Best Practices

| Pattern | Do | Don't |
|---------|-----|-------|
| Cursor tracking | Use Broadcast | Use Presence |
| Online status | Use Presence | Poll database |
| DB sync | Use Postgres Changes | Poll with intervals |
| Typing indicators | Use Broadcast with throttle | Broadcast every keystroke |
| Presence payloads | Keep small (< 1KB) | Store large objects |

### Channel Cleanup

```typescript
// Always clean up channels when done
useEffect(() => {
  const channel = supabase.channel('my-channel')
  // ... setup
  return () => {
    supabase.removeChannel(channel)
  }
}, [])
```

### Throttling Broadcast Events

```typescript
// Throttle high-frequency broadcasts
const throttledBroadcast = throttle((event, payload) => {
  channel.send({ type: 'broadcast', event, payload })
}, 50) // 50ms = 20fps max

document.addEventListener('mousemove', (e) => {
  throttledBroadcast('cursor', { x: e.clientX, y: e.clientY })
})
```

---

## 6. Deployment Checklist

1. Enable Realtime on specific tables in Dashboard > Database > Replication
2. Enable Realtime for Broadcast/Presence in Dashboard > Realtime
3. Set up RLS policies for Postgres Changes to respect user permissions
4. Use separate channels for different features (messages, typing, presence)
5. Always clean up channels on component unmount
6. Throttle high-frequency broadcasts to avoid flooding

---

*References:*
- https://supabase.com/docs/guides/realtime
- https://supabase.com/docs/guides/realtime/presence
- https://github.com/supabase/supabase/blob/master/examples/prompts/use-realtime.md
- https://tomodahinata.com/en/blog/supabase-realtime-broadcast-presence-postgres-changes-production-implementation-guide
