/**
 * photo-rank.ts
 * Deterministic quality scoring for profile photos.
 * Assigns a score 0-100 and descriptive tags based on filename/URL heuristics.
 */

export type Photo = string;

export interface RankedPhoto {
  url: string;
  score: number;
  tags: string[];
}

const POSITIVE_SIGNALS: { pattern: RegExp; tag: string; points: number }[] = [
  { pattern: /selfie|face|portrait/i, tag: "face-visible", points: 15 },
  { pattern: /full.?body|portrait|standing/i, tag: "full-body", points: 12 },
  { pattern: /smile|happy|grin/i, tag: "smiling", points: 10 },
  { pattern: /gym|fitness|workout|sport/i, tag: "active-lifestyle", points: 8 },
  { pattern: /travel|beach|mountain|adventure/i, tag: "adventurous", points: 8 },
  { pattern: /group|friends|social/i, tag: "social", points: 5 },
  { pattern: /nature|outdoor|sunset/i, tag: "nature", points: 6 },
  { pattern: /style|fashion|outfit/i, tag: "stylish", points: 7 },
  { pattern: /food|restaurant|coffee/i, tag: "foodie", points: 5 },
  { pattern: /pet|dog|cat|animal/i, tag: "animal-lover", points: 8 },
  { pattern: /high.?res|hd|clear|sharp/i, tag: "high-quality", points: 10 },
];

const NEGATIVE_SIGNALS: { pattern: RegExp; tag: string; points: number }[] = [
  { pattern: /blur|low|dark|pixel/i, tag: "low-quality", points: -15 },
  { pattern: /mirror|bathroom|toilet/i, tag: "mirror-selfie", points: -10 },
  { pattern: /sunglasses|hat|mask|cover/i, tag: "face-obscured", points: -12 },
  { pattern: /screenshot|crop|edit|filter/i, tag: "edited", points: -8 },
  { pattern: /group|crowd/i, tag: "unclear-who", points: -5 },
  { pattern: /shirtless|shirt.?off/i, tag: "shirtless", points: -3 },
];

function hashUrl(url: string): number {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function rankPhotos(photos: Photo[]): RankedPhoto[] {
  return photos.map((url) => {
    let score = 50;
    const tags: string[] = [];

    for (const signal of POSITIVE_SIGNALS) {
      if (signal.pattern.test(url)) {
        score += signal.points;
        tags.push(signal.tag);
      }
    }

    for (const signal of NEGATIVE_SIGNALS) {
      if (signal.pattern.test(url)) {
        score += signal.points;
        tags.push(signal.tag);
      }
    }

    score += (hashUrl(url) % 5) - 2;
    score = Math.max(0, Math.min(100, score));

    if (tags.length === 0) {
      tags.push("unanalyzed");
    }

    return { url, score, tags };
  }).sort((a, b) => b.score - a.score);
}
