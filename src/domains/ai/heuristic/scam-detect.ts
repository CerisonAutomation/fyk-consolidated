/**
 * scam-detect.ts
 * Detects chatfishing: off-platform push, financial language,
 * classic backstories, templated lengths.
 */

export interface ScamMessage {
  text: string;
  senderId: number;
}

export interface ScamResult {
  score: number;
  signals: string[];
}

const OFF_PLATFORM_PUSH = [
  /\b(whatsapp|telegram|signal|snapchat|kik|discord|zoom|skype)\b/i,
  /\b(instagram|tiktok|onlyfans|fansly|twitter|x\.com)\b/i,
  /\b(give me your|what'?s your|add me on|follow me on|dm me on)\b/i,
  /\b(my (phone|number|email|contact))\b/i,
  /\b(let'?s move (to|off|away)|get off (this|the) app|not on here)\b/i,
  /\b(can we text|text me|call me|facetime)\b/i,
];

const FINANCIAL_LANGUAGE = [
  /\b(money|cash|dollar|pay|send|invest|crypto|bitcoin|wire|transfer)\b/i,
  /\b(venmo|cashapp|cash\s*app|paypal|zelle|gift\s*card|apple\s*pay)\b/i,
  /\b(make\s*\$|earn\s*\$|\$\d+|income|fortune|wealth)\b/i,
  /\b(invest|investment|portfolio|stock|trading|forex)\b/i,
  /\b(borrow|loan|owe|debt|credit|bank|account)\b/i,
  /\b(send me|wire me|deposit|withdraw)\b.*\b(money|cash|funds)\b/i,
];

const CLASSIC_BACKSTORIES = [
  /\b(military|deployed|overseas|abroad|far away|out of town)\b/i,
  /\b(oil rig|offshore|rigger|engineer)\b.*\b(worker|job|contract)\b/i,
  /\b(widow|orphan|single parent|sick (mom|dad|parent|relative))\b/i,
  /\b(lost my|my .* died|funeral|hospital)\b/i,
  /\b(trapped|stuck|stranded|no access|can't leave)\b/i,
  /\b(secret|classified|confidential|undercover|agent)\b/i,
];

const TEMPLATED_LENGTHS = [
  (msgs: ScamMessage[]): boolean => {
    if (msgs.length < 3) return false;
    const lengths = msgs.map((m) => m.text.length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
    return variance < 50 && avg > 40;
  },
  (msgs: ScamMessage[]): boolean => {
    if (msgs.length < 2) return false;
    const sameSender = msgs.filter((m) => m.senderId === msgs[0]!.senderId);
    if (sameSender.length < 2) return false;
    const avgLen = sameSender.reduce((s, m) => s + m.text.length, 0) / sameSender.length;
    return avgLen > 80;
  },
];

function countMatches(text: string, patterns: RegExp[]): number {
  let count = 0;
  for (const p of patterns) {
    if (p.test(text)) count++;
  }
  return count;
}

export function detectChatfishing(messages: ScamMessage[]): ScamResult {
  const signals: string[] = [];
  let score = 0;

  if (messages.length === 0) return { score: 0, signals: [] };

  let offPlatformHits = 0;
  let financialHits = 0;
  let backstoryHits = 0;

  for (const msg of messages) {
    offPlatformHits += countMatches(msg.text, OFF_PLATFORM_PUSH);
    financialHits += countMatches(msg.text, FINANCIAL_LANGUAGE);
    backstoryHits += countMatches(msg.text, CLASSIC_BACKSTORIES);
  }

  if (offPlatformHits > 0) {
    score += offPlatformHits * 15;
    signals.push("Off-platform contact push");
  }
  if (financialHits > 0) {
    score += financialHits * 20;
    signals.push("Financial language detected");
  }
  if (backstoryHits > 0) {
    score += backstoryHits * 12;
    signals.push("Classic backstory elements");
  }

  for (const check of TEMPLATED_LENGTHS) {
    if (check(messages)) {
      score += 10;
      signals.push("Suspiciously uniform message lengths");
      break;
    }
  }

  const theirMsgs = messages.filter((m) => m.senderId !== messages[0]!.senderId);
  if (theirMsgs.length >= 3) {
    const totalLen = theirMsgs.reduce((s, m) => s + m.text.length, 0);
    const avgLen = totalLen / theirMsgs.length;
    if (avgLen > 100 && theirMsgs.length >= 5) {
      score += 8;
      signals.push("Overly polished, script-like messages");
    }
  }

  score = Math.max(0, Math.min(100, score));

  return { score, signals };
}
