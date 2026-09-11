/**
 * FYK Domain Wallet — Pure Wallet Logic
 *
 * All functions are pure — no I/O, no side effects.
 * Types imported from ./types, errors from ./errors.
 */

import type { Result } from './errors';
import { ok, fail, PaymentError } from './errors';

// ─── Constants ──────────────────────────────────────────────────────────────

const DAILY_REWARD_AMOUNT = 15;

const TIER_PERKS: Record<string, string[]> = {
  free: [
    'Basic grid browsing',
    '5 super taps per day',
    'Standard support',
  ],
  plus: [
    'Unlimited grid browsing',
    '15 super taps per day',
    'See who liked you',
    'Advanced filters',
    'Priority support',
    'Ad-free experience',
  ],
  premium: [
    'Everything in Plus',
    'Unlimited super taps',
    'Incognito mode',
    'Boost profile',
    'Read receipts',
    'Exclusive events access',
    'Dedicated support',
  ],
  gold: [
    'Everything in Premium',
    'VIP badge',
    'Custom themes',
    'Priority match queue',
    'Monthly bone bonus',
    'Exclusive pet items',
  ],
};

// ─── Pure functions ─────────────────────────────────────────────────────────

/** Check if balance covers cost. */
export function canAfford(balance: number, cost: number): boolean {
  return balance >= cost;
}

/** Daily reward amount — deterministic. */
export function calculateDailyReward(): number {
  return DAILY_REWARD_AMOUNT;
}

/** Perks for a tier. */
export function calculateTierBenefits(tier: string): string[] {
  return TIER_PERKS[tier] ?? TIER_PERKS.free;
}

/** Validate a purchase. Returns ok(void) or fail(PaymentError). */
export function validatePurchase(balance: number, itemCost: number): Result<void> {
  if (itemCost < 0) {
    return fail(new PaymentError('Item cost cannot be negative', { itemCost }));
  }
  if (!canAfford(balance, itemCost)) {
    return fail(new PaymentError('Insufficient balance', { balance, itemCost }));
  }
  return ok(undefined);
}
