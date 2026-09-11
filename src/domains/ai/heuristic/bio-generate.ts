/**
 * bio-generate.ts
 * Generates 3 bio templates from user profile data.
 * Uses occupation, interests, tribe, goal, city.
 */

export interface BioUser {
  occupation?: string | null;
  interests?: string[];
  grindrTribes?: number[];
  lookingFor?: number[];
  aboutMe?: string;
  city?: string | null;
  age?: number | null;
}

const TRIBE_LABELS: Record<number, string> = {
  1: "bear",
  2: "clean-cut guy",
  3: "daddy",
  4: "discreet",
  5: "geek",
  6: "jock",
  7: "leather lover",
  8: "otter",
  9: "poz warrior",
  10: "rugged",
  11: "trans",
  12: "twink",
  13: "sober",
};

const GOAL_LABELS: Record<number, string> = {
  2: "chat",
  3: "dates",
  4: "friends",
  5: "networking",
  6: "relationship",
  7: "hookups",
};

function getTribe(user: BioUser): string {
  if (user.grindrTribes && user.grindrTribes.length > 0) {
    return TRIBE_LABELS[user.grindrTribes[0]!] ?? "guy";
  }
  return "guy";
}

function getGoal(user: BioUser): string {
  if (user.lookingFor && user.lookingFor.length > 0) {
    return GOAL_LABELS[user.lookingFor[0]!] ?? "connection";
  }
  return "connection";
}

function getInterests(user: BioUser): string[] {
  if (user.interests && user.interests.length > 0) return user.interests;
  const bio = (user.aboutMe ?? "").toLowerCase();
  const words = ["music", "travel", "gym", "cooking", "art", "gaming", "reading", "movies", "hiking", "tech"];
  return words.filter((w) => bio.includes(w)).slice(0, 3);
}

export function generateBio(user: BioUser): string[] {
  const occupation = user.occupation?.trim() || null;
  const interests = getInterests(user);
  const tribe = getTribe(user);
  const goal = getGoal(user);
  const city = user.city?.trim() || null;
  const age = user.age ?? null;

  const interestStr = interests.length > 0 ? interests.join(", ") : "good vibes";
  const locationStr = city ? ` in ${city}` : "";
  const ageStr = age ? `${age}yo ` : "";

  const templates: string[] = [];

  if (occupation) {
    templates.push(
      `${ageStr}${occupation} by day, ${tribe} by nature${locationStr}. Into ${interestStr}. Looking for ${goal}.`,
    );
  } else {
    templates.push(
      `${ageStr}Proud ${tribe}${locationStr}. Love ${interestStr}. Here for ${goal}.`,
    );
  }

  if (interests.length >= 2) {
    templates.push(
      `${interests[0]!.charAt(0).toUpperCase() + interests[0]!.slice(1)} enthusiast, ${tribe} vibes, ${ageStr}and always down for ${goal}${locationStr}.`,
    );
  } else {
    templates.push(
      `Just a ${tribe} who loves life${locationStr}. Always up for a good conversation about ${interestStr}.`,
    );
  }

  if (city && interests.length >= 1) {
    templates.push(
      `Based in ${city}. ${interests[0]!.charAt(0).toUpperCase() + interests[0]!.slice(1)} lover. ${tribe}. Seeking ${goal}${occupation ? ` -- ${occupation}` : ""}.`,
    );
  } else {
    templates.push(
      `${tribe}. ${interestStr}. Here for ${goal}${occupation ? ` -- ${occupation}` : ""}. Let's vibe.`,
    );
  }

  return templates;
}
