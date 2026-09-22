/**
 * Billing € Pricing — PRD 12.1
 * Free / Gold / Platinum tiers
 * € pricing, Stripe, RevenueCat, promo WELCOME15 PREMIUM20 ELITE30
 */

export const pricing = {
  free: {
    name: "Free",
    price: { monthly: 0, yearly: 0, currency: "EUR" },
    features: ["discover", "chat", "1 boost/day"],
    limits: { boosts: 1, superLikes: 1, viewLikes: false },
  },
  gold: {
    name: "Gold",
    price: { monthly: 9.99, yearly: 59.99, currency: "EUR" },
    features: ["discover", "chat", "viewed", "events", "boost", "incognito", "travel", "ai", "5 boosts/day", "ad-free"],
    limits: { boosts: 5, superLikes: 5, viewLikes: true },
    popular: true,
  },
  platinum: {
    name: "Platinum",
    price: { monthly: 19.99, yearly: 119.99, currency: "EUR" },
    features: ["discover", "chat", "viewed", "events", "boost", "incognito", "travel", "ai", "video-dates", "unlimited boosts", "priority"],
    limits: { boosts: Infinity, superLikes: Infinity, viewLikes: true },
  },
  consumables: {
    boost: { price: 2.99, currency: "EUR", name: "Boost" },
    superBoost: { price: 9.99, currency: "EUR", name: "Super Boost 10x" },
    superLike: { price: 0.99, currency: "EUR", name: "Super Like" },
  },
  promo: {
    WELCOME15: { discount: 15, type: "percent", validFor: "first month" },
    PREMIUM20: { discount: 20, type: "percent", validFor: "yearly" },
    ELITE30: { discount: 30, type: "percent", validFor: "yearly" },
    // Legacy aliases
    LEGACY_PREMIUM_15: { alias: "WELCOME15" },
    LEGACY_GOLD_20: { alias: "PREMIUM20" },
  },
} as const;

export type Tier = keyof typeof pricing;
export type PromoCode = keyof typeof pricing.promo;

export function formatPrice(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amount);
}

export function calculateDiscountedPrice(original: number, promoCode: string): number {
  const promo = pricing.promo[promoCode as PromoCode] as { discount?: number } | undefined;
  if (!promo || !("discount" in promo) || !promo.discount) return original;
  return original * (1 - promo.discount / 100);
}

export function canUseFeature(tier: string, feature: string): boolean {
  const tierData = pricing[tier as keyof typeof pricing] as { features?: string[] } | undefined;
  if (!tierData || !("features" in tierData) || !tierData.features) return false;
  return tierData.features.includes(feature);
}
