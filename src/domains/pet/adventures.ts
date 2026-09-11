// ═══════════════════════════════════════════════════════════════════════════════
// Pet — Adventure Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export type AdventureId =
	| "coffee_crawl"
	| "rooftop_sunset"
	| "pride_parade"
	| "deep_forest_hike";

export interface Adventure {
	id: AdventureId;
	name: string;
	cost: number; // bones
	xpReward: number;
	description: string;
	icon: string;
	durationMinutes: number;
}

export const ADVENTURES: Record<AdventureId, Adventure> = {
	coffee_crawl: {
		id: "coffee_crawl",
		name: "Coffee Crawl",
		cost: 20,
		xpReward: 30,
		description:
			"Explore the best coffee shops in the neighborhood with your pet",
		icon: "☕",
		durationMinutes: 60,
	},
	rooftop_sunset: {
		id: "rooftop_sunset",
		name: "Rooftop Sunset",
		cost: 35,
		xpReward: 50,
		description:
			"Watch the sunset from the tallest rooftop in the city",
		icon: "🌅",
		durationMinutes: 90,
	},
	pride_parade: {
		id: "pride_parade",
		name: "Pride Parade",
		cost: 50,
		xpReward: 80,
		description:
			"March in the pride parade and celebrate with the community",
		icon: "🏳️‍🌈",
		durationMinutes: 120,
	},
	deep_forest_hike: {
		id: "deep_forest_hike",
		name: "Deep Forest Hike",
		cost: 25,
		xpReward: 40,
		description:
			"Venture deep into the forest on a scenic hiking trail",
		icon: "🌲",
		durationMinutes: 75,
	},
};

export const ADVENTURE_IDS = Object.keys(ADVENTURES) as Array<AdventureId>;

export function getAdventure(id: AdventureId): Adventure {
	return ADVENTURES[id];
}
