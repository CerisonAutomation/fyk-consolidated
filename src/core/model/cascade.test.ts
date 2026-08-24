import { describe, it, expect } from "vitest";
import {
	cascadeV4ResponseSchema,
	cascadeV4ResponseFullProfileV1Schema,
	cascadeV4ResponsePartialProfileV1Schema,
	cascadeV4ResponseItemSchema,
	cascadeV4QuerySchema,
	cascadeResponseProfileSchema,
} from "./cascade";

describe("cascadeV4QuerySchema", () => {
	it("parses a valid query with required fields only", () => {
		const result = cascadeV4QuerySchema.safeParse({
			nearbyGeoHash: "dr5ru",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.nearbyGeoHash).toBe("dr5ru");
			expect(result.data.pageNumber).toBeUndefined();
		}
	});

	it("parses a query with all optional fields using numeric enum values", () => {
		const result = cascadeV4QuerySchema.safeParse({
			nearbyGeoHash: "dr5ru",
			pageNumber: 2,
			onlineOnly: true,
			ageMin: 18,
			ageMax: 35,
			favorites: true,
			rightNow: true,
			fresh: true,
			genders: [1, 2],
			heightCmMin: 170,
			heightCmMax: 190,
			weightGramsMin: 60000,
			weightGramsMax: 90000,
			tribes: [1, 6],         // Bear=1, Jock=6
			lookingFor: [2, 3],     // Chat=2, Dates=3
			relationshipStatuses: [1], // Single=1
			bodyTypes: [1, 4],      // Toned=1, Muscular=4
			sexualPositions: [1],   // Top=1
			meetAt: [3],            // Bar=3
			nsfwPics: [3],          // YesPlease=3
			tags: ["friends"],
			sexualHealth: [3],      // PrEP=3
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.ageMin).toBe(18);
			expect(result.data.ageMax).toBe(35);
			expect(result.data.genders).toEqual([1, 2]);
			expect(result.data.tribes).toEqual([1, 6]);
			expect(result.data.lookingFor).toEqual([2, 3]);
		}
	});

	it("rejects a query missing nearbyGeoHash", () => {
		const result = cascadeV4QuerySchema.safeParse({});
		expect(result.success).toBe(false);
	});
});

describe("cascadeResponseProfileSchema", () => {
	it("parses a valid profile", () => {
		const result = cascadeResponseProfileSchema.safeParse({
			profileId: 12345,
			onlineUntil: 1700000000000,
			displayName: "Test User",
			distanceMeters: 1500,
			rightNow: "NOT_ACTIVE",
			unreadCount: 2,
			isVisiting: false,
			isPopular: true,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.profileId).toBe(12345);
			expect(result.data.displayName).toBe("Test User");
			expect(result.data.distanceMeters).toBe(1500);
			expect(result.data.unreadCount).toBe(2);
		}
	});

	it("parses profile with null optional fields", () => {
		const result = cascadeResponseProfileSchema.safeParse({
			profileId: 1,
			onlineUntil: null,
			rightNow: "NOT_ACTIVE",
			unreadCount: 0,
			isVisiting: false,
			isPopular: false,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.onlineUntil).toBeNull();
			expect(result.data.displayName).toBeUndefined();
		}
	});

	it("rejects profile with negative profileId", () => {
		const result = cascadeResponseProfileSchema.safeParse({
			profileId: -1,
			onlineUntil: null,
			rightNow: "NOT_ACTIVE",
			unreadCount: 0,
			isVisiting: false,
			isPopular: false,
		});
		expect(result.success).toBe(false);
	});
});

describe("cascadeV4ResponseFullProfileV1Schema", () => {
	it("parses a full profile item with numeric enum values", () => {
		const result = cascadeV4ResponseFullProfileV1Schema.safeParse({
			type: "full_profile_v1",
			data: {
				profileId: 100,
				onlineUntil: 1700000000000,
				displayName: "Full User",
				distanceMeters: 500,
				rightNow: "NOT_ACTIVE",
				unreadCount: 0,
				isVisiting: false,
				isPopular: false,
				primaryImageUrl: "https://example.com/photo.jpg",
				favorite: true,
				viewed: false,
				chatted: true,
				age: 25,
				heightCm: 180,
				weightGrams: 75000,
				bodyType: 1,            // Toned=1
				sexualPosition: 1,      // Top=1
			},
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("full_profile_v1");
			expect(result.data.data.profileId).toBe(100);
			expect(result.data.data.favorite).toBe(true);
			expect(result.data.data.age).toBe(25);
		}
	});

	it("parses a full profile with null optional fields", () => {
		const result = cascadeV4ResponseFullProfileV1Schema.safeParse({
			type: "full_profile_v1",
			data: {
				profileId: 101,
				onlineUntil: null,
				rightNow: "NOT_ACTIVE",
				unreadCount: 0,
				isVisiting: false,
				isPopular: false,
				bodyType: null,
				sexualPosition: null,
			},
		});
		expect(result.success).toBe(true);
	});

	it("rejects item with wrong type literal", () => {
		const result = cascadeV4ResponseFullProfileV1Schema.safeParse({
			type: "partial_profile_v1",
			data: {
				profileId: 100,
				onlineUntil: null,
				rightNow: "NOT_ACTIVE",
				unreadCount: 0,
				isVisiting: false,
				isPopular: false,
			},
		});
		expect(result.success).toBe(false);
	});
});

describe("cascadeV4ResponsePartialProfileV1Schema", () => {
	it("parses a partial profile item", () => {
		const result = cascadeV4ResponsePartialProfileV1Schema.safeParse({
			type: "partial_profile_v1",
			data: {
				profileId: 200,
				onlineUntil: null,
				rightNow: "NOT_ACTIVE",
				unreadCount: 1,
				isVisiting: true,
				isPopular: false,
				upsellItemType: "boost_upsell_v1",
			},
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.type).toBe("partial_profile_v1");
			expect(result.data.data.upsellItemType).toBe("boost_upsell_v1");
		}
	});
});

describe("cascadeV4ResponseItemSchema (discriminated union)", () => {
	it("parses a full_profile_v1 item", () => {
		const result = cascadeV4ResponseItemSchema.safeParse({
			type: "full_profile_v1",
			data: {
				profileId: 1,
				onlineUntil: null,
				rightNow: "NOT_ACTIVE",
				unreadCount: 0,
				isVisiting: false,
				isPopular: false,
			},
		});
		expect(result.success).toBe(true);
	});

	it("parses an advert_v1 item", () => {
		const result = cascadeV4ResponseItemSchema.safeParse({
			type: "advert_v1",
			data: {
				cascadePlacementName: "home_grid",
			},
		});
		expect(result.success).toBe(true);
	});

	it("parses a top_picks_v1 item", () => {
		const result = cascadeV4ResponseItemSchema.safeParse({
			type: "top_picks_v1",
			data: {},
		});
		expect(result.success).toBe(true);
	});

	it("parses a favs_header_v1 item", () => {
		const result = cascadeV4ResponseItemSchema.safeParse({
			type: "favs_header_v1",
			data: {
				available: 5,
				displayed: 3,
				total: 10,
			},
		});
		expect(result.success).toBe(true);
	});

	it("rejects an unknown type", () => {
		const result = cascadeV4ResponseItemSchema.safeParse({
			type: "unknown_type_v1",
			data: {},
		});
		expect(result.success).toBe(false);
	});
});

describe("cascadeV4ResponseSchema (full response)", () => {
	it("parses a complete response with mixed items", () => {
		const result = cascadeV4ResponseSchema.safeParse({
			items: [
				{
					type: "full_profile_v1",
					data: {
						profileId: 1,
						onlineUntil: null,
						rightNow: "NOT_ACTIVE",
						unreadCount: 0,
						isVisiting: false,
						isPopular: false,
					},
				},
				{
					type: "advert_v1",
					data: { cascadePlacementName: "home_grid" },
				},
			],
			nextPage: 1,
			shuffled: false,
			hiddenProfiles: null,
			hiddenProfileInfo: null,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.items).toHaveLength(2);
			expect(result.data.nextPage).toBe(1);
			expect(result.data.shuffled).toBe(false);
		}
	});

	it("parses response with null nextPage", () => {
		const result = cascadeV4ResponseSchema.safeParse({
			items: [],
			nextPage: null,
			shuffled: false,
			hiddenProfiles: null,
			hiddenProfileInfo: null,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.nextPage).toBeNull();
		}
	});
});
