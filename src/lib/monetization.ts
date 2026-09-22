/**
 * Monetization Extensions — Production (22.x)
 * Membership gifting, referrals, pay-per-read, consumables, spotlight, vouchers
 */

export type GiftMembership = {
  id: string;
  giverId: string;
  receiverId: string;
  tier: "plus" | "gold" | "platinum";
  durationDays: number;
  message?: string;
  status: "pending" | "claimed" | "expired";
  createdAt: string;
  expiresAt: string;
};

export type Referral = {
  id: string;
  referrerId: string;
  refereeId?: string;
  code: string;
  clicks: number;
  conversions: number;
  rewardDays: number;
  rewardCoins: number;
  createdAt: string;
};

export type Consumable = {
  type: "boost" | "super_like" | "spotlight" | "read_receipt" | "incognito" | "profile_boost" | "tap_boost";
  count: number;
  expiresAt?: string;
};

export type Spotlight = {
  id: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  position: number; // grid position boost
  active: boolean;
};

export type Voucher = {
  id: string;
  code: string;
  discountPercent?: number;
  freeDays?: number;
  tier?: "plus" | "gold" | "platinum";
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  createdBy?: string;
};

export const CONSUMABLE_PRICES: Record<Consumable["type"], { cost: number; label: string; emoji: string; desc: string }> = {
  boost: { cost: 120, label: "Profile Boost", emoji: "⚡", desc: "Top of grid for 60 min" },
  super_like: { cost: 50, label: "Super Like", emoji: "💖", desc: "Stand out with super like" },
  spotlight: { cost: 200, label: "Spotlight", emoji: "🌟", desc: "Pinned to top of nearby for 30 min" },
  read_receipt: { cost: 30, label: "Read Receipt Pack", emoji: "👁️", desc: "10 read receipts" },
  incognito: { cost: 100, label: "Incognito Mode", emoji: "🕵️", desc: "Browse invisibly for 24h" },
  profile_boost: { cost: 150, label: "Profile Boost Pro", emoji: "🚀", desc: "3x visibility for 60 min" },
  tap_boost: { cost: 80, label: "Tap Boost", emoji: "💘", desc: "Your taps rank higher" },
};

export function generateReferralCode(userId: string): string {
  const prefix = userId.slice(0, 4).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FYK-${prefix}-${random}`;
}

export function validateVoucher(voucher: Voucher): { valid: boolean; reason?: string } {
  if (voucher.usedCount >= voucher.maxUses) return { valid: false, reason: "max_uses_reached" };
  if (new Date(voucher.expiresAt).getTime() < Date.now()) return { valid: false, reason: "expired" };
  return { valid: true };
}

export function calculateSpotlightExpiry(minutes = 60): { startsAt: string; endsAt: string } {
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + minutes * 60 * 1000);
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

export function isSpotlightActive(spotlight: Spotlight): boolean {
  return spotlight.active && new Date(spotlight.endsAt).getTime() > Date.now();
}

export const REFERRAL_REWARDS = {
  referrer: { days: 7, coins: 100 },
  referee: { days: 3, coins: 50 },
};

export type PayPerRead = {
  messageId: string;
  cost: number;
  unlocked: boolean;
  unlockedAt?: string;
};

export const PAY_PER_READ_COST = 10;

export function canAfford(cost: number, balance: number): boolean {
  return balance >= cost;
}
