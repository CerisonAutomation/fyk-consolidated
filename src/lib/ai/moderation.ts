/**
 * AI Moderation — dual fast+deep — PRD 14.2
 * Fast path: distilbert ~26MB ~30ms
 * Deep path: Qwen3-0.6B-ONNX ~300MB ~2s
 * Categories: toxicity, harassment, hate_speech, sexual, violence, spam, self_harm
 */

export interface ModerationResult {
  flagged: boolean;
  categories: {
    toxicity: number;
    harassment: number;
    hate_speech: number;
    sexual: number;
    violence: number;
    spam: number;
    self_harm: number;
  };
  score: number;
  reason?: string;
}

// Fast path — distilbert-base-uncased ~26MB ~30ms
export async function moderateFast(content: string): Promise<ModerationResult> {
  const res = await fetch("/api/ai/moderate/fast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  
  const data = await res.json();
  
  // Threshold 0.7 as PRD
  const flagged = data.score > 0.7;
  
  return {
    flagged,
    categories: data.categories,
    score: data.score,
    reason: flagged ? data.reason : undefined,
  };
}

// Deep path — Qwen3-0.6B-ONNX ~300MB ~2s for ambiguous
export async function moderateDeep(content: string, context?: string): Promise<ModerationResult> {
  const res = await fetch("/api/ai/moderate/deep", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, context }),
  });
  
  const data = await res.json();
  
  return {
    flagged: data.flagged,
    categories: data.categories,
    score: data.score,
    reason: data.reason,
  };
}

// Dual path — fast first, deep if ambiguous 0.4-0.7
export async function moderateContent(content: string, context?: string): Promise<ModerationResult> {
  const fast = await moderateFast(content);
  
  // If fast score is ambiguous (0.4-0.7), run deep
  if (fast.score >= 0.4 && fast.score <= 0.7) {
    const deep = await moderateDeep(content, context);
    return deep;
  }
  
  return fast;
}

export async function checkUserInfractions(userId: string): Promise<{ count: number; shouldBlock: boolean }> {
  const res = await fetch(`/api/safety/infractions?userId=${userId}`);
  const data = await res.json();
  
  // Auto-block after 3 flags as PRD 4.2
  const shouldBlock = data.count >= 3;
  
  return {
    count: data.count,
    shouldBlock,
  };
}
