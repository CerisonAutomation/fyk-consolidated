/**
 * reply-suggest.ts
 * 30 reply templates keyed by intent (5 per intent).
 * Returns 3 random suggestions, excluding provided text.
 */

import type { Intent } from "./intent-detect";
import { hashString, seededRandom } from "./deterministic";

const TEMPLATES: Record<Intent, string[]> = {
  greeting: [
    "Hey there! How's your day going so far?",
    "Hi! What's got you online today?",
    "Hey! Nice to see someone new. What's up?",
    "Hello! How's the week been treating you?",
    "Hey! What are you up to tonight?",
  ],
  flirting: [
    "Well aren't you charming. Tell me more about yourself?",
    "I appreciate the compliment! What caught your eye?",
    "You're sweet. So what brings you here tonight?",
    "Thanks! You're not so bad yourself. What are you into?",
    "Haha, smooth talker! What else do you do well?",
  ],
  date_ask: [
    "I'm definitely open to that! What did you have in mind?",
    "Sounds fun! When were you thinking?",
    "I'd like that! Where were you thinking of meeting?",
    "Count me in! What's your ideal first date?",
    "I'm down! Let's grab coffee sometime this week?",
  ],
  content_share: [
    "Cool! I'll check it out. What do you like most about it?",
    "Nice, I love discovering new stuff. Got more?",
    "That's interesting! How did you get into that?",
    "Thanks for sharing! What made you pick that?",
    "Awesome! What else are you into that I should know about?",
  ],
  small_talk: [
    "Not too much, just relaxing. You?",
    "Pretty good! Been busy with work. How about you?",
    "Just hanging out. What about you, what's new?",
    "Chilling! What are you watching/playing/listening to lately?",
    "Same here. Been meaning to try something new. Any suggestions?",
  ],
  deep_talk: [
    "That's a really good question. I think we all figure it out differently.",
    "I love a good deep conversation. What's been on your mind lately?",
    "That hits close to home. Want to talk more about it?",
    "I respect that you go deep. Most people don't.",
    "Absolutely. Connection matters more than anything else.",
  ],
  conflict: [
    "Hey, no need for that. Let's keep it respectful.",
    "I'm sorry you feel that way. Can we start over?",
    "That's not cool. I'm here to have a good time.",
    "I think there's been a misunderstanding. Can we talk?",
    "I'll leave it here if things don't improve. Take care.",
  ],
};

// `seededRandom` and `hashString` live in `./deterministic`, so every heuristic that
// needs a stable derived value uses one generator. Two copies of a PRNG is two
// different answers to "why did the assistant pick that line".

export function suggestReplies(
  text: string,
  intent: Intent,
  exclude?: string[],
): string[] {
  const templates = TEMPLATES[intent] ?? TEMPLATES.small_talk;
  const excludeSet = new Set((exclude ?? []).map((e) => e.toLowerCase().trim()));

  const available = templates.filter((t) => !excludeSet.has(t.toLowerCase().trim()));

  if (available.length === 0) return templates.slice(0, 3);

  const rng = seededRandom(hashString(text + intent));

  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(3, shuffled.length));
}
