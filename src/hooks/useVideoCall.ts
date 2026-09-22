import { useState, useCallback, useRef } from "react";

export function useVideoCall(conversationId: string) {
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  const startCall = useCallback(async () => {
    setIsInCall(true);
    // WebRTC signaling via Supabase Realtime
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localRef.current) localRef.current.srcObject = stream;
  }, []);

  const endCall = useCallback(() => {
    setIsInCall(false);
    // Cleanup
  }, []);

  const toggleMute = useCallback(() => setIsMuted((m) => !m), []);
  const toggleVideo = useCallback(() => setIsVideoOff((v) => !v), []);

  return { isInCall, isMuted, isVideoOff, localRef, remoteRef, startCall, endCall, toggleMute, toggleVideo, conversationId };
}
