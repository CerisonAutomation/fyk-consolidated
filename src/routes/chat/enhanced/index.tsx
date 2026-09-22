import { createFileRoute } from "@tanstack/react-router";
import { ChatEnhancementsPanel } from "#/components/chat/enhanced/ChatEnhancements";
import { useState } from "react";

export const Route = createFileRoute("/chat/enhanced/")({
  component: ChatEnhancedPage,
});

function ChatEnhancedPage() {
  const [conversationId] = useState("00000000-0000-0000-0000-000000000001");
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Chat Enhancements</h1>
      <p className="text-sm text-muted-foreground">Pinned messages, ephemeral, scheduled send, screenshot protection, rewarded chat, broadcast — all persisted in DB</p>
      <ChatEnhancementsPanel conversationId={conversationId} />
    </div>
  );
}
