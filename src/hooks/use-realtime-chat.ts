"use client";
import { useEffect, useCallback } from "react";
import { getRealtime } from "../integrations/supabase/realtime";

export function useRealtimeChat(conversationId: string, onMessage: (msg: any) => void, onTyping?: (userId: string, typing: boolean) => void) {
  useEffect(() => {
    if (!conversationId) return;
    const rt = getRealtime();
    const unsub = rt.subscribeToConversation(conversationId, onMessage, onTyping);
    return () => unsub();
  }, [conversationId, onMessage, onTyping]);

  const sendTyping = useCallback((userId: string, isTyping: boolean) => {
    if (!conversationId) return;
    getRealtime().broadcastTyping(conversationId, userId, isTyping);
  }, [conversationId]);

  return { sendTyping };
}
