/**
 * Enterprise Matching Algorithms — Maximum scalable, reusable, reliable
 * Gold: modular, documented, scalable, resilient, measurable
 * Research: Grindr, Romeo, Rizz, Omolink — best of best
 */

// Jaccard similarity
export function jaccard<T>(a: T[], b: T[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const v of setA) if (setB.has(v)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Cosine similarity for vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Vectors must same length");
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag === 0 ? 0 : dot / mag;
}

// Euclidean distance
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Vectors must same length");
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

// Haversine distance for geo
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Age compatibility — Gaussian decay
export function ageCompatibility(age1: number, age2: number, preferredGap = 5): number {
  const gap = Math.abs(age1 - age2);
  if (gap <= 2) return 100;
  // Gaussian: exp(-gap^2 / (2*sigma^2))
  const sigma = preferredGap;
  return Math.round(100 * Math.exp(-(gap * gap) / (2 * sigma * sigma)));
}

// Body type compatibility matrix
const BODY_COMPAT: Record<string, Record<string, number>> = {
  slim: { slim: 80, average: 70, athletic: 85, muscular: 75, large: 50 },
  average: { slim: 70, average: 90, athletic: 80, muscular: 70, large: 70 },
  athletic: { slim: 85, average: 80, athletic: 90, muscular: 85, large: 60 },
  muscular: { slim: 75, average: 70, athletic: 85, muscular: 90, large: 65 },
  large: { slim: 50, average: 70, athletic: 60, muscular: 65, large: 90 },
};

export function bodyCompatibility(body1: string, body2: string): number {
  return BODY_COMPAT[body1]?.[body2] ?? 50;
}

// Interest graph — weighted Jaccard with rarity
export function weightedInterestScore(interestsA: string[], interestsB: string[], globalFrequency: Record<string, number> = {}): number {
  const allInterests = new Set([...interestsA, ...interestsB]);
  let weightedIntersection = 0, weightedUnion = 0;

  for (const interest of allInterests) {
    const inA = interestsA.includes(interest);
    const inB = interestsB.includes(interest);
    const freq = globalFrequency[interest] ?? 0.5; // 0-1, lower = rarer = more valuable
    const weight = 1 - freq * 0.5; // Rare interests weighted higher

    if (inA && inB) { weightedIntersection += weight; weightedUnion += weight; }
    else if (inA || inB) { weightedUnion += weight; }
  }

  return weightedUnion === 0 ? 0 : (weightedIntersection / weightedUnion) * 100;
}

// Compatibility dimensions — 5 dimensions
export type CompatibilityDimensions = {
  interests: number;
  lifestyle: number;
  communication: number;
  values: number;
  activity: number;
};

export type CompatibilityWeights = {
  interests: number;
  lifestyle: number;
  communication: number;
  values: number;
  activity: number;
};

export const DEFAULT_WEIGHTS: CompatibilityWeights = {
  interests: 0.28,
  lifestyle: 0.24,
  communication: 0.20,
  values: 0.14,
  activity: 0.14,
};

export type ProfileForMatch = {
  id: string;
  age: number;
  bodyType: string;
  tribes: string[];
  interests: string[];
  lookingFor: string[];
  intents: string[];
  languages: string[];
  city: string;
  lat?: number;
  lng?: number;
  online: boolean;
  lastActiveAt?: string;
  verification: number;
  replyRate?: number;
};

export function calculateCompatibility(profileA: ProfileForMatch, profileB: ProfileForMatch, weights: CompatibilityWeights = DEFAULT_WEIGHTS, globalInterestFreq?: Record<string, number>): { dimensions: CompatibilityDimensions; overall: number; reasons: string[] } {
  const dimensions: CompatibilityDimensions = {
    interests: 0,
    lifestyle: 0,
    communication: 0,
    values: 0,
    activity: 0,
  };

  // Interests — weighted Jaccard
  const interestScore = weightedInterestScore(profileA.interests, profileB.interests, globalInterestFreq);
  const tribeScore = jaccard(profileA.tribes, profileB.tribes) * 100;
  dimensions.interests = Math.round(interestScore * 0.6 + tribeScore * 0.4);

  // Lifestyle — lookingFor + intents
  const lookingScore = jaccard(profileA.lookingFor, profileB.lookingFor) * 100;
  const intentScore = jaccard(profileA.intents, profileB.intents) * 100;
  dimensions.lifestyle = Math.round(lookingScore * 0.5 + intentScore * 0.5);

  // Communication — languages + reply rate
  const langScore = jaccard(profileA.languages, profileB.languages) * 100;
  const replyScore = ((profileA.replyRate ?? 50) + (profileB.replyRate ?? 50)) / 2;
  dimensions.communication = Math.round(langScore * 0.6 + replyScore * 0.4);

  // Values — tribes + verification
  const verificationBonus = profileA.verification >= 2 && profileB.verification >= 2 ? 20 : 0;
  dimensions.values = Math.round(tribeScore * 0.7 + verificationBonus + 10);

  // Activity — online, distance, recency
  let activityScore = 50;
  if (profileA.online && profileB.online) activityScore += 20;
  if (profileA.lat && profileA.lng && profileB.lat && profileB.lng) {
    const dist = haversineDistance(profileA.lat, profileA.lng, profileB.lat, profileB.lng);
    if (dist < 5) activityScore += 20;
    else if (dist < 20) activityScore += 10;
    else if (dist > 100) activityScore -= 20;
  }
  if (profileA.city === profileB.city) activityScore += 10;
  const recencyA = profileA.lastActiveAt ? (Date.now() - new Date(profileA.lastActiveAt).getTime()) / (1000 * 60 * 60) : 999;
  const recencyB = profileB.lastActiveAt ? (Date.now() - new Date(profileB.lastActiveAt).getTime()) / (1000 * 60 * 60) : 999;
  if (recencyA < 24 && recencyB < 24) activityScore += 10;
  dimensions.activity = Math.max(0, Math.min(100, Math.round(activityScore)));

  const overall = Math.round(
    dimensions.interests * weights.interests +
    dimensions.lifestyle * weights.lifestyle +
    dimensions.communication * weights.communication +
    dimensions.values * weights.values +
    dimensions.activity * weights.activity,
  );

  const reasons: string[] = [];
  if (dimensions.interests >= 70) {
    const shared = profileA.interests.filter((i) => profileB.interests.includes(i));
    if (shared.length > 0) reasons.push(`Shared interests: ${shared.slice(0, 3).join(", ")}`);
  }
  if (dimensions.lifestyle >= 70) {
    const shared = profileA.lookingFor.filter((l) => profileB.lookingFor.includes(l));
    if (shared.length > 0) reasons.push(`Same vibe: ${shared.slice(0, 2).join(", ")}`);
  }
  if (dimensions.activity >= 80 && profileA.city === profileB.city) reasons.push(`Both in ${profileA.city}`);
  if (profileA.online && profileB.online) reasons.push("Both online now");
  if (dimensions.communication >= 70) {
    const sharedLang = profileA.languages.filter((l) => profileB.languages.includes(l));
    if (sharedLang.length > 0) reasons.push(`Speaks ${sharedLang.join(", ")}`);
  }

  return { dimensions, overall, reasons };
}

// Grid ordering — multi-factor
export type GridOrderFactor = { name: string; weight: number; score: (profile: ProfileForMatch, context: { currentUser: ProfileForMatch; now: Date }) => number };

export const GRID_FACTORS: GridOrderFactor[] = [
  { name: "distance", weight: 0.3, score: (p, ctx) => {
    if (!p.lat || !p.lng || !ctx.currentUser.lat || !ctx.currentUser.lng) return 50;
    const dist = haversineDistance(p.lat, p.lng, ctx.currentUser.lat, ctx.currentUser.lng);
    if (dist < 1) return 100;
    if (dist < 5) return 80;
    if (dist < 20) return 60;
    if (dist < 50) return 40;
    return 20;
  }},
  { name: "compatibility", weight: 0.25, score: (p, ctx) => calculateCompatibility(ctx.currentUser, p).overall },
  { name: "online", weight: 0.2, score: (p) => p.online ? 100 : 30 },
  { name: "recency", weight: 0.15, score: (p) => {
    if (!p.lastActiveAt) return 30;
    const hours = (Date.now() - new Date(p.lastActiveAt).getTime()) / (1000 * 60 * 60);
    if (hours < 1) return 100;
    if (hours < 6) return 80;
    if (hours < 24) return 60;
    if (hours < 72) return 40;
    return 20;
  }},
  { name: "verification", weight: 0.1, score: (p) => p.verification >= 2 ? 100 : p.verification === 1 ? 60 : 30 },
];

export function scoreGridProfile(profile: ProfileForMatch, currentUser: ProfileForMatch): number {
  const now = new Date();
  let total = 0, weightSum = 0;
  for (const factor of GRID_FACTORS) {
    const score = factor.score(profile, { currentUser, now });
    total += score * factor.weight;
    weightSum += factor.weight;
  }
  return Math.round(total / weightSum);
}

export function orderGridProfiles(profiles: ProfileForMatch[], currentUser: ProfileForMatch): Array<ProfileForMatch & { gridScore: number }> {
  return profiles
    .map((p) => ({ ...p, gridScore: scoreGridProfile(p, currentUser) }))
    .sort((a, b) => b.gridScore - a.gridScore);
}

// Rizz scoring — conversation momentum
export type MessageForRizz = { senderId: string; body: string; timestamp: string; type: string };

export function calculateRizzScore(messages: MessageForRizz[], currentUserId: string): { score: number; momentum: number; engagement: number; toneDrift: number; suggestions: string[] } {
  if (messages.length === 0) return { score: 50, momentum: 50, engagement: 50, toneDrift: 0, suggestions: ["Start with an icebreaker"] };

  const last10 = messages.slice(-10);
  const responseTimes: number[] = [];
  let engagement = 0;

  for (let i = 1; i < last10.length; i++) {
    const prev = new Date(last10[i - 1].timestamp).getTime();
    const curr = new Date(last10[i].timestamp).getTime();
    const diffMin = (curr - prev) / (1000 * 60);
    if (last10[i].senderId !== currentUserId) {
      if (diffMin < 5) engagement += 10;
      else if (diffMin < 60) engagement += 5;
      else if (diffMin > 1440) engagement -= 10;
      responseTimes.push(diffMin);
    }
  }

  const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 60;
  const momentum = Math.max(0, Math.min(100, 100 - avgResponseTime / 10));
  engagement = Math.max(0, Math.min(100, 50 + engagement));

  // Tone analysis — simple heuristic
  const lastMessage = last10[last10.length - 1];
  const isQuestion = lastMessage.body.includes("?");
  const hasEmoji = /[\u{1F600}-\u{1F64F}]/u.test(lastMessage.body);
  const length = lastMessage.body.length;
  let toneScore = 50;
  if (isQuestion) toneScore += 10;
  if (hasEmoji) toneScore += 10;
  if (length > 20 && length < 200) toneScore += 10;
  if (length < 5) toneScore -= 20;

  const score = Math.round((momentum * 0.4 + engagement * 0.4 + toneScore * 0.2));

  const suggestions: string[] = [];
  if (momentum < 40) suggestions.push("Conversation slowing — ask an open question");
  if (engagement < 40) suggestions.push("Low engagement — share something personal");
  if (!isQuestion && lastMessage.senderId === currentUserId) suggestions.push("End with a question to keep momentum");
  if (length < 10) suggestions.push("Longer messages show more interest");
  if (score >= 80) suggestions.push("Great momentum — suggest meeting");

  return { score, momentum, engagement, toneDrift: Math.round(Math.abs(toneScore - 50)), suggestions };
}
