/**
 * AI Summarizer — PRD 14.6
 * Summarizes conversations, profiles, events
 */

export async function summarizeConversation(conversationId: string): Promise<string> {
  const res = await fetch(`/api/ai/summarize/conversation?conversationId=${conversationId}`);
  const data = await res.json();
  return data.summary ?? "";
}

export async function summarizeProfile(profileId: string): Promise<string> {
  const res = await fetch(`/api/ai/summarize/profile?profileId=${profileId}`);
  const data = await res.json();
  return data.summary ?? "";
}

export async function summarizeMessages(messages: string[]): Promise<string> {
  const res = await fetch("/api/ai/summarize/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  
  const data = await res.json();
  return data.summary ?? "";
}

export async function generateProfileInsights(profileId: string): Promise<{ strengths: string[]; suggestions: string[]; score: number }> {
  const res = await fetch(`/api/ai/insights?profileId=${profileId}`);
  const data = await res.json();
  return data.insights ?? { strengths: [], suggestions: [], score: 0 };
}
