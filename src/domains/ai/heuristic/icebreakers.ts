/**
 * icebreakers.ts
 * 6 template openers with {name}, {interest}, {tribute} placeholders.
 * Returns 6 icebreakers for a target profile.
 */

export interface IcebreakerTarget {
  displayName?: string | null;
  interests?: string[];
  grindrTribes?: number[];
  aboutMe?: string;
}

const TRIBE_TRIBUTES: Record<number, string> = {
  1: "big guy",
  2: "sharp-looking",
  3: "experienced",
  4: "mysterious",
  5: "fellow nerd",
  6: "jock",
  7: "rugged",
  8: "cute otter",
  9: "warrior",
  10: "tough one",
  11: "beautiful",
  12: "adorable",
  13: "strong",
};

const TEMPLATES = [
  "Hey {name}! I see you're into {interest} -- what got you started with that?",
  "What's up {tribute}! Your {interest} vibe is really cool. Got any recommendations?",
  "Hey {name}! Fellow {interest} lover here. What's your favorite thing about it?",
  "Hi there {tribute}! Noticed you like {interest} -- that's awesome. Tell me more!",
  "{name}! I had to say hi. Anyone who's into {interest} is worth knowing.",
  "Hey {tribute}! Your profile caught my eye. {interest} is such a great interest -- how deep are you into it?",
];

function pickInterest(target: IcebreakerTarget): string {
  if (target.interests && target.interests.length > 0) {
    return target.interests[0]!;
  }
  const bio = (target.aboutMe ?? "").toLowerCase();
  const interestWords = [
    "music", "travel", "gym", "cooking", "art", "gaming", "reading",
    "movies", "hiking", "tech", "yoga", "dance", "fashion", "sports",
  ];
  for (const word of interestWords) {
    if (bio.includes(word)) return word;
  }
  return "life";
}

function pickTribes(target: IcebreakerTarget): string {
  if (target.grindrTribes && target.grindrTribes.length > 0) {
    const tribeId = target.grindrTribes[0]!;
    return TRIBE_TRIBUTES[tribeId] ?? "good-looking";
  }
  return "good-looking";
}

export function generateIcebreakers(target: IcebreakerTarget): string[] {
  const name = target.displayName?.trim() || "there";
  const interest = pickInterest(target);
  const tribute = pickTribes(target);

  return TEMPLATES.map((t) =>
    t
      .replace(/\{name\}/g, name)
      .replace(/\{interest\}/g, interest)
      .replace(/\{tribute\}/g, tribute),
  );
}
