/**
 * chat-health.ts
 * Analyzes chat health: balance, depth, curiosity, recency.
 * Returns 0-100 score with trend, flags, and suggestions.
 */

export interface ChatMessage {
  senderId: number;
  text: string;
  timestamp: number;
}

export interface ChatHealthResult {
  score: number;
  trend: "improving" | "stable" | "declining";
  flags: string[];
  suggestions: string[];
}

function computeBalance(messages: ChatMessage[]): number {
  if (messages.length === 0) return 0;

  const counts = new Map<number, number>();
  for (const msg of messages) {
    counts.set(msg.senderId, (counts.get(msg.senderId) ?? 0) + 1);
  }

  if (counts.size < 2) return 30;

  const values = [...counts.values()];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const ratio = max > 0 ? min / max : 0;

  return Math.round(ratio * 100);
}

function computeDepth(messages: ChatMessage[]): number {
  if (messages.length === 0) return 0;

  let totalWords = 0;
  for (const msg of messages) {
    totalWords += msg.text.split(/\s+/).length;
  }

  const avgWords = totalWords / messages.length;
  if (avgWords >= 20) return 100;
  if (avgWords >= 15) return 80;
  if (avgWords >= 10) return 60;
  if (avgWords >= 5) return 40;
  return 20;
}

function computeCuriosity(messages: ChatMessage[]): number {
  if (messages.length === 0) return 0;

  let questionCount = 0;
  for (const msg of messages) {
    if (msg.text.includes("?")) questionCount++;
  }

  const ratio = questionCount / messages.length;
  if (ratio >= 0.4) return 100;
  if (ratio >= 0.3) return 80;
  if (ratio >= 0.2) return 60;
  if (ratio >= 0.1) return 40;
  return 20;
}

function computeRecency(messages: ChatMessage[]): number {
  if (messages.length === 0) return 0;

  const now = Date.now();
  const lastMsg = messages[messages.length - 1]!;
  const daysSince = (now - lastMsg.timestamp) / (1000 * 60 * 60 * 24);

  if (daysSince <= 1) return 100;
  if (daysSince <= 2) return 80;
  if (daysSince <= 3) return 60;
  if (daysSince <= 7) return 40;
  return 20;
}

function detectTrend(messages: ChatMessage[]): "improving" | "stable" | "declining" {
  if (messages.length < 6) return "stable";

  const midpoint = Math.floor(messages.length / 2);
  const firstHalf = messages.slice(0, midpoint);
  const secondHalf = messages.slice(midpoint);

  const firstBalance = computeBalance(firstHalf);
  const secondBalance = computeBalance(secondHalf);

  const diff = secondBalance - firstBalance;

  if (diff > 10) return "improving";
  if (diff < -10) return "declining";
  return "stable";
}

function detectFlags(
  balance: number,
  depth: number,
  curiosity: number,
  recency: number,
  messages: ChatMessage[],
): string[] {
  const flags: string[] = [];

  if (balance < 30) flags.push("unbalanced_conversation");
  if (depth < 30) flags.push("shallow_conversation");
  if (curiosity < 30) flags.push("low_curiosity");
  if (recency < 30) flags.push("dying_chat");

  const textMsgs = messages.filter(
    (m) => typeof m.text === "string" && m.text.trim().length > 0,
  );
  if (textMsgs.length > 0) {
    const avgLen =
      textMsgs.reduce((sum, m) => sum + m.text.length, 0) / textMsgs.length;
    if (avgLen < 5) flags.push("one_word_replies");
  }

  if (messages.length > 10 && messages.length < 20) {
    const lastFive = messages.slice(-5);
    const allSame = lastFive.every((m) => m.senderId === lastFive[0]!.senderId);
    if (allSame) flags.push("one_sided_lately");
  }

  return flags;
}

function suggestActions(flags: string[]): string[] {
  const suggestions: string[] = [];

  if (flags.includes("unbalanced_conversation")) {
    suggestions.push("Ask more questions to balance the conversation");
  }
  if (flags.includes("shallow_conversation")) {
    suggestions.push("Try sharing something more personal or ask deeper questions");
  }
  if (flags.includes("low_curiosity")) {
    suggestions.push("Show genuine interest by asking about their life");
  }
  if (flags.includes("dying_chat")) {
    suggestions.push("Send a message to reconnect before the chat dies");
  }
  if (flags.includes("one_word_replies")) {
    suggestions.push("Try longer, more engaging responses");
  }
  if (flags.includes("one_sided_lately")) {
    suggestions.push("Give them space to respond; don't over-message");
  }

  if (suggestions.length === 0) {
    suggestions.push("Keep up the great conversation!");
  }

  return suggestions;
}

export function analyzeChatHealth(messages: ChatMessage[]): ChatHealthResult {
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  const balance = computeBalance(sorted);
  const depth = computeDepth(sorted);
  const curiosity = computeCuriosity(sorted);
  const recency = computeRecency(sorted);

  const score = Math.round(balance * 0.3 + depth * 0.25 + curiosity * 0.25 + recency * 0.2);
  const trend = detectTrend(sorted);
  const flags = detectFlags(balance, depth, curiosity, recency, sorted);
  const suggestions = suggestActions(flags);

  return {
    score: Math.max(0, Math.min(100, score)),
    trend,
    flags,
    suggestions,
  };
}
