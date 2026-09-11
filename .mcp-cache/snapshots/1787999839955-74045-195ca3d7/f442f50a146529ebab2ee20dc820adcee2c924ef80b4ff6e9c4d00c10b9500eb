import z from "zod";

import { mediaUrlSchema } from "./media";
import { unixTimestampMsSchema } from "./types";
import { bodyTypeSchema, sexualPositionSchema } from "./profiles";
import {
	filterAcceptNSFWPicsSchema,
	filterBodyTypeSchema,
	filterHealthPracticesSchema,
	filterLookingForSchema,
	filterMeetAtSchema,
	filterPositionSchema,
	filterRelationshipStatusSchema,
	filterTagsSchema,
	filterTribesSchema,
} from "./grid";

// --- Cascade query ---

export const cascadeQuerySchema = z.object({
	nearbyGeoHash: z.string(),
	exploreGeoHash: z.string().optional(),
	photoOnly: z.boolean().optional(),
	faceOnly: z.boolean().optional(),
	notRecentlyChatted: z.boolean().optional(),
	hasAlbum: z.boolean().optional(),
	fresh: z.boolean().optional(),
	genders: z.array(z.int().nonnegative().or(z.literal(-1))).optional(),
	pageNumber: z.int().nonnegative().optional(),
	onlineOnly: z.boolean().optional(),
	ageMin: z.int().nonnegative().optional(),
	ageMax: z.int().nonnegative().optional(),
	heightCmMin: z.number().nonnegative().optional(),
	heightCmMax: z.number().nonnegative().optional(),
	weightGramsMin: z.number().nonnegative().optional(),
	weightGramsMax: z.number().nonnegative().optional(),
	tribes: filterTribesSchema.optional(),
	lookingFor: filterLookingForSchema.optional(),
	relationshipStatuses: filterRelationshipStatusSchema.optional(),
	bodyTypes: filterBodyTypeSchema.optional(),
	sexualPositions: filterPositionSchema.optional(),
	meetAt: filterMeetAtSchema.optional(),
	nsfwPics: filterAcceptNSFWPicsSchema.optional(),
	tags: filterTagsSchema.optional(),
	sexualHealth: filterHealthPracticesSchema.optional(),
	rightNow: z.boolean().optional(),
	favorites: z.boolean().optional(),
	showSponsoredProfiles: z.boolean().optional(),
	shuffle: z.boolean().optional(),
	hot: z.boolean().optional(),
});

export const cascadeV4QuerySchema = z.object({ ...cascadeQuerySchema.shape });

// --- Cascade response base profile ---

export const cascadeResponseProfileSchema = z.object({
	profileId: z.int().nonnegative(),
	onlineUntil: unixTimestampMsSchema.nullable(),
	displayName: z.string().nullable().optional(),
	distanceMeters: z.int().nonnegative().optional(),
	lastOnline: unixTimestampMsSchema.nullable().optional(),
	rightNow: z.string(),
	unreadCount: z.int().nonnegative(),
	isVisiting: z.boolean(),
	isPopular: z.boolean(),
});

// --- Cascade response item types ---

export const cascadeResponseFullProfileV1Schema = z.object({
	type: z.literal("full_profile_v1"),
	data: z.object({ ...cascadeResponseProfileSchema.shape }),
});

export const cascadeResponsePartialProfileV1Schema = z.object({
	type: z.literal("partial_profile_v1"),
	data: z.object({
		...cascadeResponseProfileSchema.shape,
		upsellItemType: z.string(),
	}),
});

export const cascadeResponseBoostUpsellV1Schema = z.object({
	type: z.literal("boost_upsell_v1"),
	data: z.object({}),
});

export const cascadeResponseUnlimitedMpuV1Schema = z.object({
	type: z.literal("unlimited_mpu_v1"),
	data: z.object({}),
});

export const cascadeResponseXtraMpuV1Schema = z.object({
	type: z.literal("xtra_mpu_v1"),
	data: z.object({}),
});

export const cascadeExploreAggregationLocationItemSchema = z.object({
	"@type": z.literal("ExploreAggregationItem$Location"),
	data: z.object({
		onlineCount: z.int().nonnegative(),
		uuid: z.string(),
		location: z.object({
			id: z.int(),
			name: z.string(),
			suffix: z.string(),
			lat: z.number(),
			lon: z.number(),
		}),
		profiles: z.array(z.object({ profileImageUrl: mediaUrlSchema })),
	}),
});

export const cascadeExploreAggregationCtaItemSchema = z.object({
	"@type": z.literal("ExploreAggregationItem$Cta"),
});

export const cascadeResponseExploreAggregationV1Schema = z.object({
	type: z.literal("explore_aggregation_v1"),
	data: z.object({
		uuid: z.string(),
		headerName: z.string(),
		source: z.string(),
		items: z.array(
			z.discriminatedUnion("@type", [
				cascadeExploreAggregationLocationItemSchema,
				cascadeExploreAggregationCtaItemSchema,
			]),
		),
	}),
});

export const cascadeResponseFavHeaderV1Schema = z.object({
	type: z.literal("favs_header_v1"),
	data: z.object({
		available: z.int().nonnegative(),
		displayed: z.int().nonnegative(),
		total: z.int().nonnegative(),
	}),
});

export const cascadeResponseAdvertV1Schema = z.object({
	type: z.literal("advert_v1"),
	data: z.object({ cascadePlacementName: z.string() }),
});

export const cascadeResponseTopPicksV1Schema = z.object({
	type: z.literal("top_picks_v1"),
	data: z.object({}),
});

export const cascadeResponseHiddenProfileV1Schema = z.object({
	...cascadeResponseFullProfileV1Schema.shape,
	type: z.literal("hidden_profile_v1"),
});

export const cascadeResponseSmartBoostProfileV1Schema = z.object({
	...cascadeResponseFullProfileV1Schema.shape,
	type: z.literal("smart_boost_profile_v1"),
});

export const cascadeResponseSponsoredProfileV1Schema = z.object({
	type: z.literal("sponsored_profile_v1"),
	data: z.object({
		cascadePlacementName: z.string(),
		alternativeProfile: cascadeResponseFullProfileV1Schema.shape.data,
	}),
});

export const cascadeResponseBrazeEventProfileV1Schema = z.object({
	type: z.literal("braze_event_profile_v1"),
	data: z.object({
		profileId: z.int().nonnegative(),
		onlineUntil: unixTimestampMsSchema.nullable().optional(),
		displayName: z.string().nullable().optional(),
		primaryImageUrl: mediaUrlSchema.nullable().optional(),
		eventName: z.string(),
	}),
});

export const cascadeResponseFavsXtraUpsellV1Schema = z.object({
	type: z.literal("favs_xtra_upsell_v1"),
	data: z.object({ available: z.int().nonnegative() }),
});

export const cascadeResponseFavsUnlimitedUpsellV1Schema = z.object({
	type: z.literal("favs_unlimited_upsell_v1"),
	data: z.object({}),
});

export const cascadeResponseFavoritesHeaderNoFreeResultsV1Schema = z.object({
	type: z.literal("favorites_header_no_free_results_v1"),
	data: z.object({}),
});

export const cascadeResponseFavoritesHeaderNoXtraResultsV1Schema = z.object({
	type: z.literal("favorites_header_no_xtra_results_v1"),
	data: z.object({}),
});

export const cascadeResponseProfileHideStatusSchema = z.object({
	type: z.literal("profile_hide_status"),
	count: z.int().nonnegative(),
});

export const cascadeResponseSchema = z.object({
	items: z.array(z.unknown()),
	nextPage: z.int().nonnegative().nullable(),
	shuffled: z.boolean(),
	hiddenProfiles: z.unknown(),
	hiddenProfileInfo: z.unknown(),
});

// --- Cascade V4 response ---

const cascadeV4ResponseProfileSchema = z.object({
	...cascadeResponseProfileSchema.shape,
	primaryImageUrl: mediaUrlSchema.nullish(),
	favorite: z.boolean().optional(),
	viewed: z.boolean().optional(),
	chatted: z.boolean().optional(),
	roaming: z.boolean().optional(),
});

export const cascadeV4ResponseFullProfileV1Schema = z.object({
	...cascadeResponseFullProfileV1Schema.shape,
	data: z.object({
		...cascadeResponseFullProfileV1Schema.shape.data.shape,
		...cascadeV4ResponseProfileSchema.shape,
		age: z.int().nonnegative().optional(),
		heightCm: z.number().nonnegative().optional(),
		weightGrams: z.number().nonnegative().optional(),
		bodyType: bodyTypeSchema.nullish(),
		sexualPosition: sexualPositionSchema.nullish(),
	}),
});

export const cascadeV4ResponseAdvertV1Schema = z.object({
	...cascadeResponseAdvertV1Schema.shape,
});

export const cascadeV4ResponseTopPicksV1Schema = z.object({
	...cascadeResponseTopPicksV1Schema.shape,
});

export const cascadeV4ResponsePartialProfileV1Schema = z.object({
	...cascadeResponsePartialProfileV1Schema.shape,
	data: z.object({
		...cascadeResponsePartialProfileV1Schema.shape.data.shape,
		...cascadeV4ResponseProfileSchema.shape,
	}),
});

export const cascadeV4ResponseExploreAggregationV1Schema = z.object({
	...cascadeResponseExploreAggregationV1Schema.shape,
});

export const cascadeV4ResponseBoostUpsellV1Schema = z.object({
	...cascadeResponseBoostUpsellV1Schema.shape,
});

export const cascadeV4ResponseUnlimitedMpuV1Schema = z.object({
	...cascadeResponseUnlimitedMpuV1Schema.shape,
});

export const cascadeV4ResponseXtraMpuV1Schema = z.object({
	...cascadeResponseXtraMpuV1Schema.shape,
});

export const cascadeV4ResponseFavHeaderV1Schema = z.object({
	...cascadeResponseFavHeaderV1Schema.shape,
});

export const cascadeV4ResponseHiddenProfileV1Schema = z.object({
	...cascadeV4ResponseFullProfileV1Schema.shape,
	type: z.literal("hidden_profile_v1"),
});

export const cascadeV4ResponseSmartBoostProfileV1Schema = z.object({
	...cascadeV4ResponseFullProfileV1Schema.shape,
	type: z.literal("smart_boost_profile_v1"),
});

export const cascadeV4ResponseSponsoredProfileV1Schema = z.object({
	...cascadeResponseSponsoredProfileV1Schema.shape,
	data: z.object({
		...cascadeResponseSponsoredProfileV1Schema.shape.data.shape,
		alternativeProfile: cascadeV4ResponseFullProfileV1Schema.shape.data,
	}),
});

export const cascadeV4ResponseBrazeEventProfileV1Schema = z.object({
	...cascadeResponseBrazeEventProfileV1Schema.shape,
});

export const cascadeV4ResponseFavsXtraUpsellV1Schema = z.object({
	...cascadeResponseFavsXtraUpsellV1Schema.shape,
});

export const cascadeV4ResponseFavsUnlimitedUpsellV1Schema = z.object({
	...cascadeResponseFavsUnlimitedUpsellV1Schema.shape,
});

export const cascadeV4ResponseFavoritesHeaderNoFreeResultsV1Schema = z.object({
	...cascadeResponseFavoritesHeaderNoFreeResultsV1Schema.shape,
});

export const cascadeV4ResponseFavoritesHeaderNoXtraResultsV1Schema = z.object({
	...cascadeResponseFavoritesHeaderNoXtraResultsV1Schema.shape,
});

export const cascadeV4ResponseProfileHideStatusSchema = z.object({
	...cascadeResponseProfileHideStatusSchema.shape,
});

export const cascadeV4ResponseItemSchema = z.discriminatedUnion("type", [
	cascadeV4ResponseFullProfileV1Schema,
	cascadeV4ResponsePartialProfileV1Schema,
	cascadeV4ResponseAdvertV1Schema,
	cascadeV4ResponseTopPicksV1Schema,
	cascadeV4ResponseExploreAggregationV1Schema,
	cascadeV4ResponseBoostUpsellV1Schema,
	cascadeV4ResponseUnlimitedMpuV1Schema,
	cascadeV4ResponseXtraMpuV1Schema,
	cascadeV4ResponseFavHeaderV1Schema,
	cascadeV4ResponseHiddenProfileV1Schema,
	cascadeV4ResponseSmartBoostProfileV1Schema,
	cascadeV4ResponseSponsoredProfileV1Schema,
	cascadeV4ResponseBrazeEventProfileV1Schema,
	cascadeV4ResponseFavsXtraUpsellV1Schema,
	cascadeV4ResponseFavsUnlimitedUpsellV1Schema,
	cascadeV4ResponseFavoritesHeaderNoFreeResultsV1Schema,
	cascadeV4ResponseFavoritesHeaderNoXtraResultsV1Schema,
	cascadeV4ResponseProfileHideStatusSchema,
]);

export const cascadeV4ResponseSchema = z.object({
	...cascadeResponseSchema.shape,
	items: z.array(cascadeV4ResponseItemSchema),
});
