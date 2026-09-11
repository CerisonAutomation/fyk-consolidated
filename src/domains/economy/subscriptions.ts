// ═══════════════════════════════════════════════════════════════════════════════
// Economy — Subscription Tier Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export type SubscriptionTierId = "free" | "plus" | "gold" | "platinum";

export interface SubscriptionPerk {
	key: string;
	label: string;
}

export interface SubscriptionTier {
	id: SubscriptionTierId;
	name: string;
	price: number; // USD monthly
	priceLabel: string;
	perks: SubscriptionPerk[];
}

export const SUBSCRIPTION_TIERS: Record<SubscriptionTierId, SubscriptionTier> = {
	free: {
		id: "free",
		name: "Free",
		price: 0,
		priceLabel: "Free",
		perks: [],
	},
	plus: {
		id: "plus",
		name: "FYK Plus",
		price: 9.99,
		priceLabel: "$9.99/mo",
		perks: [
			{ key: "unlimited_likes", label: "Unlimited likes" },
			{ key: "see_who_liked", label: "See who liked you" },
			{ key: "advanced_filters", label: "Advanced filters" },
			{ key: "no_ads", label: "No ads" },
			{ key: "priority_support", label: "Priority support" },
		],
	},
	gold: {
		id: "gold",
		name: "FYK Gold",
		price: 19.99,
		priceLabel: "$19.99/mo",
		perks: [
			{ key: "unlimited_likes", label: "Unlimited likes" },
			{ key: "see_who_liked", label: "See who liked you" },
			{ key: "advanced_filters", label: "Advanced filters" },
			{ key: "no_ads", label: "No ads" },
			{ key: "priority_support", label: "Priority support" },
			{ key: "profile_boost_monthly", label: "1 free profile boost/mo" },
			{ key: "travel_mode", label: "Travel mode" },
			{ key: "read_receipts", label: "Read receipts" },
		],
	},
	platinum: {
		id: "platinum",
		name: "FYK Platinum",
		price: 29.99,
		priceLabel: "$29.99/mo",
		perks: [
			{ key: "unlimited_likes", label: "Unlimited likes" },
			{ key: "see_who_liked", label: "See who liked you" },
			{ key: "advanced_filters", label: "Advanced filters" },
			{ key: "no_ads", label: "No ads" },
			{ key: "priority_support", label: "Priority support" },
			{ key: "profile_boost_monthly", label: "2 free profile boosts/mo" },
			{ key: "travel_mode", label: "Travel mode" },
			{ key: "read_receipts", label: "Read receipts" },
			{ key: "incognito_browse", label: "Incognito browsing" },
			{ key: "highlight_reel", label: "Highlighted profile" },
			{ key: "concierge", label: "Concierge matching" },
		],
	},
};

export function getTier(id: SubscriptionTierId): SubscriptionTier {
	return SUBSCRIPTION_TIERS[id];
}

export function getTierByPrice(price: number): SubscriptionTier | undefined {
	return Object.values(SUBSCRIPTION_TIERS).find((t) => t.price === price);
}
