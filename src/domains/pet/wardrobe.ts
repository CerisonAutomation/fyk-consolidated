// ═══════════════════════════════════════════════════════════════════════════════
// Pet — Wardrobe Item Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export type WardrobeItemId =
	| "golden_crown"
	| "denim_jacket"
	| "sunglasses"
	| "bandana"
	| "cape"
	| "sneakers"
	| "scepter"
	| "royal_robe";

export type PetStageRequirement = "baby" | "juvenile" | "adult";

export interface WardrobeItem {
	id: WardrobeItemId;
	name: string;
	price: number; // bones
	minStage: PetStageRequirement;
	description: string;
	icon: string;
}

export const WARDROBE_ITEMS: Record<WardrobeItemId, WardrobeItem> = {
	golden_crown: {
		id: "golden_crown",
		name: "Golden Crown",
		price: 60,
		minStage: "juvenile",
		description: "A majestic golden crown fit for royalty",
		icon: "👑",
	},
	denim_jacket: {
		id: "denim_jacket",
		name: "Denim Jacket",
		price: 45,
		minStage: "baby",
		description: "A cool denim jacket for casual vibes",
		icon: "🧥",
	},
	sunglasses: {
		id: "sunglasses",
		name: "Sunglasses",
		price: 25,
		minStage: "baby",
		description: "Stylish shades for sunny adventures",
		icon: "🕶️",
	},
	bandana: {
		id: "bandana",
		name: "Bandana",
		price: 15,
		minStage: "baby",
		description: "A colorful bandana for a relaxed look",
		icon: "🧣",
	},
	cape: {
		id: "cape",
		name: "Cape",
		price: 80,
		minStage: "adult",
		description: "A flowing cape that commands attention",
		icon: "🦸",
	},
	sneakers: {
		id: "sneakers",
		name: "Sneakers",
		price: 35,
		minStage: "baby",
		description: "Comfy sneakers for all-day exploration",
		icon: "👟",
	},
	scepter: {
		id: "scepter",
		name: "Scepter",
		price: 120,
		minStage: "adult",
		description: "A jeweled scepter symbolizing ultimate power",
		icon: "🔱",
	},
	royal_robe: {
		id: "royal_robe",
		name: "Royal Robe",
		price: 150,
		minStage: "adult",
		description: "An opulent robe woven with golden threads",
		icon: "👘",
	},
};

export const WARDROBE_ITEM_IDS = Object.keys(WARDROBE_ITEMS) as Array<WardrobeItemId>;

export function getWardrobeItem(id: WardrobeItemId): WardrobeItem {
	return WARDROBE_ITEMS[id];
}

export function getWardrobeItemsByStage(
	stage: PetStageRequirement,
): WardrobeItem[] {
	const stageOrder: Record<PetStageRequirement, number> = {
		baby: 0,
		juvenile: 1,
		adult: 2,
	};
	const minRank = stageOrder[stage];
	return Object.values(WARDROBE_ITEMS).filter(
		(item) => stageOrder[item.minStage] <= minRank,
	);
}
