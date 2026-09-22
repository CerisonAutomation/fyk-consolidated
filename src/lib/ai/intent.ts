/**
 * AI Intent Detection — toxicity, harassment, hate_speech, sexual, violence, spam, self_harm
 * Calls edge function ai-intent-detect
 */

export type Intent = "toxicity" | "harassment" | "hate_speech" | "sexual" | "violence" | "spam" | "self_harm" | "benign";

export interface IntentResult {
  intent: Intent;
  confidence: number;
  categories: Record<Intent, number>;
}

export async function detectIntent(text: string): Promise<IntentResult> {
  const res = await fetch("/api/ai/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return res.json();
}

export async function detectToxicity(text: string): Promise<number> {
  const result = await detectIntent(text);
  return result.categories.toxicity ?? 0;
}
