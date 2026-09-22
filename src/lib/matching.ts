/**
 * Matching & Selection — Production (15.x)
 * Double opt-in, dealbreakers, dating intentions, secret admirer, etc.
 */

export type DatingIntention = "casual" | "dates" | "relationship" | "friends" | "figuring_out";

export const DATING_INTENTIONS: { id: DatingIntention; label: string; emoji: string }[] = [
  { id: "casual", label: "Casual", emoji: "😎" },
  { id: "dates", label: "Dates", emoji: "💕" },
  { id: "relationship", label: "Relationship", emoji: "❤️" },
  { id: "friends", label: "Friends", emoji: "🤝" },
  { id: "figuring_out", label: "Still figuring it out", emoji: "🤔" },
];

export type Dealbreaker = {
  field: string;
  value: string;
  operator: "equals" | "not_equals" | "includes" | "excludes";
};

export type MatchPreferences = {
  intentions: DatingIntention[];
  dealbreakers: Dealbreaker[];
  ageMin: number;
  ageMax: number;
  distanceMaxKm: number;
  showVerifiedOnly: boolean;
};

export const DEFAULT_MATCH_PREFS: MatchPreferences = {
  intentions: [],
  dealbreakers: [],
  ageMin: 18,
  ageMax: 60,
  distanceMaxKm: 50,
  showVerifiedOnly: false,
};

export function isDealbreakerViolated(profile: any, dealbreakers: Dealbreaker[]): { violated: boolean; reasons: string[] } {
  const reasons: string[] = [];

  for (const db of dealbreakers) {
    const fieldValue = profile[db.field];
    if (fieldValue == null) continue;

    let violated = false;
    switch (db.operator) {
      case "equals":
        violated = String(fieldValue) === db.value;
        break;
      case "not_equals":
        violated = String(fieldValue) !== db.value;
        break;
      case "includes":
        violated = Array.isArray(fieldValue) ? fieldValue.includes(db.value) : String(fieldValue).includes(db.value);
        break;
      case "excludes":
        violated = Array.isArray(fieldValue) ? !fieldValue.includes(db.value) : !String(fieldValue).includes(db.value);
        break;
    }

    if (violated) {
      reasons.push(`${db.field} ${db.operator} ${db.value}`);
    }
  }

  return { violated: reasons.length > 0, reasons };
}

export type SecretAdmirer = {
  id: string;
  likerId: string;
  likedId: string;
  revealed: boolean;
  createdAt: string;
  revealAt?: string; // when match occurs, reveal
};

export function shouldRevealSecretAdmirer(admirer: SecretAdmirer, isMatched: boolean): boolean {
  if (admirer.revealed) return true;
  if (isMatched) return true;
  return false;
}

export type CompatibilityScore = {
  total: number;
  dimensions: {
    intimacy: number;
    vibe: number;
    logistics: number;
    lifestyle: number;
  };
  strengths: string[];
  explanation: string;
};

export function calculateCompatibility(me: any, other: any): CompatibilityScore {
  const sharedInterests = (me.interests ?? []).filter((i: string) => (other.interests ?? []).includes(i));
  const sharedTribes = (me.tribes ?? []).filter((t: string) => (other.tribes ?? []).includes(t));

  const vibe = Math.min(100, sharedInterests.length * 20 + sharedTribes.length * 15);
  const intimacy = me.position && other.position ? 70 : 50;
  const logistics = other.distance != null ? Math.max(0, 100 - other.distance * 2) : 50;
  const lifestyle = me.lookingFor && other.lookingFor ? 60 : 50;

  const total = Math.round((vibe * 0.3 + intimacy * 0.25 + logistics * 0.25 + lifestyle * 0.2));

  const strengths: string[] = [];
  if (sharedInterests.length >= 2) strengths.push(`${sharedInterests.length} shared interests`);
  if (sharedTribes.length >= 1) strengths.push(`Both ${sharedTribes[0]}`);
  if (logistics > 70) strengths.push("Very close by");

  return {
    total,
    dimensions: { intimacy, vibe, logistics, lifestyle },
    strengths,
    explanation: `Vibe ${vibe}, Intimacy ${intimacy}, Logistics ${logistics}, Lifestyle ${lifestyle}`,
  };
}
