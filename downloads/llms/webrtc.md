# WebRTC API - Documentation

**Docs:** https://webrtc.org/getting-started/peer-connections, https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection

## Overview

WebRTC (Web Real-Time Communication) enables peer-to-peer communication for video, audio, and arbitrary data between browsers and devices.

## Core Concepts

- **RTCPeerConnection**: Represents a connection between local and remote peer
- **ICE (Interactive Connectivity Establishment)**: Protocol for NAT traversal
- **STUN**: Session Traversal Utilities for NAT - discovers public IP
- **TURN**: Traversal Using Relay NAT - relay server for restrictive networks
- **SDP (Session Description Protocol)**: Describes media capabilities
- **Signaling**: Exchange of SDP and ICE candidates (not part of WebRTC spec)

## RTCPeerConnection Setup

```typescript
// Configuration with ICE servers
const configuration: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'user',
      credential: 'password',
    },
  ],
  iceCandidatePoolSize: 10,
}

const peerConnection = new RTCPeerConnection(configuration)
```

## Complete Call Flow

### Caller Side

```typescript
async function makeCall() {
  const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  }

  const peerConnection = new RTCPeerConnection(configuration)

  // Add local tracks
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  })
  stream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, stream)
  })

  // Handle remote stream
  peerConnection.ontrack = (event) => {
    const [remoteStream] = event.streams
    document.getElementById('remoteVideo')!.srcObject = remoteStream
  }

  // Create and send offer
  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)

  // Send offer to remote peer via signaling
  signalingChannel.send({ offer: peerConnection.localDescription })

  // Handle answer from remote peer
  signalingChannel.addEventListener('message', async (message) => {
    if (message.answer) {
      const remoteDesc = new RTCSessionDescription(message.answer)
      await peerConnection.setRemoteDescription(remoteDesc)
    }
  })

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      signalingChannel.send({ iceCandidate: event.candidate })
    }
  }

  // Add remote ICE candidates
  signalingChannel.addEventListener('message', async (message) => {
    if (message.iceCandidate) {
      try {
        await peerConnection.addIceCandidate(message.iceCandidate)
      } catch (e) {
        console.error('Error adding ICE candidate:', e)
      }
    }
  })

  // Monitor connection state
  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState)
    if (peerConnection.connectionState === 'connected') {
      console.log('Peers connected!')
    }
  }
}
```

### Receiver Side

```typescript
async function answerCall() {
  const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  }

  const peerConnection = new RTCPeerConnection(configuration)

  // Add local tracks
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  })
  stream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, stream)
  })

  // Handle remote stream
  peerConnection.ontrack = (event) => {
    const [remoteStream] = event.streams
    document.getElementById('remoteVideo')!.srcObject = remoteStream
  }

  // Handle incoming offer
  signalingChannel.addEventListener('message', async (message) => {
    if (message.offer) {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(message.offer)
      )

      // Create answer
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)

      // Send answer to caller
      signalingChannel.send({ answer: peerConnection.localDescription })
    }
  })

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      signalingChannel.send({ iceCandidate: event.candidate })
    }
  }

  signalingChannel.addEventListener('message', async (message) => {
    if (message.iceCandidate) {
      try {
        await peerConnection.addIceCandidate(message.iceCandidate)
      } catch (e) {
        console.error('Error adding ICE candidate:', e)
      }
    }
  })
}
```

## ICE Candidate Handling (Trickle ICE)

```typescript
// Gather and send ICE candidates as they're discovered
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    signalingChannel.send({
      type: 'ice-candidate',
      candidate: event.candidate,
    })
  }
}

// Add received ICE candidates
peerConnection.onicecandidateerror = (event) => {
  console.error('ICE candidate error:', event)
}

// Monitor ICE gathering state
peerConnection.onicegatheringstatechange = () => {
  console.log('ICE gathering state:', peerConnection.iceGatheringState)
  // 'new' | 'gathering' | 'complete'
}
```

## Connection State Monitoring

```typescript
peerConnection.onconnectionstatechange = () => {
  console.log('Connection state:', peerConnection.connectionState)
  // 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed'
}

peerConnection.onsignalingstatechange = () => {
  console.log('Signaling state:', peerConnection.signalingState)
  // 'stable' | 'have-local-offer' | 'have-remote-offer' | etc.
}

peerConnection.oniceconnectionstatechange = () => {
  console.log('ICE connection state:', peerConnection.iceConnectionState)
  // 'new' | 'checking' | 'connected' | 'completed' | 'failed' | 'disconnected' | 'closed'
}
```

## DataChannel

```typescript
// Create data channel
const dataChannel = peerConnection.createDataChannel('myChannel', {
  ordered: true, // guarantee order
  maxRetransmits: 3,
})

dataChannel.onopen = () => {
  console.log('Data channel open')
  dataChannel.send('Hello from caller!')
}

dataChannel.onmessage = (event) => {
  console.log('Received:', event.data)
}

dataChannel.onclose = () => {
  console.log('Data channel closed')
}

// Handle incoming data channel (receiver side)
peerConnection.ondatachannel = (event) => {
  const channel = event.channel
  channel.onmessage = (e) => console.log('Received:', e.data)
  channel.send('Hello from receiver!')
}
```

## Media Handling

```typescript
// Get user media with constraints
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: 'user',
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
  },
})

// Add tracks to peer connection
const senders = stream.getTracks().map((track) =>
  peerConnection.addTrack(track, stream)
)

// Replace track (e.g., switch camera)
const newStream = await navigator.mediaDevices.getUserMedia({ video: true })
const newTrack = newStream.getVideoTracks()[0]
await senders[0].replaceTrack(newTrack)

// Stop a track
stream.getTracks().forEach((track) => track.stop())

// Handle renegotiation
peerConnection.onnegotiationneeded = async () => {
  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)
  signalingChannel.send({ offer: peerConnection.localDescription })
}
```

## ICE Restart

```typescript
// Restart ICE when connection fails
async function restartIce() {
  const offer = await peerConnection.createOffer({ iceRestart: true })
  await peerConnection.setLocalDescription(offer)
  signalingChannel.send({ offer: peerConnection.localDescription })
}
```

## TypeScript Types

```typescript
interface RTCConfiguration {
  iceServers?: RTCIceServer[]
  iceCandidatePoolSize?: number
  bundlePolicy?: RTCBundlePolicy
  certificates?: RTCCertificate[]
  iceCandidatePoolSize?: number
}

interface RTCIceServer {
  urls: string | string[]
  username?: string
  credential?: string
  credentialType?: RTCIceCredentialType
}

// SDP types
type RTCSdpType = 'offer' | 'pranswer' | 'answer' | 'rollback'

// Connection states
type RTCPeerConnectionState =
  | 'closed'
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'failed'
  | 'new'
```

## Error Handling

```typescript
try {
  const pc = new RTCPeerConnection(configuration)

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'failed') {
      console.error('ICE connection failed')
      restartIce()
    }
  }

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') {
      console.error('Connection failed')
      pc.close()
    }
  }
} catch (error) {
  console.error('Failed to create peer connection:', error)
}
```

## Cleanup

```typescript
function cleanup() {
  // Stop all tracks
  localStream?.getTracks().forEach((track) => track.stop())

  // Close peer connection
  peerConnection?.close()

  // Remove event listeners
  // Disconnect signaling channel
}
```

## Key Patterns

1. Always provide both STUN and TURN servers in configuration
2. Use trickle ICE for faster connection setup
3. Monitor connection states for error recovery
4. Handle renegotiation via `onnegotiationneeded`
5. Always clean up tracks and connections when done
6. Use `iceRestart` to recover from failed connections
7. For production, use a TURN server for reliable connectivity
8. Signaling is application-specific (WebSocket, Socket.IO, etc.)
