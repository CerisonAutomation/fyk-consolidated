/**
 * AI Meme / GIF Suggestion — 25.16
 * GIF/sticker picker pre-filters suggestions semantically from current message.
 */

export type MemeSuggestion = {
  id: string;
  url: string;
  type: "gif" | "sticker" | "emoji";
  tags: string[];
  intent: string;
  reason: string;
};

const MEME_DB: MemeSuggestion[] = [
  { id: "1", url: "https://media.giphy.com/media/tired1.gif", type: "gif", tags: ["tired", "sleepy", "exhausted"], intent: "empathy", reason: "They said they're tired" },
  { id: "2", url: "https://media.giphy.com/media/happy1.gif", type: "gif", tags: ["happy", "excited", "joy"], intent: "celebration", reason: "Positive message" },
  { id: "3", url: "https://media.giphy.com/media/flirt1.gif", type: "gif", tags: ["flirty", "wink", "cheeky"], intent: "flirty", reason: "Flirty context" },
  { id: "4", url: "https://media.giphy.com/media/laugh1.gif", type: "gif", tags: ["funny", "laugh", "lol"], intent: "humor", reason: "Funny message" },
  { id: "5", url: "https://media.giphy.com/media/coffee1.gif", type: "gif", tags: ["coffee", "morning", "cafe"], intent: "activity", reason: "Coffee mentioned" },
  { id: "6", url: "https://media.giphy.com/media/gym1.gif", type: "gif", tags: ["gym", "workout", "fitness"], intent: "activity", reason: "Gym mentioned" },
];

export function suggestMemes(currentMessage: string, limit = 6): MemeSuggestion[] {
  const lower = currentMessage.toLowerCase();
  const keywords = lower.split(/\s+/);

  const scored = MEME_DB.map((meme) => {
    let score = 0;
    for (const tag of meme.tags) {
      if (lower.includes(tag)) score += 10;
      for (const kw of keywords) {
        if (kw.includes(tag) || tag.includes(kw)) score += 2;
      }
    }
    return { meme, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.meme);
}

export function suggestByIntent(intent: string): MemeSuggestion[] {
  return MEME_DB.filter((m) => m.intent === intent).slice(0, 6);
}
