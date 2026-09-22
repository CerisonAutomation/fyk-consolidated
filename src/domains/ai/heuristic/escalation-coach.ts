/**
 * Escalation Coach — AI feature 25.7
 * Detects natural "ask to meet" window and nudges with low-pressure date ask.
 */

export type EscalationSignal = {
  sharedInterests: number;
  conversationLength: number;
  bothOnline: boolean;
  positiveTone: boolean;
  daysTalking: number;
  hasAskedToMeet: boolean;
};

export type EscalationSuggestion = {
  shouldSuggest: boolean;
  confidence: number;
  reason: string;
  suggestedLine: string;
  timing: "now" | "soon" | "later";
};

const ESCALATION_LINES = [
  "I've really enjoyed chatting! Would you be open to grabbing coffee sometime this week?",
  "You seem cool — want to meet for a drink and see if we vibe in person?",
  "I like your energy! Any interest in meeting up for {activity} sometime?",
  "We've been chatting a bit — want to take this offline? I'd love to meet you!",
  "This has been fun! Want to grab {activity} and continue in person?",
];

export function evaluateEscalationWindow(signal: EscalationSignal): EscalationSuggestion {
  let score = 0;
  const reasons: string[] = [];

  if (signal.sharedInterests >= 2) {
    score += 25;
    reasons.push(`${signal.sharedInterests} shared interests`);
  }
  if (signal.conversationLength >= 10) {
    score += 20;
    reasons.push(`long conversation (${signal.conversationLength} messages)`);
  }
  if (signal.bothOnline) {
    score += 15;
    reasons.push("both online now");
  }
  if (signal.positiveTone) {
    score += 20;
    reasons.push("positive tone detected");
  }
  if (signal.daysTalking >= 2 && signal.daysTalking <= 14) {
    score += 15;
    reasons.push(`${signal.daysTalking} days talking — good window`);
  }
  if (signal.hasAskedToMeet) {
    score = 0;
    reasons.push("already asked to meet");
  }

  const shouldSuggest = score >= 60;
  const confidence = Math.min(100, score);

  let timing: "now" | "soon" | "later" = "later";
  if (score >= 80) timing = "now";
  else if (score >= 60) timing = "soon";

  const template = ESCALATION_LINES[Math.floor(Math.random() * ESCALATION_LINES.length)];
  const suggestedLine = template.replace("{activity}", "coffee");

  return {
    shouldSuggest,
    confidence,
    reason: reasons.join(", ") || "not enough signals yet",
    suggestedLine,
    timing,
  };
}
