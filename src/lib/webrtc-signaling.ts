/**
 * WebRTC signaling layer backed by Supabase Realtime broadcast channels.
 *
 * Flow:
 *   1. Caller joins channel `call:{conversationId}`, sends a "ringing" event.
 *   2. Callee receives "ringing", accepts, joins the channel.
 *   3. Caller creates an SDP offer, broadcasts it.
 *   4. Callee creates an SDP answer, broadcasts it back.
 *   5. ICE candidates are exchanged through the same channel.
 *   6. Either side can hang up; the channel is torn down.
 */

import { getSupabase } from "@/lib/supabase/client";

export type SignalEvent =
  | { type: "ringing"; callerId: string; callerName: string; mode: "audio" | "video" }
  | { type: "accept"; calleeId: string }
  | { type: "offer"; sdp: string; senderId: string }
  | { type: "answer"; sdp: string; senderId: string }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit; senderId: string }
  | { type: "hangup"; senderId: string };

export type SignalCallbacks = {
  onRinging?: (callerId: string, callerName: string, mode: "audio" | "video") => void;
  onAccept?: (calleeId: string) => void;
  onOffer?: (sdp: string, senderId: string) => void;
  onAnswer?: (sdp: string, senderId: string) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit, senderId: string) => void;
  onHangup?: (senderId: string) => void;
};

/** Extract the senderId from any event that has one. */
function senderIdOf(evt: SignalEvent): string | undefined {
  if ("senderId" in evt) return evt.senderId;
  if (evt.type === "ringing") return evt.callerId;
  if (evt.type === "accept") return evt.calleeId;
  return undefined;
}

const channelName = (conversationId: string) => `call:${conversationId}`;

export function joinCallChannel(
  conversationId: string,
  userId: string,
  callbacks: SignalCallbacks,
): { send: (event: SignalEvent) => void; leave: () => void } {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  const name = channelName(conversationId);
  const channel = supabase.channel(name);

  channel
    .on("broadcast", { event: "signal" }, (payload: { payload: SignalEvent }) => {
      const evt = payload.payload;
      // Ignore our own broadcasts.
      const sender = senderIdOf(evt);
      if (sender === userId) return;

      switch (evt.type) {
        case "ringing":
          callbacks.onRinging?.(evt.callerId, evt.callerName, evt.mode);
          break;
        case "accept":
          callbacks.onAccept?.(evt.calleeId);
          break;
        case "offer":
          callbacks.onOffer?.(evt.sdp, evt.senderId);
          break;
        case "answer":
          callbacks.onAnswer?.(evt.sdp, evt.senderId);
          break;
        case "ice-candidate":
          callbacks.onIceCandidate?.(evt.candidate, evt.senderId);
          break;
        case "hangup":
          callbacks.onHangup?.(evt.senderId);
          break;
      }
    })
    .subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        // Channel is ready -- the caller can now broadcast "ringing".
      }
    });

  function send(event: SignalEvent) {
    channel.send({
      type: "broadcast",
      event: "signal",
      payload: event,
    });
  }

  function leave() {
    supabase!.removeChannel(channel);
  }

  return { send, leave };
}

/**
 * ICE server configuration. Uses Google's public STUN servers; TURN is not
 * included here because Supabase or a separate TURN server would be needed
 * for symmetric-NAT traversal in production.
 */
export const DEFAULT_ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};
