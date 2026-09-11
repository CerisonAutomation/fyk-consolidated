/**
 * FYK Domain Pet — Pure Pet Progression
 *
 * All functions are pure — no I/O, no side effects.
 * Types imported from ./types, errors from ./errors.
 */

import type { Result } from './errors';
import { ok, fail, ValidationError } from './errors';

// ─── Constants ──────────────────────────────────────────────────────────────

/** XP granted per action type. */
export const XP_PER_ACTION: Record<string, number> = {
  feed: 20,
  play: 25,
  adventure: 40,
  rest: 10,
  dress: 15,
};

/** Evolution stage order — index determines progression. */
export const STAGE_ORDER: string[] = ['baby', 'juvenile', 'adult'];

/** XP required per level. */
const XP_PER_LEVEL = 100;

/** Level thresholds for evolution. */
const EVOLUTION_THRESHOLDS: Record<string, number> = {
  baby: 1,
  juvenile: 5,
  adult: 15,
};

// ─── Pure functions ─────────────────────────────────────────────────────────

/** Calculate level-up from accumulated experience. */
export function calculateLevelUp(
  experience: number,
  level: number
): { experience: number; level: number; leveled: boolean } {
  const newLevel = Math.floor(experience / XP_PER_LEVEL) + 1;
  const leveled = newLevel > level;
  return { experience, level: newLevel, leveled };
}

/** Determine evolution stage from level. */
export function calculateEvolution(level: number, currentStage: string): string {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  if (currentIndex === -1) return 'baby';

  // Check if level qualifies for next stage
  if (currentIndex < STAGE_ORDER.length - 1) {
    const nextStage = STAGE_ORDER[currentIndex + 1];
    const threshold = EVOLUTION_THRESHOLDS[nextStage] ?? Infinity;
    if (level >= threshold) return nextStage;
  }

  return currentStage;
}

/** Check if pet can equip an item based on stage. */
export function canEquipItem(petStage: string, itemStage: string): boolean {
  const petIndex = STAGE_ORDER.indexOf(petStage);
  const itemIndex = STAGE_ORDER.indexOf(itemStage);
  if (petIndex === -1 || itemIndex === -1) return false;
  return petIndex >= itemIndex;
}

/** Validate pet name — 2-16 chars, alphanumeric + spaces. */
export function validateRename(name: string): Result<void> {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return fail(new ValidationError('Pet name must be at least 2 characters', { name }));
  }
  if (trimmed.length > 16) {
    return fail(new ValidationError('Pet name must be 16 characters or fewer', { name }));
  }
  if (!/^[a-zA-Z0-9\s'-]+$/.test(trimmed)) {
    return fail(new ValidationError('Pet name contains invalid characters', { name }));
  }
  return ok(undefined);
}
