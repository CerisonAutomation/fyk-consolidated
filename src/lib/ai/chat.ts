/**
 * AI Chat — Qwen3-0.6B-ONNX + RAG
 * PRD 14.3
 */

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function chat(messages: ChatMessage[], options?: { userId?: string; useRAG?: boolean }): Promise<string> {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, ...options }),
  });
  const data = await res.json();
  return data.response ?? "";
}

export async function chatWithMemory(userId: string, message: string): Promise<string> {
  // RAG + memory
  const res = await fetch("/api/ai/chat/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, message }),
  });
  const data = await res.json();
  return data.response ?? "";
}
