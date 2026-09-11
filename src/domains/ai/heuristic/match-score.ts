/**
 * match-score.ts
 * 5-dimension weighted scoring for user compatibility.
 * Dimensions: interests (28%), goals (24%), chemistry (20%), lifestyle (14%), communication (14%)
 */

export type MatchDimension = "interests" | "goals" | "chemistry" | "lifestyle" | "communication";

export type Vibe =
  | "Athletic"
  | "Creative"
  | "Nerdy"
  | "Epicurean"
  | "Adventurous"
  | "Kinky"
  | "Warm";

export interface MatchUser {
  interests: string[];
  goals: string[];
  lookingFor: number[];
  grindrTribes: number[];
  bodyType: number | null;
  sexualPosition: number | null;
  age: number | null;
  aboutMe: string;
  city?: string;
}

export interface MatchResult {
  overall: number;
  dimensions: Record<MatchDimension, number>;
  reasons: string[];
  vibe: Vibe | null;
}

const WEIGHTS: Record<MatchDimension, number> = {
  interests: 0.28,
  goals: 0.24,
  chemistry: 0.20,
  lifestyle: 0.14,
  communication: 0.14,
};

const INTEREST_SYNONYMS: Record<string, string[]> = {
  gym: ["fitness", "workout", "running", "sports", "lifting"],
  music: ["concerts", "singing", "guitar", "dj", "festivals"],
  travel: ["adventure", "exploring", "road trip", "backpacking"],
  cooking: ["food", "restaurants", "baking", "chef"],
  gaming: ["video games", "esports", "board games", "pc"],
  reading: ["books", "novels", "literature", "writing"],
  movies: ["cinema", "films", "netflix", "streaming"],
  art: ["painting", "drawing", "photography", "design"],
  tech: ["programming", "coding", "ai", "software"],
  nature: ["hiking", "outdoors", "camping", "beach"],
  yoga: ["meditation", "mindfulness", "wellness"],
  dogs: ["pets", "animals", "cat"],
  fashion: ["style", "clothes", "shopping"],
  dance: ["clubbing", "parties", "rave"],
};

function normalizeInterests(interests: string[]): string[] {
  const normalized: string[] = [];
  for (const raw of interests) {
    const lower = raw.toLowerCase().trim();
    normalized.push(lower);
    for (const [key, synonyms] of Object.entries(INTEREST_SYNONYMS)) {
      if (lower === key || synonyms.includes(lower)) {
        normalized.push(key, ...synonyms);
      }
    }
  }
  return [...new Set(normalized)];
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function computeInterests(a: string[], b: string[]): number {
  const normA = normalizeInterests(a);
  const normB = normalizeInterests(b);
  return Math.round(jaccard(normA, normB) * 100);
}

function computeGoals(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 50;
  const overlap = a.filter((g) => b.includes(g)).length;
  return Math.round((overlap / Math.max(a.length, b.length)) * 100);
}

function computeChemistry(user: MatchUser, target: MatchUser): number {
  let score = 50;

  if (user.sexualPosition !== null && target.sexualPosition !== null) {
    const compatible = isPositionCompatible(user.sexualPosition, target.sexualPosition);
    score += compatible ? 25 : -10;
  }

  if (user.lookingFor.length > 0 && target.lookingFor.length > 0) {
    const overlap = user.lookingFor.filter((l) => target.lookingFor.includes(l)).length;
    score += Math.round((overlap / Math.max(user.lookingFor.length, target.lookingFor.length)) * 25);
  }

  return Math.max(0, Math.min(100, score));
}

function isPositionCompatible(pos1: number, pos2: number): boolean {
  const vers = new Set([3, 4, 5]);
  if (vers.has(pos1) || vers.has(pos2)) return true;
  if (pos1 === 6 || pos2 === 6) return true;
  return pos1 !== pos2;
}

function computeLifestyle(user: MatchUser, target: MatchUser): number {
  let score = 50;

  if (user.grindrTribes.length > 0 && target.grindrTribes.length > 0) {
    const overlap = user.grindrTribes.filter((t) => target.grindrTribes.includes(t)).length;
    score += Math.round((overlap / Math.max(user.grindrTribes.length, target.grindrTribes.length)) * 30);
  }

  if (user.age !== null && target.age !== null) {
    const ageDiff = Math.abs(user.age - target.age);
    if (ageDiff <= 5) score += 20;
    else if (ageDiff <= 10) score += 10;
    else score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

function computeCommunication(user: MatchUser, target: MatchUser): number {
  let score = 50;

  const userLen = user.aboutMe.length;
  const targetLen = target.aboutMe.length;
  if (userLen > 50 && targetLen > 50) score += 25;
  else if (userLen > 20 && targetLen > 20) score += 15;
  else if (userLen < 5 || targetLen < 5) score -= 15;

  const userWords = user.aboutMe.toLowerCase().split(/\s+/);
  const targetWords = target.aboutMe.toLowerCase().split(/\s+/);
  const questions = [...userWords, ...targetWords].filter((w) => w.endsWith("?")).length;
  if (questions >= 2) score += 15;

  return Math.max(0, Math.min(100, score));
}

function inferVibeFromProfile(user: MatchUser): Vibe {
  const bio = user.aboutMe.toLowerCase();
  const interests = user.interests.map((i) => i.toLowerCase());
  const tribes = user.grindrTribes;

  const allText = [bio, ...interests].join(" ");

  if (allText.includes("gym") || allText.includes("fitness") || allText.includes("muscular") || allText.includes("jock"))
    return "Athletic";
  if (allText.includes("art") || allText.includes("music") || allText.includes("creative") || allText.includes("design"))
    return "Creative";
  if (allText.includes("nerd") || allText.includes("geek") || allText.includes("tech") || allText.includes("gaming") || allText.includes("anime"))
    return "Nerdy";
  if (allText.includes("food") || allText.includes("cook") || allText.includes("wine") || allText.includes("restaurant"))
    return "Epicurean";
  if (allText.includes("travel") || allText.includes("adventure") || allText.includes("hiking") || tribes.includes(10))
    return "Adventurous";
  if (allText.includes("kink") || allText.includes("bdsm") || allText.includes("leather") || tribes.includes(7))
    return "Kinky";
  if (allText.includes("love") || allText.includes("caring") || allText.includes("heart") || allText.includes("connection"))
    return "Warm";

  return "Warm";
}

export function computeMatchScore(user: MatchUser, target: MatchUser): MatchResult {
  const dimensions: Record<MatchDimension, number> = {
    interests: computeInterests(user.interests, target.interests),
    goals: computeGoals(user.goals, target.goals),
    chemistry: computeChemistry(user, target),
    lifestyle: computeLifestyle(user, target),
    communication: computeCommunication(user, target),
  };

  let overall = 0;
  for (const [dim, weight] of Object.entries(WEIGHTS)) {
    overall += dimensions[dim as MatchDimension] * weight;
  }
  overall = Math.round(overall);

  const reasons: string[] = [];
  if (dimensions.interests >= 70) reasons.push("Strong shared interests");
  if (dimensions.interests < 30) reasons.push("Different interests");
  if (dimensions.goals >= 70) reasons.push("Aligned relationship goals");
  if (dimensions.goals < 30) reasons.push("Different looking-for goals");
  if (dimensions.chemistry >= 70) reasons.push("High chemistry potential");
  if (dimensions.lifestyle >= 70) reasons.push("Compatible lifestyles");
  if (dimensions.communication >= 70) reasons.push("Both articulate and curious");
  if (dimensions.communication < 30) reasons.push("Conversation style mismatch");

  if (reasons.length === 0) {
    if (overall >= 60) reasons.push("Solid overall match");
    else if (overall >= 40) reasons.push("Moderate match potential");
    else reasons.push("Low compatibility indicators");
  }

  return {
    overall,
    dimensions,
    reasons,
    vibe: inferVibeFromProfile(user),
  };
}
