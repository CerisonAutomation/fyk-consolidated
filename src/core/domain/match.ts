/**
 * FYK Domain Match — Pure Match Scoring
 *
 * Migrated from ai/heuristic/match-score.ts.
 * Pure functions only — no I/O, no side effects.
 * All types imported from ./types (no duplication).
 */

import type { Profile, MatchDimensions, MatchResult } from './types';

// ─── Dimension weights ──────────────────────────────────────────────────────

const WEIGHTS: MatchDimensions = {
  interests: 0.28,
  goals: 0.24,
  chemistry: 0.20,
  lifestyle: 0.14,
  communication: 0.14,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Jaccard similarity between two string arrays. */
function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const v of setA) {
    if (setB.has(v)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Normalize a number to 0-100. */
function pct(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)));
}

/** Age compatibility: 0-100 based on age gap. */
function ageScore(age1: number, age2: number): number {
  const gap = Math.abs(age1 - age2);
  if (gap <= 2) return 100;
  if (gap <= 5) return 85;
  if (gap <= 10) return 60;
  if (gap <= 15) return 30;
  return 10;
}

/** Body type preference overlap. */
function bodyScore(body1: string, _body2: string, lookingFor: string[]): number {
  if (lookingFor.length === 0) return 50; // no preference = neutral
  return lookingFor.includes(body1) ? 90 : 30;
}

/** Language overlap. */
function langScore(langs1: string[], langs2: string[]): number {
  return jaccard(langs1, langs2) * 100;
}

// ─── Dimension scorers ──────────────────────────────────────────────────────

function scoreInterests(profile: Profile, target: Profile): number {
  const tagScore = jaccard(profile.tagCodes, target.tagCodes) * 100;
  const interestScore = jaccard(profile.interests, target.interests) * 100;
  const tribeScore = jaccard(profile.tribes, target.tribes) * 100;
  return tagScore * 0.4 + interestScore * 0.4 + tribeScore * 0.2;
}

function scoreGoals(profile: Profile, target: Profile): number {
  const intentScore = jaccard(profile.intents, target.intents) * 100;
  const lookingScore = jaccard(profile.lookingFor, target.lookingFor) * 100;
  return intentScore * 0.6 + lookingScore * 0.4;
}

function scoreChemistry(profile: Profile, target: Profile): number {
  const posScore = jaccard(profile.position, target.position) * 100;
  const bodyComp = bodyScore(profile.bodyType, target.bodyType, target.lookingFor);
  const ageComp = ageScore(profile.age, target.age);
  return posScore * 0.4 + bodyComp * 0.3 + ageComp * 0.3;
}

function scoreLifestyle(profile: Profile, target: Profile): number {
  const langOverlap = langScore(profile.languages, target.languages);
  const cityBonus = profile.city === target.city ? 20 : 0;
  const verificationBonus = (profile.verification === 'verified' && target.verification === 'verified') ? 15 : 0;
  return Math.min(100, langOverlap * 0.6 + cityBonus + verificationBonus);
}

function scoreCommunication(profile: Profile, target: Profile): number {
  const langOverlap = langScore(profile.languages, target.languages);
  const onlineBonus = target.online ? 15 : 0;
  const activeBonus = profile.lastActiveAt && target.lastActiveAt ? 10 : 0;
  return Math.min(100, langOverlap * 0.7 + onlineBonus + activeBonus);
}

// ─── Vibe classification ────────────────────────────────────────────────────

function classifyVibe(overall: number): string {
  if (overall >= 90) return 'soulmate';
  if (overall >= 75) return 'great_match';
  if (overall >= 60) return 'good_vibes';
  if (overall >= 40) return 'potential';
  return 'low_match';
}

// ─── Reason generation ──────────────────────────────────────────────────────

function generateReasons(
  profile: Profile,
  target: Profile,
  dimensions: MatchDimensions
): string[] {
  const reasons: string[] = [];

  if (dimensions.interests >= 70) {
    const shared = profile.tagCodes.filter(t => target.tagCodes.includes(t));
    if (shared.length > 0) {
      reasons.push(`Shared interests: ${shared.slice(0, 3).join(', ')}`);
    }
  }

  if (dimensions.goals >= 70) {
    const sharedIntents = profile.intents.filter(i => target.intents.includes(i));
    if (sharedIntents.length > 0) {
      reasons.push(`Compatible goals: ${sharedIntents.slice(0, 2).join(', ')}`);
    }
  }

  if (dimensions.chemistry >= 70) {
    reasons.push('Strong physical chemistry');
  }

  if (dimensions.lifestyle >= 70) {
    const sharedLangs = profile.languages.filter(l => target.languages.includes(l));
    if (sharedLangs.length > 0) {
      reasons.push(`Common languages: ${sharedLangs.join(', ')}`);
    }
  }

  if (dimensions.communication >= 70 && target.online) {
    reasons.push('Currently online — ready to chat');
  }

  return reasons;
}

// ─── Main scoring function ──────────────────────────────────────────────────

/**
 * Compute match score between two profiles.
 * Pure function — no I/O, no side effects.
 */
export function computeMatchScore(profile: Profile, target: Profile): MatchResult {
  const dimensions: MatchDimensions = {
    interests: pct(scoreInterests(profile, target)),
    goals: pct(scoreGoals(profile, target)),
    chemistry: pct(scoreChemistry(profile, target)),
    lifestyle: pct(scoreLifestyle(profile, target)),
    communication: pct(scoreCommunication(profile, target)),
  };

  const overall = pct(
    dimensions.interests * WEIGHTS.interests +
    dimensions.goals * WEIGHTS.goals +
    dimensions.chemistry * WEIGHTS.chemistry +
    dimensions.lifestyle * WEIGHTS.lifestyle +
    dimensions.communication * WEIGHTS.communication
  );

  const reasons = generateReasons(profile, target, dimensions);
  const vibe = classifyVibe(overall);

  return { overall, dimensions, reasons, vibe };
}
