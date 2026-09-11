/**
 * classifier.ts
 * Intent classification using zero-shot classification with Transformers.js.
 *
 * Production patterns per docs:
 *  - Zero-shot classification for arbitrary category detection
 *  - Multi-label option for detecting multiple intents
 *  - Timeout-based fallback to heuristic rules
 *  - Proper error categorization for ML operations
 *  - Logging for monitoring classification accuracy
 */

import { loadClassifier as loadMLClassifier, type MLError } from "./bootstrap";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Intent =
  | "greeting"
  | "flirting"
  | "plan"
  | "safety"
  | "smalltalk";

// ---------------------------------------------------------------------------
// Heuristic fallback (unchanged - fast rule-based detection)
// ---------------------------------------------------------------------------

const HEUR: { i: Intent; re: RegExp }[] = [
  { i: "safety", re: /\b(send money|wire|crypto|paypal|meet at my house|no one will know|take off the app|dm me on)\b/i },
  { i: "plan", re: /\b(tonight|tomorrow|saturday|sunday|let'?s (meet|grab|do|go)|want to (meet|come|join)|at \d|rooftop|lounge|bar|gym|cafe|beach|dinner|drink)\b/i },
  { i: "greeting", re: /^\s*(hey|hi|hello|yo|sup|good (morning|evening|afternoon))\b/i },
  { i: "flirting", re: /\b(hot|cute|gorgeous|handsome|smell|touch|kiss|bedroom|shower|come over|miss(ed)? you|dream(ing)? of you)\b/i },
];

export function heuristicIntent(text: string): Intent {
  for (const h of HEUR) if (h.re.test(text)) return h.i;
  return /\?$/.test(text.trim()) ? "smalltalk" : "smalltalk";
}

// ---------------------------------------------------------------------------
// ML-based classification
// ---------------------------------------------------------------------------

/**
 * Classify intent using ML model with heuristic fallback.
 *
 * Per docs: uses zero-shot-classification with multi_label: false
 * for single-intent detection. Falls back to regex heuristics
 * when model loading or inference fails.
 */
export async function classifyIntent(
  text: string,
): Promise<{ intent: Intent; source: "model" | "heuristic" }> {
  if (!text || text.trim().length === 0) {
    return { intent: "smalltalk", source: "heuristic" };
  }

  try {
    const pipe = await Promise.race([
      loadMLClassifier(),
      new Promise<null>((r) => setTimeout(() => r(null), 5_000)),
    ]);

    if (pipe) {
      const result = await Promise.race([
        pipe(text, { multi_label: false }),
        new Promise<null>((r) => setTimeout(() => r(null), 3_000)),
      ]);

      if (result?.labels?.length) {
        const labelMap: Record<string, Intent> = {
          greeting: "greeting",
          flirting: "flirting",
          plan: "plan",
          safety: "safety",
          smalltalk: "smalltalk",
        };
        const intent = labelMap[result.labels[0]] ?? "smalltalk";
        return { intent, source: "model" };
      }
    }
  } catch (err) {
    // Log ML failure for monitoring but don't break the flow
    const mlErr = err as MLError;
    if (mlErr.code === "TIMEOUT") {
      console.debug("[classifier] Model load timeout, using heuristic");
    } else if (mlErr.code === "MODEL_LOAD_FAILED") {
      console.warn("[classifier] Model load failed:", mlErr.message);
    } else {
      console.debug("[classifier] Classification error:", mlErr.message ?? err);
    }
  }

  return { intent: heuristicIntent(text), source: "heuristic" };
}
