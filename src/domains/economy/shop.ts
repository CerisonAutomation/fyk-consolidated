// ═══════════════════════════════════════════════════════════════════════════════
// Economy — Shop Catalog & Item Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export type ShopItemCategory = "boost" | "gift" | "consumable";

export interface ShopItem {
	id: string;
	name: string;
	price: number; // bones
	category: ShopItemCategory;
	description: string;
	icon: string;
}

export const SHOP_CATALOG: Record<string, ShopItem> = {
	tap_boost: {
		id: "tap_boost",
		name: "Tap Boost",
		price: 50,
		category: "boost",
		description: "Get seen by more people for 30 minutes",
		icon: "⚡",
	},
	boost: {
		id: "boost",
		name: "Super Boost",
		price: 120,
		category: "boost",
		description: "Top of the grid for 60 minutes",
		icon: "🔥",
	},
	gift_heart: {
		id: "gift_heart",
		name: "Heart Gift",
		price: 20,
		category: "gift",
		description: "Send a heart to a match",
		icon: "❤️",
	},
	gift_fire: {
		id: "gift_fire",
		name: "Fire Gift",
		price: 35,
		category: "gift",
		description: "Send a fire flame to a match",
		icon: "🔥",
	},
	gift_star: {
		id: "gift_star",
		name: "Star Gift",
		price: 60,
		category: "gift",
		description: "Send a golden star to a match",
		icon: "⭐",
	},
};

export const SHOP_ITEM_IDS = Object.keys(SHOP_CATALOG) as Array<
	keyof typeof SHOP_CATALOG
>;

export function getShopItem(itemId: string): ShopItem | undefined {
	return SHOP_CATALOG[itemId];
}

export function getShopItemsByCategory(
	category: ShopItemCategory,
): ShopItem[] {
	return Object.values(SHOP_CATALOG).filter((item) => item.category === category);
}
