/**
 * moderate.ts
 * Layered content moderation combining rule-based and ML-based detection.
 *
 * Production patterns per content-moderation.md:
 *   Layer 1: FAST RULE-BASED CHECKS (regex patterns)
 *     - threats, slurs, scams -> immediate unsafe
 *     - profanity threshold -> unsafe
 *     - URL + click spam -> unsafe
 *     - NSFW keywords -> borderline
 *
 *   Layer 2: ML TEXT ANALYSIS (Transformers.js toxicity-bert)
 *     - Toxicity score > 0.7 -> unsafe
 *     - Score 0.5-0.7 -> borderline (queue for review)
 *
 *   Layer 3: DECISION ENGINE
 *     - auto-block: High confidence violations (score > 0.9)
 *     - review: Uncertain cases (score 0.5-0.9)
 *     - auto-approve: High confidence safe (score < 0.5)
 *
 * Key principle: Run fast rules first, only invoke ML for borderline cases.
 * This matches the layered architecture from the docs.
 */

import { loadToxicityDetector, type MLError } from "../ml/bootstrap";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Verdict = "safe" | "unsafe" | "borderline";

export interface ModerationResult {
  verdict: Verdict;
  confidence: number;
  category?: string;
  /** Whether the ML model was used */
  source: "rules" | "ml" | "combined";
  /** ML toxicity score if available */
  mlScore?: number;
}

// ---------------------------------------------------------------------------
// Layer 1: Rule-based detection (fast, synchronous)
// ---------------------------------------------------------------------------

const HARD_THREATS = [
  /\b(kill|murder|shoot|stab|bomb|blow\s*up)\b/i,
  /\b(i'?ll\s*(find|get|hurt|destroy|ruin|end))\b/i,
  /\b(you'?re\s*dead|watch\s*your\s*back)\b/i,
  /\b(death\s*threat|murder)\b/i,
];

const HARD_SLURS = [
  /\b(faggot|fag|dyke|tranny|retard|retarded)\b/i,
  /\b(nigg[ae]r|chink|spic|wetback|kike)\b/i,
  /\b(coon|darkie|gook|towelhead|camel\s*jockey)\b/i,
];

const HARD_SCAMS = [
  /\b(sell\s*(me|you)\s*(nudes?|pics?|content|videos?))\b/i,
  /\b(cash\s*app|venmo|paypal|zelle|crypto|bitcoin|wire\s*transfer)\b.*\b(pay|send|money|invest)\b/i,
  /\b(only\s*fans|fansly|premium|paid\s*content|subscribe)\b.*\b(link|bio|dm|message)\b/i,
  /\b(send\s*\$|receive\s*\$|\$\d+|make\s*\$?\d+k?)\b/i,
  /\b(invest\s*now|double\s*your|guaranteed\s*return|passive\s*income)\b/i,
];

const SOFT_PROFANITY = [
  /\b(fuck|shit|damn|ass|bitch|crap|hell|dick|pussy|cock|tits)\b/i,
  /\b(dammit|goddamn|motherfucker|bastard|douche|prick)\b/i,
];

const NSFW_KEYWORDS = [
  /\b(nsfw|sex|nude|naked|dick|ass|tits|boobs|hard|wet|horny|cum|orgasm)\b/i,
  /\b(anal|oral|blowjob|handjob|titjob|facial)\b/i,
  /\b(threesome|group\s*sex|orgy|gangbang|bbc|bbw)\b/i,
  /\b(submissive|dominant|bdsm|bondage|spanking|whip)\b/i,
  /\b(condom|bareback|raw|breeding|creampie)\b/i,
];

const URL_CLICK_SPAM = [
  /https?:\/\/[^\s]{50,}/i,
  /\b(click\s*(here|now|this|link|below))\b/i,
  /\b(dm\s*(me|for)\s*(more|link|details|access))\b/i,
  /\b(follow\s*(my|me)\s*(link|bio|profile))\b/i,
  /\b(check\s*my\s*bio)\b/i,
  /\b(link\s*in\s*(bio|profile|comments))\b/i,
];

function countMatches(text: string, patterns: RegExp[]): number {
  let count = 0;
  for (const p of patterns) {
    if (p.test(text)) count++;
  }
  return count;
}

/**
 * Fast rule-based moderation check (Layer 1).
 * Returns null if no definitive verdict from rules alone,
 * meaning the text should proceed to ML analysis.
 */
function ruleBasedCheck(text: string): ModerationResult | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { verdict: "safe", confidence: 1.0, source: "rules" };

  // Hard blocks - immediate unsafe
  if (countMatches(trimmed, HARD_THREATS) > 0) {
    return { verdict: "unsafe", confidence: 0.95, category: "threat", source: "rules" };
  }
  if (countMatches(trimmed, HARD_SLURS) > 0) {
    return { verdict: "unsafe", confidence: 0.98, category: "hate_speech", source: "rules" };
  }
  if (countMatches(trimmed, HARD_SCAMS) > 0) {
    return { verdict: "unsafe", confidence: 0.9, category: "scam", source: "rules" };
  }

  // Profanity threshold
  const softHits = countMatches(trimmed, SOFT_PROFANITY);
  if (softHits >= 2) {
    return { verdict: "unsafe", confidence: 0.85, category: "profanity", source: "rules" };
  }

  // Spam detection
  const spamHits = countMatches(trimmed, URL_CLICK_SPAM);
  if (spamHits >= 2) {
    return { verdict: "unsafe", confidence: 0.88, category: "spam", source: "rules" };
  }

  // NSFW keywords -> borderline, needs ML review
  if (countMatches(trimmed, NSFW_KEYWORDS) > 0) {
    return null; // Let ML decide
  }

  // Single profanity or spam -> borderline, needs ML review
  if (softHits === 1 || spamHits === 1) {
    return null; // Let ML decide
  }

  // No signals from rules -> safe
  return { verdict: "safe", confidence: 0.9, source: "rules" };
}

// ---------------------------------------------------------------------------
// Layer 2: ML-based toxicity detection (async, heavier)
// ---------------------------------------------------------------------------

/**
 * ML-based toxicity detection using Transformers.js.
 *
 * Per docs: uses text-classification with Xenova/toxic-bert
 * for client-side toxicity scoring.
 */
async function mlToxicityCheck(
  text: string,
): Promise<{ score: number; label: string } | null> {
  try {
    const pipe = await Promise.race([
      loadToxicityDetector(),
      new Promise<null>((r) => setTimeout(() => r(null), 5_000)),
    ]);

    if (!pipe) return null;

    const result = await Promise.race([
      pipe(text),
      new Promise<null>((r) => setTimeout(() => r(null), 3_000)),
    ]);

    if (!result?.length) return null;

    // Find the toxic label
    const toxicResult = result.find((r: any) =>
      r.label?.toLowerCase().includes("toxic"),
    );
    const toxicScore = toxicResult?.score ?? 0;
    const label = toxicResult?.label ?? "safe";

    return { score: toxicScore, label };
  } catch (err) {
    const mlErr = err as MLError;
    if (mlErr.code === "TIMEOUT") {
      console.debug("[moderate] Toxicity model timeout");
    } else {
      console.debug("[moderate] Toxicity ML error:", mlErr.message ?? err);
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Layer 3: Decision engine
// ---------------------------------------------------------------------------

/**
 * Make final moderation decision based on combined signals.
 *
 * Per docs decision engine:
 *  - auto-block: score > 0.9
 *  - review: score 0.5-0.9
 *  - auto-approve: score < 0.5
 */
function makeDecision(
  ruleResult: ModerationResult | null,
  mlScore: number | null,
): ModerationResult {
  // If rules gave a definitive verdict, use it
  if (ruleResult && ruleResult.verdict !== "safe") {
    return ruleResult;
  }

  // If no ML score available, use rule result
  if (mlScore === null) {
    return ruleResult ?? { verdict: "safe", confidence: 0.8, source: "rules" };
  }

  // ML-based decision
  if (mlScore > 0.9) {
    return {
      verdict: "unsafe",
      confidence: 0.95,
      category: "toxicity",
      source: "ml",
      mlScore,
    };
  }

  if (mlScore > 0.7) {
    return {
      verdict: "unsafe",
      confidence: 0.85,
      category: "toxicity",
      source: "ml",
      mlScore,
    };
  }

  if (mlScore > 0.5) {
    return {
      verdict: "borderline",
      confidence: 0.6,
      category: "toxicity",
      source: "ml",
      mlScore,
    };
  }

  // ML says safe
  return {
    verdict: "safe",
    confidence: 0.85,
    source: "ml",
    mlScore,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Moderate content using layered approach: rules first, then ML if needed.
 *
 * Per content-moderation.md architecture:
 *   User Content -> Pre-Processing -> Rules -> AI -> Decision
 *
 * @param text - Content to moderate
 * @returns Moderation verdict with confidence and source
 */
export async function moderateContent(text: string): Promise<ModerationResult> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { verdict: "safe", confidence: 1.0, source: "rules" };
  }

  // Layer 1: Fast rule-based check
  const ruleResult = ruleBasedCheck(trimmed);

  // If rules gave a definitive verdict, return immediately
  if (ruleResult && ruleResult.verdict !== "safe") {
    return ruleResult;
  }

  // Layer 2: ML toxicity analysis
  const mlResult = await mlToxicityCheck(trimmed);

  // Layer 3: Decision engine
  const decision = makeDecision(ruleResult, mlResult?.score ?? null);

  // Log for monitoring
  if (decision.verdict !== "safe") {
    console.debug(
      `[moderate] Content flagged: verdict=${decision.verdict}, ` +
      `category=${decision.category}, confidence=${decision.confidence}, ` +
      `source=${decision.source}`,
    );
  }

  return decision;
}
