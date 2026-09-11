# WebRTC Video Calls — Production Patterns

## Architecture

### Components
1. **Signaling** — Exchange SDP offers/answers and ICE candidates
2. **Peer Connection** — WebRTC RTCPeerConnection for media
3. **Media** — getUserMedia for local camera/mic
4. **TURN/STUN** — Relay servers for NAT traversal

### Supabase Realtime Signaling
```typescript
// Join call channel
const channel = supabase.channel(`call:${conversationId}`);

// Listen for signaling events
channel.on('broadcast', { event: 'offer' }, ({ payload }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  channel.send({ type: 'broadcast', event: 'answer', payload: answer });
});

channel.on('broadcast', { event: 'ice-candidate' }, ({ payload }) => {
  await peerConnection.addIceCandidate(new RTCIceCandidate(payload));
});

// Create and send offer
const offer = await peerConnection.createOffer();
await peerConnection.setLocalDescription(offer);
channel.send({ type: 'broadcast', event: 'offer', payload: offer });
```

### STUN/TURN Configuration
```typescript
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // TURN server for production
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'user',
      credential: 'pass'
    }
  ]
};
```

## Implementation

### Client Setup
```typescript
const peerConnection = new RTCPeerConnection(rtcConfig);

// Add local tracks
const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

// Handle remote stream
peerConnection.ontrack = (event) => {
  remoteVideo.srcObject = event.streams[0];
};

// ICE candidate handling
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    channel.send({ type: 'broadcast', event: 'ice-candidate', payload: event.candidate });
  }
};
```

### Call State Management
```typescript
type CallState = {
  personId: string;
  mode: 'audio' | 'video';
  status: 'ringing' | 'connected' | 'ended';
  conversationId: string;
  startedAt: number;
};
```

## Best Practices

1. **Always use TURN** — Don't rely on peer-to-peer; use TURN relay for reliability
2. **Handle disconnection** — Detect `iceConnectionState === 'failed'` and retry
3. **Mute by default** — Start with audio muted, video optional
4. **Screen sharing** — Use `getDisplayMedia()` for screen share
5. **Call quality** — Monitor `getStats()` for quality metrics
6. **Cleanup** — Always close peer connection and stop tracks on hangup

## Supabase Integration

### Call Channel
```typescript
// Join call channel
const callChannel = supabase.channel(`call:${conversationId}`, {
  config: { presence: { key: userId } }
});

// Track presence
callChannel.track({ userId, status: 'connected' });

// Detect when peer leaves
callChannel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
  // Peer disconnected
  endCall();
});
```

### Database Schema
```sql
CREATE TABLE calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id),
  caller_id uuid REFERENCES users(id),
  callee_id uuid REFERENCES users(id),
  status text DEFAULT 'ringing',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  duration_seconds int
);
```
