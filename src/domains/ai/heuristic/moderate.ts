/**
 * moderate.ts
 * 3-tier content moderation:
 *   HARD = threats, slurs, scams -> unsafe
 *   SOFT = 2+ profanity words -> unsafe
 *   NSFW = explicit keywords
 *   URL + click spam detection
 */

export type Verdict = "safe" | "unsafe" | "borderline";

export interface ModerationResult {
  verdict: Verdict;
  confidence: number;
  category?: string;
}

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

export function moderateContent(text: string): ModerationResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { verdict: "safe", confidence: 1.0 };

  if (countMatches(trimmed, HARD_THREATS) > 0) {
    return { verdict: "unsafe", confidence: 0.95, category: "threat" };
  }
  if (countMatches(trimmed, HARD_SLURS) > 0) {
    return { verdict: "unsafe", confidence: 0.98, category: "hate_speech" };
  }
  if (countMatches(trimmed, HARD_SCAMS) > 0) {
    return { verdict: "unsafe", confidence: 0.9, category: "scam" };
  }

  const softHits = countMatches(trimmed, SOFT_PROFANITY);
  if (softHits >= 2) {
    return { verdict: "unsafe", confidence: 0.85, category: "profanity" };
  }

  const spamHits = countMatches(trimmed, URL_CLICK_SPAM);
  if (spamHits >= 2) {
    return { verdict: "unsafe", confidence: 0.88, category: "spam" };
  }

  if (countMatches(trimmed, NSFW_KEYWORDS) > 0) {
    return { verdict: "borderline", confidence: 0.75, category: "nsfw" };
  }

  if (softHits === 1) {
    return { verdict: "borderline", confidence: 0.6, category: "profanity" };
  }

  if (spamHits === 1) {
    return { verdict: "borderline", confidence: 0.55, category: "spam" };
  }

  return { verdict: "safe", confidence: 0.9 };
}
