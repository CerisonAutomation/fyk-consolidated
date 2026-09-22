/**
 * Conversation Autocomplete — 25.12
 * Keyboard-style: as user types, model predicts and completes rest of sentence in user's own voice.
 */

export type AutocompleteResult = {
  completion: string;
  confidence: number;
  source: "style_model" | "common_phrase";
};

const COMMON_COMPLETIONS: Record<string, string[]> = {
  "hey": ["hey there! How's it going?", "hey! What are you up to?", "hey, nice to meet you!"],
  "how are": ["how are you doing?", "how are you today?", "how are things?"],
  "what are": ["what are you up to?", "what are you into?", "what are you looking for?"],
  "i like": ["i like your profile!", "i like your vibe", "i like hiking and coffee"],
  "want to": ["want to grab coffee sometime?", "want to meet up?", "want to chat more?"],
};

export function autocomplete(prefix: string, stylePhrases: string[] = []): AutocompleteResult | null {
  const lower = prefix.toLowerCase().trim();
  if (lower.length < 2) return null;
  if (lower.length > 100) return null; // keep short, never paste AI-slop walls

  // Check style phrases first (user's own voice)
  for (const phrase of stylePhrases) {
    if (phrase.toLowerCase().startsWith(lower) && phrase.length > lower.length) {
      return {
        completion: phrase,
        confidence: 0.85,
        source: "style_model",
      };
    }
  }

  // Check common completions
  for (const [key, completions] of Object.entries(COMMON_COMPLETIONS)) {
    if (lower.startsWith(key) || key.startsWith(lower)) {
      const completion = completions[Math.floor(Math.random() * completions.length)];
      return {
        completion,
        confidence: 0.7,
        source: "common_phrase",
      };
    }
  }

  return null;
}

export function shouldShowAutocomplete(prefix: string): boolean {
  return prefix.length >= 2 && prefix.length <= 50 && !prefix.includes("\n");
}
