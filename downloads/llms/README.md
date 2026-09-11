# FYK Documentation Library

Production-ready documentation for all stack components.

## Stack Documentation

### Core
- **Supabase** - Database, Auth, Realtime, Storage, Edge Functions
- **Prisma** - ORM, Schema, Migrations
- **TanStack Router** - File-based routing, type-safe navigation
- **TanStack Query** - Server state, caching, mutations
- **Zustand** - Client state management

### UI
- **React 19** - Components, Hooks, Server Components
- **Tailwind CSS 4** - Utility-first styling
- **shadcn/ui** - Accessible component primitives

### AI
- **ONNX Runtime** - On-device ML inference
- **Hugging Face Transformers** - Embeddings, classification

### Real-time
- **WebRTC** - Peer-to-peer video/audio calls
- **Supabase Realtime** - Presence, broadcast, database changes

### Maps
- **MapLibre GL** - Vector map rendering
- **PostGIS** - Geospatial queries
- **H3** - Hexagonal spatial indexing

### Payments
- **Stripe** - Subscription management
- **Consumables** - In-app purchases

### PWA
- **Serwist** - Service worker, offline support
- **Capacitor** - Native mobile deployment

## Key Patterns

### Tap-to-Chat (Not Swipes)
- Grid-based browse with tap to view profile
- Direct messaging without mutual match gate
- Online status via presence tracking

### Grid Browse
- 2-4 column thumbnail grid
- Infinite scroll with cursor pagination
- Online indicators, distance bucketing
- Filters: age, distance, tribe, body type

### Map View
- Vector tiles with user pins
- Cluster aggregation at zoom levels
- Venue check-ins
- Travel mode for pre-arrival browsing

### Safety
- Block/bidirectional exclusion via RLS
- Report with evidence collection
- AI content moderation
- Safety check-in with emergency contact

### Real-time Chat
- Optimistic UI with server reconciliation
- Typing indicators via broadcast
- Read receipts via database column
- Media sharing with signed URLs
- E2E encryption via X25519 + AES-GCM

### Push Notifications
- Web Push via VAPID credentials
- VoIP push for video calls
- Granular notification preferences
- Batch nearby-user alerts

## Supabase Architecture

| Component | Service | Pattern |
|-----------|---------|---------|
| User profiles | PostgreSQL | RLS-gated, PostGIS spatial |
| Proximity queries | PostGIS | ST_DWithin, distance bucketing |
| Online presence | Realtime Presence | TTL heartbeat |
| Chat messages | PostgreSQL + Realtime | postgres_changes subscription |
| Typing indicators | Realtime Broadcast | No DB writes, client-side expiry |
| Read receipts | Column + Broadcast | read_at + broadcast event |
| Block/report | RLS | Exclusion via policy joins |
| Photo moderation | Edge Functions | Pre-upload scan |
| Push notifications | Edge Functions | DB trigger → Edge → Push API |
| Video calls | WebRTC + Broadcast | TURN relay for IP masking |
| Map data | PostGIS + MapLibre | ST_ClusterDBSCAN or H3 |
