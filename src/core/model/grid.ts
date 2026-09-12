import z from "zod";

import {
	AcceptNSFWPics,
	BodyType,
	HealthPractice,
	LookingFor,
	MeetAt,
	RelationshipStatus,
	SexualPosition,
	Tribe,
} from "./profiles";
import { geohashSchema } from "./geohash";
import { mediaHashPublicSchema } from "./media";

// --- Filter schemas ---

const filterIsFavoriteSchema = z.boolean();
const filterIsOnlineSchema = z.boolean();
const filterIsRightNowSchema = z.boolean();
const filterIsFreshSchema = z.boolean();

const AGE_MIN = 18;
const AGE_MAX = 102;

export const ageRangeLabel = ([from, to]: number[]) =>
	to === AGE_MAX ? `${from} years & over` : `${from} - ${to}`;

const filterAgeEnabledSchema = z.boolean();
const filterAgeSchema = z.array(z.number().min(AGE_MIN).max(AGE_MAX)).length(2);

const filterGendersEnabledSchema = z.boolean().default(false);
const filterGendersSchema = z.array(z.int().nonnegative().or(z.literal(-1)));

const filterTagsEnabledSchema = z.boolean();
export const filterTagsSchema = z.array(z.string());

const filterPositionEnabledSchema = z.boolean();
const FilterPosition = { ...SexualPosition, NotSpecified: -1 } as const;
export type FilterPositionId =
	(typeof FilterPosition)[keyof typeof FilterPosition];
export const filterPositionSchema = z.array(z.enum(FilterPosition));

const filterPhotosEnabledSchema = z.boolean();
const filterPhotosSchema = z.array(
	z.enum(["has-photos", "has-face-pics", "has-albums"]),
);

const filterTribesEnabledSchema = z.boolean();
const FilterTribe = { ...Tribe, NotSpecified: -1 } as const;
export type FilterTribeId = (typeof FilterTribe)[keyof typeof FilterTribe];
export const filterTribesSchema = z.array(z.enum(FilterTribe));

const filterBodyTypeEnabledSchema = z.boolean();
const FilterBodyType = { ...BodyType, NotSpecified: -1 } as const;
export type FilterBodyTypeId =
	(typeof FilterBodyType)[keyof typeof FilterBodyType];
export const filterBodyTypeSchema = z.array(z.enum(FilterBodyType));

const HEIGHT_CM_MIN = 120;
const HEIGHT_CM_MAX = 242;
const WEIGHT_KG_MIN = 40;
const WEIGHT_KG_MAX = 273;

const filterHeightEnabledSchema = z.boolean();
const filterHeightSchema = z
	.array(z.number().min(HEIGHT_CM_MIN).max(HEIGHT_CM_MAX))
	.length(2);

const filterWeightEnabledSchema = z.boolean();
const filterWeightSchema = z
	.array(z.number().min(WEIGHT_KG_MIN).max(WEIGHT_KG_MAX))
	.length(2);

const filterRelationshipStatusEnabledSchema = z.boolean();
const FilterRelationshipStatus = {
	...RelationshipStatus,
	NotSpecified: -1,
} as const;
export type FilterRelationshipStatusId =
	(typeof FilterRelationshipStatus)[keyof typeof FilterRelationshipStatus];
export const filterRelationshipStatusSchema = z.array(
	z.enum(FilterRelationshipStatus),
);

const filterAcceptNSFWPicsEnabledSchema = z.boolean();
const FilterAcceptNSFWPics = {
	...AcceptNSFWPics,
	NotSpecified: -1,
} as const;
export type FilterAcceptNSFWPicsId =
	(typeof FilterAcceptNSFWPics)[keyof typeof FilterAcceptNSFWPics];
export const filterAcceptNSFWPicsSchema = z.array(z.enum(FilterAcceptNSFWPics));

const filterLookingForEnabledSchema = z.boolean();
const FilterLookingFor = { ...LookingFor, NotSpecified: -1 } as const;
export type FilterLookingForId =
	(typeof FilterLookingFor)[keyof typeof FilterLookingFor];
export const filterLookingForSchema = z.array(z.enum(FilterLookingFor));

const filterMeetAtEnabledSchema = z.boolean();
const FilterMeetAt = { ...MeetAt, NotSpecified: -1 } as const;
export type FilterMeetAtId = (typeof FilterMeetAt)[keyof typeof FilterMeetAt];
export const filterMeetAtSchema = z.array(z.enum(FilterMeetAt));

const filterHaventChattedTodayEnabledSchema = z.boolean();

const filterHealthPracticesEnabledSchema = z.boolean();
const FilterHealthPractice = {
	...HealthPractice,
	NotSpecified: -1,
} as const;
export type FilterHealthPracticeId =
	(typeof FilterHealthPractice)[keyof typeof FilterHealthPractice];
export const filterHealthPracticesSchema = z.array(
	z.enum(FilterHealthPractice),
);

// --- Grid search filters ---

const gridSearchFiltersSchema = z.object({
	isFavorite: filterIsFavoriteSchema.default(false),
	isOnline: filterIsOnlineSchema.default(false),
	isRightNow: filterIsRightNowSchema.default(false),

	ageEnabled: filterAgeEnabledSchema.default(false),
	age: filterAgeSchema.default([AGE_MIN, AGE_MAX]),

	genderEnabled: filterGendersEnabledSchema.default(false),
	genders: filterGendersSchema.default([]),

	tagsEnabled: filterTagsEnabledSchema.default(false),
	tags: filterTagsSchema.default([]),

	positionEnabled: filterPositionEnabledSchema.default(false),
	positions: filterPositionSchema.default([]),

	photosEnabled: filterPhotosEnabledSchema.default(false),
	photos: filterPhotosSchema.default([]),

	tribesEnabled: filterTribesEnabledSchema.default(false),
	tribes: filterTribesSchema.default([]),

	bodyTypesEnabled: filterBodyTypeEnabledSchema.default(false),
	bodyTypes: filterBodyTypeSchema.default([]),

	heightEnabled: filterHeightEnabledSchema.default(false),
	height: filterHeightSchema.default([HEIGHT_CM_MIN, HEIGHT_CM_MAX]),

	weightEnabled: filterWeightEnabledSchema.default(false),
	weight: filterWeightSchema.default([WEIGHT_KG_MIN, WEIGHT_KG_MAX]),

	relationshipStatusesEnabled:
		filterRelationshipStatusEnabledSchema.default(false),
	relationshipStatuses: filterRelationshipStatusSchema.default([]),

	acceptNSFWPicsEnabled: filterAcceptNSFWPicsEnabledSchema.default(false),
	acceptNSFWPics: filterAcceptNSFWPicsSchema.default([]),

	lookingForEnabled: filterLookingForEnabledSchema.default(false),
	lookingFor: filterLookingForSchema.default([]),

	meetAtEnabled: filterMeetAtEnabledSchema.default(false),
	meetAt: filterMeetAtSchema.default([]),

	haventChattedTodayEnabled:
		filterHaventChattedTodayEnabledSchema.default(false),

	healthPracticesEnabled: filterHealthPracticesEnabledSchema.default(false),
	healthPractices: filterHealthPracticesSchema.default([]),

	isFresh: filterIsFreshSchema.default(false),
});

export type GridSearchFilters = z.infer<typeof gridSearchFiltersSchema>;

export const defaultFilters: GridSearchFilters = gridSearchFiltersSchema.parse(
	{},
);

// --- Grid query ---

const gridQuerySchema = z.object({
	nearbyGeoHash: geohashSchema,
	exploreGeoHash: geohashSchema.optional(),
	photoOnly: z.boolean().optional(),
	faceOnly: z.boolean().optional(),
	notRecentlyChatted: z.boolean().optional(),
	hasAlbum: z.boolean().optional(),
	fresh: z.boolean().optional(),
	genders: filterGendersSchema.optional(),
	pageNumber: z.int().nonnegative().optional(),
});

// --- Search schemas ---

export const searchQuerySchema = gridQuerySchema.extend({
	online: z.boolean().optional(),
	ageMinimum: z.int().nonnegative().optional(),
	ageMaximum: z.int().nonnegative().optional(),
	heightMinimum: z.number().nonnegative().optional(),
	heightMaximum: z.number().nonnegative().optional(),
	weightMinimum: z.number().nonnegative().optional(),
	weightMaximum: z.number().nonnegative().optional(),
	grindrTribesIds: filterTribesSchema.optional(),
	lookingForIds: filterLookingForSchema.optional(),
	relationshipStatusIds: filterRelationshipStatusSchema.optional(),
	bodyTypeIds: filterBodyTypeSchema.optional(),
	sexualPositionIds: filterPositionSchema.optional(),
	meetAtIds: filterMeetAtSchema.optional(),
	nsfwIds: filterAcceptNSFWPicsSchema.optional(),
	profileTags: z.string().optional(),
	searchAfterDistance: z.string().optional(),
	searchAfterProfileId: z.string().optional(),
	freeFilter: z.boolean().optional(),
});

const searchProfileSchema = z.object({
	profileId: z.coerce.number().int().nonnegative(),
	displayName: z.string().nullable(),
	age: z.int().nonnegative().nullable(),
	distance: z.number().nullable(),
	medias: z.array(z.object({ mediaHash: mediaHashPublicSchema })).nullable(),
});

export const searchProfilesResponseSchema = z.object({
	profiles: z.array(searchProfileSchema),
});
