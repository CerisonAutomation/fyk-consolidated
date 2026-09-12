/**
 * vibe-infer.ts
 * Profile-to-vibe mapping based on interests, tribes, and tag codes.
 * Vibe: Athletic, Creative, Nerdy, Epicurean, Adventurous, Kinky, Warm.
 */

export interface VibeUser {
  interests: string[];
  tribes: number[];
  tagCodes: string[];
}

export type VibeType = "Athletic" | "Creative" | "Nerdy" | "Epicurean" | "Adventurous" | "Kinky" | "Warm";

export interface VibeResult {
  vibe: VibeType;
  emoji: string;
  blurb: string;
}

const VIBE_RULES: {
  name: VibeType;
  emoji: string;
  blurb: string;
  interestMatches: string[];
  tribeMatches: number[];
  tagMatches: string[];
  weight: number;
}[] = [
  {
    name: "Athletic",
    emoji: "💪",
    blurb: "Gym rat, sports fan, or just someone who loves to move. Active and competitive.",
    interestMatches: ["gym", "fitness", "workout", "sports", "running", "lifting", "crossfit", "boxing", "swimming", "yoga"],
    tribeMatches: [6],
    tagMatches: ["athletic", "jock", "gym", "fitness"],
    weight: 1,
  },
  {
    name: "Creative",
    emoji: "🎨",
    blurb: "Artist, musician, or maker. Sees the world a little differently.",
    interestMatches: ["art", "music", "painting", "photography", "design", "writing", "film", "theater", "dance", "craft"],
    tribeMatches: [8],
    tagMatches: ["creative", "artist", "musician", "writer"],
    weight: 1,
  },
  {
    name: "Nerdy",
    emoji: "🎮",
    blurb: "Tech nerd, gamer, or pop-culture geek. Sharp mind, deeper convos.",
    interestMatches: ["gaming", "tech", "coding", "anime", "comics", "sci-fi", "fantasy", "board games", "electronics", "ai"],
    tribeMatches: [3],
    tagMatches: ["nerd", "geek", "gamer", "otaku"],
    weight: 1,
  },
  {
    name: "Epicurean",
    emoji: "🍷",
    blurb: "Foodie, wine lover, or culture connoisseur. Life is about savoring.",
    interestMatches: ["food", "cooking", "wine", "restaurants", "coffee", "baking", "craft beer", "cocktails", "brunch", "dessert"],
    tribeMatches: [],
    tagMatches: ["foodie", "wine", "chef", "epicurean"],
    weight: 1,
  },
  {
    name: "Adventurous",
    emoji: "🌍",
    blurb: "Traveler, explorer, thrill-seeker. Always chasing the next horizon.",
    interestMatches: ["travel", "hiking", "camping", "adventure", "surfing", "skiing", "backpacking", "exploring", "road trip", "nature"],
    tribeMatches: [10],
    tagMatches: ["adventurous", "traveler", "explorer", "nomad"],
    weight: 1,
  },
  {
    name: "Kinky",
    emoji: "🖤",
    blurb: "Open-minded and adventurous in the bedroom. Knows what they want.",
    interestMatches: ["kink", "bdsm", "leather", "fetish", "pup", "leather", "rope", "dom", "sub", "poly"],
    tribeMatches: [7],
    tagMatches: ["kinky", "fetish", "kink", "bdsm"],
    weight: 1,
  },
  {
    name: "Warm",
    emoji: "🤗",
    blurb: "Kind, empathetic, and connection-focused. The one you bring home to mom.",
    interestMatches: ["volunteering", "animals", "pets", "reading", "meditation", "gardening", "mindfulness", "family", "teaching", "nursing"],
    tribeMatches: [2, 4],
    tagMatches: ["warm", "kind", "caring", "empathetic"],
    weight: 1,
  },
];

export function inferVibe(user: VibeUser): VibeResult {
  const interests = user.interests.map((i) => i.toLowerCase().trim());
  const tags = new Set(user.tagCodes.map((t) => t.toLowerCase().trim()));

  const scores: { name: VibeType; emoji: string; blurb: string; score: number }[] = [];

  for (const rule of VIBE_RULES) {
    let score = 0;

    for (const interest of interests) {
      if (rule.interestMatches.includes(interest)) score += 3;
    }
    for (const tribe of user.tribes) {
      if (rule.tribeMatches.includes(tribe)) score += 4;
    }
    for (const tag of tags) {
      if (rule.tagMatches.includes(tag)) score += 5;
    }

    scores.push({ name: rule.name, emoji: rule.emoji, blurb: rule.blurb, score });
  }

  scores.sort((a, b) => b.score - a.score);

  if (scores[0].score === 0) {
    return { vibe: "Warm", emoji: "🤗", blurb: "Everyone needs a little warmth. You bring good energy." };
  }

  return {
    vibe: scores[0].name,
    emoji: scores[0].emoji,
    blurb: scores[0].blurb,
  };
}
