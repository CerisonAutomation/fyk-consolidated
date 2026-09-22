/**
 * AI Auto-Reply — PRD 14.3
 * Generates contextual replies, rizz, wingman, icebreakers
 * Uses Qwen3-0.6B-ONNX + RAG memory
 */

export interface AutoReplyOptions {
  conversationId: string;
  profileId?: string;
  context: string;
  tone?: "friendly" | "flirty" | "casual" | "witty";
  count?: number;
}

export async function generateAutoReplies(options: AutoReplyOptions): Promise<string[]> {
  const res = await fetch("/api/ai/auto-reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...options,
      count: options.count ?? 3,
      tone: options.tone ?? "friendly",
    }),
  });
  
  const data = await res.json();
  return data.replies ?? [];
}

export async function generateIcebreakers(profileId: string, count = 3): Promise<string[]> {
  const res = await fetch("/api/ai/icebreakers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId, count }),
  });
  
  const data = await res.json();
  return data.icebreakers ?? [];
}

export async function generateRizzReply(message: string, profile?: unknown): Promise<string> {
  const res = await fetch("/api/ai/rizz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, profile }),
  });
  
  const data = await res.json();
  return data.reply ?? "";
}

export async function enhanceMessage(message: string): Promise<string> {
  // Photo enhancer, grammar, tone
  const res = await fetch("/api/ai/enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  
  const data = await res.json();
  return data.enhanced ?? message;
}
