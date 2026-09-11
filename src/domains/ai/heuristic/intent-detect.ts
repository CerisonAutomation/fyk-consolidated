/**
 * intent-detect.ts
 * Regex-based chat intent classification.
 * Classifies: greeting, flirting, date_ask, content_share, small_talk, deep_talk, conflict
 */

export type Intent =
  | "greeting"
  | "flirting"
  | "date_ask"
  | "content_share"
  | "small_talk"
  | "deep_talk"
  | "conflict";

export interface IntentResult {
  intent: Intent;
  confidence: number;
}

const PATTERNS: Record<Intent, RegExp[]> = {
  greeting: [
    /^(hey|hi|hello|sup|yo|hola|heya?|howdy|greetings|whats+ ?up)\b/i,
    /^(good\s*(morning|afternoon|evening|night))\b/i,
    /^(gm|gn|wya|whb)\b/i,
    /^(how (are|r) ?(you|u)|how'?s it going|what'?s good)\b/i,
    /^h+e+l+l+o+/i,
    /^y+o+$/i,
    /^(ainda|ola|salut|ciao|hallo)\b/i,
  ],
  flirting: [
    /\b(hot|sexy|cute|adorable|beautiful|handsome|gorgeous|attractive|fine|thick|buff)\b/i,
    /\b(you(?:'re|\s+are)\s+(hot|sexy|cute|fine|beautiful))\b/i,
    /\b(how (do|does) (i|you)|want (to|2))\b.*\b(sex|fuck|hook|bang|smash)\b/i,
    /\b(nsfw|spicy|naughty|kinky|freaky|hung|top|bottom|vers)\b/i,
    /\b(bdsm|dom|sub|submissive|dominant|kink|fetish)\b/i,
    /\b(bareback|raw|bb|breeding)\b/i,
    /\b(send|drop|show|share)\b.*\b(pics?|photos?|pics|nudes?|dick|ass|body)\b/i,
    /\b(daddy|zaddy|papi|chulo)\b/i,
    /\b(get\s*(a\s*)?room|nice\s*body|nice\s*ass|nice\s*dick)\b/i,
  ],
  date_ask: [
    /\b(want|like|down)\s*(to|2)\s*(meet|hang|grab|get)\b/i,
    /\b(are you|u)\s*(free|available|down)\s*(tonight|today|this weekend|later|now)\b/i,
    /\b(let'?s|we should|wanna)\s*(meet|hang|grab|get)\b/i,
    /\b(drink|coffee|dinner|lunch|brunch|food)\s*(sometime|tonight|today|together)\b/i,
    /\b(my place|your place|a bar|a coffee|a restaurant)\b/i,
    /\b(when|what time)\s*(can|do)\s*(we|i)\s*(meet|hang)\b/i,
    /\b(invite|come over|swing by|stop by)\b/i,
    /\b(movie|netflix|chill)\b.*\b(together|tonight|over)\b/i,
  ],
  content_share: [
    /\b(check out|look at|see my|see this|look)\b.*\b(pic|photo|video|profile|bio|story)\b/i,
    /\b(instagram|snapchat|tiktok|twitter|x\.com|onlyfans|fansly)\b/i,
    /\b(http[s]?:\/\/|www\.|\.com|\.net|\.org)\b/i,
    /\b(dm|pm|message|text)\b.*\b(me|on)\b/i,
    /\b(follow|add|subscribe|join)\b/i,
    /\b(check|see|watch|listen)\b.*\b(my|this)\b.*\b(song|album|playlist|stream)\b/i,
  ],
  small_talk: [
    /\b(how('?s| is) (your|the) (day|week|weekend|night|morning))\b/i,
    /\b(what do you (do|like|want|think|know))\b/i,
    /\b(how was|how'?s|what'?s new|what are you (up to|doing))\b/i,
    /\b(weather|sports|game|movie|show|music|work)\b/i,
    /\b(do you (like|watch|listen|play|enjoy))\b/i,
    /\b(nice|cool|awesome|wow|lol|haha|lmao|omg|yay)\b/i,
    /\b(thanks|thank you|np|no problem|sure|ok|yeah|yup|nah)\b/i,
  ],
  deep_talk: [
    /\b(meaning of life|purpose|philosophy|believe in|spirituality)\b/i,
    /\b(family|mom|dad|parents|brother|sister|kids|children)\b/i,
    /\b(dream|goal|ambition|future|aspire|career|life plan)\b/i,
    /\b(feel|feeling|emotion|anxiety|depression|therapy|mental health)\b/i,
    /\b(honesty|trust|loyalty|values|principles|respect)\b/i,
    /\b(lonely|alone|connection|intimacy|vulnerability|opening up)\b/i,
    /\b(love|hate|fear|joy|regret|lesson|growth)\b/i,
    /\b(tell me about|what do you think about|your opinion on)\b/i,
  ],
  conflict: [
    /\b(fuck you|stupid|idiot|dumb|moron|loser|ugly)\b/i,
    /\b(kys|kill yourself|go die|drop dead)\b/i,
    /\b(racist|homophob|bigot|nazi|slur)\b/i,
    /\b(i'?ll (find|get|report|block|expose))\b/i,
    /\b(scammer|catfish|fake|liar|creep|predator)\b/i,
    /\b(never mind|whatever|fine|done|over it|leave me alone)\b/i,
    /\b(annoying|boring|waste of time|not interested|not into you)\b/i,
    /\b(disrespect|rude|inappropriate|creepy|weird)\b/i,
  ],
};

function scoreIntent(text: string, intent: Intent): number {
  const patterns = PATTERNS[intent];
  let hits = 0;
  for (const p of patterns) {
    if (p.test(text)) hits++;
  }
  return hits / patterns.length;
}

export function detectIntent(text: string): IntentResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { intent: "small_talk", confidence: 0.3 };

  const scores: [Intent, number][] = [];
  for (const intent of Object.keys(PATTERNS) as Intent[]) {
    scores.push([intent, scoreIntent(trimmed, intent)]);
  }

  scores.sort((a, b) => b[1] - a[1]);

  const [bestIntent, bestScore] = scores[0];

  if (bestScore === 0) {
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount >= 15) return { intent: "deep_talk", confidence: 0.5 };
    if (trimmed.endsWith("?")) return { intent: "small_talk", confidence: 0.45 };
    return { intent: "small_talk", confidence: 0.35 };
  }

  const secondScore = scores[1][1];
  const spread = bestScore - secondScore;
  const confidence = Math.min(0.95, 0.5 + spread * 0.5 + bestScore * 0.3);

  return { intent: bestIntent, confidence: Math.round(confidence * 100) / 100 };
}
