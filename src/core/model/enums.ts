/**
 * Complete Enum & Vocabulary Catalog — Romeo v3.42.0 + Grindr + Omolink + Rizz
 * Production-level, type-safe, exhaustive.
 *
 * Sourced from decompiled enum catalogs, harvest files, and production apps.
 * Every enum is frozen, documented, and has helper guards.
 */

// ─────────────────────────────────────────────────────────────────────────────
// E1. Profile Attribute Enums
// ─────────────────────────────────────────────────────────────────────────────

export const AnalPosition = {
  NO_ENTRY: "NO_ENTRY",
  TOP_ONLY: "TOP_ONLY",
  MORE_TOP: "MORE_TOP",
  VERSATILE: "VERSATILE",
  MORE_BOTTOM: "MORE_BOTTOM",
  BOTTOM_ONLY: "BOTTOM_ONLY",
  NO: "NO",
} as const;
export type AnalPosition = (typeof AnalPosition)[keyof typeof AnalPosition];

export const BodyHair = {
  NO_ENTRY: "NO_ENTRY",
  SMOOTH: "SMOOTH",
  SHAVED: "SHAVED",
  LITTLE: "LITTLE",
  AVERAGE: "AVERAGE",
  VERY_HAIRY: "VERY_HAIRY",
} as const;
export type BodyHair = (typeof BodyHair)[keyof typeof BodyHair];

export const BodyType = {
  NO_ENTRY: "NO_ENTRY",
  SLIM: "SLIM",
  AVERAGE: "AVERAGE",
  ATHLETIC: "ATHLETIC",
  MUSCULAR: "MUSCULAR",
  BELLY: "BELLY",
  STOCKY: "STOCKY",
} as const;
export type BodyType = (typeof BodyType)[keyof typeof BodyType];

export const Ethnicity = {
  NO_ENTRY: "NO_ENTRY",
  CAUCASIAN: "CAUCASIAN",
  ASIAN: "ASIAN",
  LATIN: "LATIN",
  MEDITERRANEAN: "MEDITERRANEAN",
  BLACK: "BLACK",
  MIXED: "MIXED",
  ARAB: "ARAB",
  INDIAN: "INDIAN",
} as const;
export type Ethnicity = (typeof Ethnicity)[keyof typeof Ethnicity];

export const Relationship = {
  NO_ENTRY: "NO_ENTRY",
  SINGLE: "SINGLE",
  PARTNER: "PARTNER",
  OPEN: "OPEN",
  MARRIED: "MARRIED",
} as const;
export type Relationship = (typeof Relationship)[keyof typeof Relationship];

export const Gender = {
  NO_ENTRY: "NO_ENTRY",
  MAN: "MAN",
  TRANS_MAN: "TRANS_MAN",
  TRANS_WOMAN: "TRANS_WOMAN",
  NON_BINARY: "NON_BINARY",
  OTHER: "OTHER",
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const Orientation = {
  NO_ENTRY: "NO_ENTRY",
  GAY: "GAY",
  BISEXUAL: "BISEXUAL",
  STRAIGHT: "STRAIGHT",
  QUEER: "QUEER",
  OTHER: "OTHER",
} as const;
export type Orientation = (typeof Orientation)[keyof typeof Orientation];

export const Smoker = {
  NO_ENTRY: "NO_ENTRY",
  NO: "NO",
  SOCIALLY: "SOCIALLY",
  YES: "YES",
} as const;
export type Smoker = (typeof Smoker)[keyof typeof Smoker];

// ─────────────────────────────────────────────────────────────────────────────
// E2. Sexual Information Enums
// ─────────────────────────────────────────────────────────────────────────────

export const DickSize = {
  NO_ENTRY: "NO_ENTRY",
  S: "S",
  M: "M",
  L: "L",
  XL: "XL",
  XXL: "XXL",
} as const;
export type DickSize = (typeof DickSize)[keyof typeof DickSize];

export const SaferSex = {
  NO_ENTRY: "NO_ENTRY",
  ALWAYS: "ALWAYS",
  NEEDS_DISCUSSION: "NEEDS_DISCUSSION",
  CONDOM: "CONDOM",
  PREP: "PREP",
  PREP_AND_CONDOM: "PREP_AND_CONDOM",
  TASP: "TASP",
} as const;
export type SaferSex = (typeof SaferSex)[keyof typeof SaferSex];

export const DirtySex = {
  NO_ENTRY: "NO_ENTRY",
  NO: "NO",
  WS_ONLY: "WS_ONLY",
  YES: "YES",
} as const;
export type DirtySex = (typeof DirtySex)[keyof typeof DirtySex];

export const Sm = {
  NO_ENTRY: "NO_ENTRY",
  NO: "NO",
  SOFT: "SOFT",
  YES: "YES",
} as const;
export type Sm = (typeof Sm)[keyof typeof Sm];

export const Fisting = {
  NO_ENTRY: "NO_ENTRY",
  ACTIVE: "ACTIVE",
  ACTIVE_PASSIVE: "ACTIVE_PASSIVE",
  PASSIVE: "PASSIVE",
  NO: "NO",
} as const;
export type Fisting = (typeof Fisting)[keyof typeof Fisting];

export const Concision = {
  NO_ENTRY: "NO_ENTRY",
  CUT: "CUT",
  UNCUT: "UNCUT",
} as const;
export type Concision = (typeof Concision)[keyof typeof Concision];

// ─────────────────────────────────────────────────────────────────────────────
// E3. Hobby / Interest Enums
// ─────────────────────────────────────────────────────────────────────────────

export const Interest = {
  ART: "ART",
  BOARDGAME: "BOARDGAME",
  CAR: "CAR",
  COLLECT: "COLLECT",
  COOK: "COOK",
  COMPUTER: "COMPUTER",
  DANCE: "DANCE",
  FILM: "FILM",
  GAME: "GAME",
  LITERATURE: "LITERATURE",
  MODELING: "MODELING",
  MOTORBIKE: "MOTORBIKE",
  MUSIC: "MUSIC",
  NATURE: "NATURE",
  FOTO: "FOTO",
  POLITICS: "POLITICS",
  TV: "TV",
} as const;
export type Interest = (typeof Interest)[keyof typeof Interest];

// ─────────────────────────────────────────────────────────────────────────────
// E4. Search & Filter Enums
// ─────────────────────────────────────────────────────────────────────────────

export const DisplayStat = {
  AGE: "AGE",
  HEIGHT: "HEIGHT",
  WEIGHT: "WEIGHT",
  POSITION: "POSITION",
  AGE_RANGE: "AGE_RANGE",
  BODY_HAIR: "BODY_HAIR",
  BODY_TYPE: "BODY_TYPE",
  ETHNICITY: "ETHNICITY",
  RELATIONSHIP: "RELATIONSHIP",
  SIZE: "SIZE",
  SAFE: "SAFE",
  DIRTY: "DIRTY",
  SM: "SM",
  FF: "FF",
} as const;
export type DisplayStat = (typeof DisplayStat)[keyof typeof DisplayStat];

export const TravellerFilter = {
  INCLUDED: "INCLUDED",
  EXCLUDED: "EXCLUDED",
  TRAVELLERS_ONLY: "TRAVELLERS_ONLY",
} as const;
export type TravellerFilter = (typeof TravellerFilter)[keyof typeof TravellerFilter];

export const BedBreakfastFilter = {
  WITH: "WITH",
  WITHOUT: "WITHOUT",
  ONLY: "ONLY",
} as const;
export type BedBreakfastFilter = (typeof BedBreakfastFilter)[keyof typeof BedBreakfastFilter];

export const OnlineStatusFilter = {
  ONLINE: "ONLINE",
  DATE: "DATE",
  SEX: "SEX",
} as const;
export type OnlineStatusFilter = (typeof OnlineStatusFilter)[keyof typeof OnlineStatusFilter];

export const FullTextSearchMode = {
  ANY: "ANY",
  ALL: "ALL",
  EXACT: "EXACT",
} as const;
export type FullTextSearchMode = (typeof FullTextSearchMode)[keyof typeof FullTextSearchMode];

export const SearchTabs = {
  ROMEOS: "ROMEOS",
  HASHTAGS: "HASHTAGS",
  PROFILE_TEXT: "PROFILE_TEXT",
} as const;
export type SearchTabs = (typeof SearchTabs)[keyof typeof SearchTabs];

export const RadarTab = {
  DISCOVER: "DISCOVER",
  DISTANCE: "DISTANCE",
  ACTIVITY: "ACTIVITY",
  NEW: "NEW",
} as const;
export type RadarTab = (typeof RadarTab)[keyof typeof RadarTab];

export const Sorting = {
  NEARBY_ASC: "NEARBY_ASC",
  LAST_LOGIN_DESC: "LAST_LOGIN_DESC",
  SIGNUP_DESC: "SIGNUP_DESC",
  ALPHABETICAL_ASC: "ALPHABETICAL_ASC",
} as const;
export type Sorting = (typeof Sorting)[keyof typeof Sorting];

export const SearchContext = {
  GROUP: "GROUP",
  GROUP_MEMBER: "GROUP_MEMBER",
  POPULAR_PROFILES: "POPULAR_PROFILES",
  RADAR: "RADAR",
  START_PAGE: "START_PAGE",
  TRAVEL: "TRAVEL",
} as const;
export type SearchContext = (typeof SearchContext)[keyof typeof SearchContext];

// ─────────────────────────────────────────────────────────────────────────────
// E5. Cruise & Navigation Enums
// ─────────────────────────────────────────────────────────────────────────────

export const CruiseTab = {
  VISITORS: 0,
  VISITED: 1,
  LIKES: 2,
} as const;
export type CruiseTab = (typeof CruiseTab)[keyof typeof CruiseTab];

export const DiscoverLane = {
  BLOG: "BLOG",
  NEW: "NEW",
  TRAVELLERS_ARRIVING: "TRAVELLERS_ARRIVING",
  EYECANDY: "EYECANDY",
  PICTURES_I_LIKED: "PICTURES_I_LIKED",
} as const;
export type DiscoverLane = (typeof DiscoverLane)[keyof typeof DiscoverLane];

// ─────────────────────────────────────────────────────────────────────────────
// E6. Media & Picture Enums
// ─────────────────────────────────────────────────────────────────────────────

export const PictureRestriction = {
  NON_PLUS: "NON_PLUS",
} as const;
export type PictureRestriction = (typeof PictureRestriction)[keyof typeof PictureRestriction];

export const RatingPicture = {
  NEUTRAL: "NEUTRAL",
  EROTIC: "EROTIC",
  HARDCORE: "HARDCORE",
  ILLEGAL: "ILLEGAL",
  UNPROCESSED: "UNPROCESSED",
  QUEUED: "QUEUED",
  REJECTED: "REJECTED",
  BLACKLISTED: "BLACKLISTED",
  DELETING: "DELETING",
  APP_SAFE: "APP_SAFE",
} as const;
export type RatingPicture = (typeof RatingPicture)[keyof typeof RatingPicture];

// ─────────────────────────────────────────────────────────────────────────────
// E7. Notification & Push Enums
// ─────────────────────────────────────────────────────────────────────────────

export const PushEvent = {
  UNKNOWN: -1,
  MESSAGE: 0,
  FOOTPRINT: 1,
  QUICKSHAREREQUEST: 3,
  QUICKSHAREGRANT: 4,
  FORWARDSIGNAL: 6,
  VISIT: 8,
  REENGAGEMENT_MISSED_VISIT_COUNT: 9,
  FIREBASEMESSAGE: 10,
  PLUS_STATUS_CHANGED: 11,
  NEW_PICTURE_LIKE: 50,
} as const;
export type PushEvent = (typeof PushEvent)[keyof typeof PushEvent];

export const PushMessageStyle = {
  NONE: "NONE",
  SIMPLE: "SIMPLE",
  NORMAL: "NORMAL",
  EXTENDED: "EXTENDED",
} as const;
export type PushMessageStyle = (typeof PushMessageStyle)[keyof typeof PushMessageStyle];

export const FootprintStyle = {
  NONE: "NONE",
  SIMPLE: "SIMPLE",
  NORMAL: "NORMAL",
} as const;
export type FootprintStyle = (typeof FootprintStyle)[keyof typeof FootprintStyle];

// ─────────────────────────────────────────────────────────────────────────────
// E8. UI & Message-State Enums
// ─────────────────────────────────────────────────────────────────────────────

export const UserListViewHolderType = {
  GRID_SMALL: "GRID_SMALL",
  GRID_BIG: "GRID_BIG",
  CONTACT: "CONTACT",
  CONTACT_HEADER: "CONTACT_HEADER",
  PROMO_CONTAINER: "PROMO_CONTAINER",
  CONTACTS_LANE: "CONTACTS_LANE",
  DISTANCE_LANE: "DISTANCE_LANE",
  PICTURES_I_LIKED: "PICTURES_I_LIKED",
  ONLINE_LANE: "ONLINE_LANE",
  NEWEST_LANE: "NEWEST_LANE",
  BLOG_CONTAINER: "BLOG_CONTAINER",
  TRAVELLERS_LANE: "TRAVELLERS_LANE",
  POPULAR_LANE: "POPULAR_LANE",
  SKELETON_LIST: "SKELETON_LIST",
  SKELETON_GRID: "SKELETON_GRID",
  USER_LIST: "USER_LIST",
  EMPTY: "EMPTY",
  BLOG_POST: "BLOG_POST",
  PREVIEW_BANNER: "PREVIEW_BANNER",
  BED_AND_BREAKFAST: "BED_AND_BREAKFAST",
  SPARTACUS_BLOG: "SPARTACUS_BLOG",
  TRAVEL_UPGRADE_PLUS_BANNER: "TRAVEL_UPGRADE_PLUS_BANNER",
  TRAVEL_ARRIVAL_INFO_BANNER: "TRAVEL_ARRIVAL_INFO_BANNER",
  PLUS_UNLIMITED_RADAR_BANNER: "PLUS_UNLIMITED_RADAR_BANNER",
} as const;
export type UserListViewHolderType = (typeof UserListViewHolderType)[keyof typeof UserListViewHolderType];

export const UserListColumnType = {
  LIST: "LIST",
  GRID_SMALL: "GRID_SMALL",
  GRID_BIG: "GRID_BIG",
} as const;
export type UserListColumnType = (typeof UserListColumnType)[keyof typeof UserListColumnType];

export const TransmissionStatus = {
  RECEIVED: "RECEIVED",
  DRAFT: "DRAFT",
  TRANSMITTING: "TRANSMITTING",
  SENT: "SENT",
} as const;
export type TransmissionStatus = (typeof TransmissionStatus)[keyof typeof TransmissionStatus];

export const MsgDbState = {
  NOTHING: "NOTHING",
  INSERTING: "INSERTING",
  UPDATING: "UPDATING",
  DELETING: "DELETING",
  DRAFT: "DRAFT",
} as const;
export type MsgDbState = (typeof MsgDbState)[keyof typeof MsgDbState];

// ─────────────────────────────────────────────────────────────────────────────
// E9. Model & Auth Enums
// ─────────────────────────────────────────────────────────────────────────────

export const CredentialType = {
  DEFAULT: "DEFAULT",
  FACEBOOK: "FACEBOOK",
  GOOGLE: "GOOGLE",
  APPLE: "APPLE",
  PHONE: "PHONE",
} as const;
export type CredentialType = (typeof CredentialType)[keyof typeof CredentialType];

export const AppStatus = {
  MINOR_UPDATE: "MINOR_UPDATE",
  MAJOR_UPDATE: "MAJOR_UPDATE",
  FIRST_START: "FIRST_START",
  UPDATE_TO_UNCUT: "UPDATE_TO_UNCUT",
  NO_UPDATE: "NO_UPDATE",
} as const;
export type AppStatus = (typeof AppStatus)[keyof typeof AppStatus];

// ─────────────────────────────────────────────────────────────────────────────
// E11. Subscription Tier Enums
// ─────────────────────────────────────────────────────────────────────────────

export const PlusSource = {
  FREE_TRIAL: "PLUS (free)",
  COMPENSATION: "PLUS (compensation)",
  GIFT_RECEIVED: "PLUS (gift received)",
  PROMOTION: "PLUS (promotion)",
  REFERRAL: "PLUS (referral)",
  VOUCHER: "PLUS (voucher)",
  WITH_RENEWAL: "PLUS (with renewal)",
  WITHOUT_RENEWAL: "PLUS (without renewal)",
} as const;
export type PlusSource = (typeof PlusSource)[keyof typeof PlusSource];

// ─────────────────────────────────────────────────────────────────────────────
// E12. API Error Codes
// ─────────────────────────────────────────────────────────────────────────────

export const ApiErrorCode = {
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_WRONG_API_KEY: "AUTH_WRONG_API_KEY",
  AUTH_NOT_LOGGED_IN: "AUTH_NOT_LOGGED_IN",
  AUTH_NOT_ENOUGH_PRIVILEGES: "AUTH_NOT_ENOUGH_PRIVILEGES",
  AUTH_LIMIT_EXCEEDED: "AUTH_LIMIT_EXCEEDED",
  AUTH_BLOCKED_BY_PROFILE_OWNER: "AUTH_BLOCKED_BY_PROFILE_OWNER",
  AUTH_PROFILE_UNVERIFIED: "AUTH_PROFILE_UNVERIFIED",
  AUTH_PROFILE_DEACTIVATED: "AUTH_PROFILE_DEACTIVATED",
  AUTH_PROFILE_BANNED: "AUTH_PROFILE_BANNED",
  AUTH_ACCOUNT_NOT_CONFIRMED: "AUTH_ACCOUNT_NOT_CONFIRMED",
  AUTH_REPORTING_NOT_ALLOWED: "AUTH_REPORTING_NOT_ALLOWED",
  ARGUMENT_INVALID: "ARGUMENT_INVALID",
  ARGUMENT_REQUIRED: "ARGUMENT_REQUIRED",
  RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  PICTURE_INVALID_RATING: "PICTURE_INVALID_RATING",
  REACTIONS_NOT_ACCESSIBLE: "REACTIONS_NOT_ACCESSIBLE",
  INTERACTION_NOT_ALLOWED: "INTERACTION_NOT_ALLOWED",
  RECEIVER_IS_MESSAGE_PROTECTED: "RECEIVER_IS_MESSAGE_PROTECTED",
  PROFILE_PARTNER_SELF: "PROFILE_PARTNER_SELF",
  APPSTORE_DUPLICATE_PURCHASE: "APPSTORE_DUPLICATE_PURCHASE",
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

// ─────────────────────────────────────────────────────────────────────────────
// Extended: Production App Enums (FYK specific)
// ─────────────────────────────────────────────────────────────────────────────

export const SocialPlatform = {
  INSTAGRAM: "instagram",
  TWITTER: "twitter",
  TIKTOK: "tiktok",
  BLUESKY: "bluesky",
  TELEGRAM: "telegram",
  WHATSAPP: "whatsapp",
  SPOTIFY: "spotify",
} as const;
export type SocialPlatform = (typeof SocialPlatform)[keyof typeof SocialPlatform];

export const AlbumAccessState = {
  EMPTY: "empty",
  GRANTED: "granted",
  REQUESTED: "requested",
  REVOKED: "revoked",
  EXPIRED: "expired",
} as const;
export type AlbumAccessState = (typeof AlbumAccessState)[keyof typeof AlbumAccessState];

export const VerificationStatus = {
  UNVERIFIED: "unverified",
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const MessageType = {
  TEXT: "text",
  PHOTO: "photo",
  AUDIO: "audio",
  VIDEO: "video",
  GAYMOJI: "gaymoji",
  GIPHY: "giphy",
  STICKER: "sticker",
  EXPIRING: "expiring",
  LOCATION: "location",
  POLL: "poll",
  GIFT: "gift",
  SYSTEM: "system",
  CALL_LOG: "call_log",
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const CallStatus = {
  RINGING: "ringing",
  CONNECTED: "connected",
  ENDED: "ended",
  MISSED: "missed",
  DECLINED: "declined",
} as const;
export type CallStatus = (typeof CallStatus)[keyof typeof CallStatus];

export const StoryType = {
  IMAGE: "image",
  VIDEO: "video",
  TEXT: "text",
} as const;
export type StoryType = (typeof StoryType)[keyof typeof StoryType];

export const GiftTier = {
  COMMON: "common",
  RARE: "rare",
  EPIC: "epic",
  LEGENDARY: "legendary",
} as const;
export type GiftTier = (typeof GiftTier)[keyof typeof GiftTier];

export const EventCategory = {
  NIGHTLIFE: "nightlife",
  GAMING: "gaming",
  CINEMA: "cinema",
  HOOKUP: "hookup",
  KINK: "kink",
  SPORTS: "sports",
  DINING: "dining",
  CULTURE: "culture",
  OUTDOORS: "outdoors",
  WELLNESS: "wellness",
  TRAVEL: "travel",
  COMMUNITY: "community",
  CREATIVE: "creative",
  PROFESSIONAL: "professional",
  PARTY: "party",
} as const;
export type EventCategory = (typeof EventCategory)[keyof typeof EventCategory];

export const ReportReason = {
  SPAM: "spam",
  HARASSMENT: "harassment",
  FAKE_PROFILE: "fake",
  UNDERAGE: "underage",
  OFFENSIVE_CONTENT: "offensive",
  SCAM: "scam",
  OTHER: "other",
} as const;
export type ReportReason = (typeof ReportReason)[keyof typeof ReportReason];

export const NotificationType = {
  MESSAGE: "message",
  TAP: "tap",
  MATCH: "match",
  VISIT: "visit",
  FAVORITE: "favorite",
  EVENT: "event",
  SYSTEM: "system",
  VERIFICATION: "verification",
  GIFT: "gift",
  BOOST: "boost",
  CHECK_IN: "check_in",
  SAFETY: "safety",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

// Helpers
export function isValidEnumValue<T extends Record<string, string>>(enumObj: T, value: unknown): value is T[keyof T] {
  return typeof value === "string" && Object.values(enumObj).includes(value);
}

export function enumValues<T extends Record<string, string | number>>(enumObj: T): T[keyof T][] {
  return Object.values(enumObj) as T[keyof T][];
}
