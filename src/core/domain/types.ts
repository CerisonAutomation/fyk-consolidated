/**
 * Domain Types — Canonical type system, hexagonal architecture
 * Professional naming, single source of truth, Zod validation
 */

import { z } from "zod";

// App Config
export const DiscreetIconSchema = z.enum(["default", "calculator", "notes", "weather", "calendar", "health", "music", "news"]);
export type DiscreetIcon = z.infer<typeof DiscreetIconSchema>;

export const AppLockSchema = z.object({
  enabled: z.boolean(),
  pin: z.string().min(4).max(8).regex(/^\d+$/).optional(),
  biometric: z.boolean().default(false),
  timeoutSec: z.number().int().min(10).max(3600).default(60),
});
export type AppLock = z.infer<typeof AppLockSchema>;

export const PauseModeSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().max(200).optional(),
  pausedAt: z.string().datetime().optional(),
  resumeAt: z.string().datetime().nullable().optional(),
  durationDays: z.number().int().min(1).max(30).nullable().optional(),
});
export type PauseMode = z.infer<typeof PauseModeSchema>;

export const WidgetConfigSchema = z.object({
  enabled: z.boolean(),
  showMatches: z.boolean(),
  showUnread: z.boolean(),
  showLikes: z.boolean(),
  showFeatured: z.boolean(),
  refreshIntervalMinutes: z.number().int().min(5).max(60),
});
export type WidgetConfig = z.infer<typeof WidgetConfigSchema>;

export const UserAppConfigSchema = z.object({
  discreetIcon: DiscreetIconSchema,
  discreetEnabled: z.boolean(),
  appLockEnabled: z.boolean(),
  appLockBiometric: z.boolean(),
  appLockTimeoutSec: z.number().int().min(10).max(3600),
  pauseMode: PauseModeSchema.nullable(),
  widgetConfig: WidgetConfigSchema,
});
export type UserAppConfig = z.infer<typeof UserAppConfigSchema>;

// Multi-Account
export const MultiAccountTokenSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(50),
  accessToken: z.string().min(10),
  refreshToken: z.string().min(10),
  expiresAt: z.string().datetime(),
  lastUsedAt: z.string().datetime(),
});
export type MultiAccountToken = z.infer<typeof MultiAccountTokenSchema>;

// Scheduled Messages
export const ScheduledMessageTypeSchema = z.enum(["text", "image", "location", "gif", "poll", "gift"]);
export const ScheduledMessageStatusSchema = z.enum(["scheduled", "sent", "cancelled", "failed"]);
export const ScheduledMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().uuid(),
  type: ScheduledMessageTypeSchema,
  body: z.string().min(1).max(4000),
  scheduledAt: z.string().datetime(),
  status: ScheduledMessageStatusSchema,
  sentAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type ScheduledMessage = z.infer<typeof ScheduledMessageSchema>;

// Wishlist
export const WishlistCategorySchema = z.enum(["general", "food", "activity", "travel", "nightlife", "culture", "outdoor", "romantic"]);
export const WishlistItemSchema = z.object({
  id: z.string().uuid(),
  wishlistId: z.string().uuid(),
  text: z.string().min(1).max(200),
  category: WishlistCategorySchema,
  addedBy: z.string().uuid(),
  votes: z.array(z.string().uuid()),
  voteCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
});
export type WishlistItem = z.infer<typeof WishlistItemSchema>;

export const WishlistSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  participantId: z.string().uuid(),
  title: z.string().min(1).max(100),
  items: z.array(WishlistItemSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Wishlist = z.infer<typeof WishlistSchema>;

// Hot Pics
export const HotPicsStatusSchema = z.enum(["pending", "accepted", "declined", "expired", "revoked"]);
export const HotPicsRequestSchema = z.object({
  id: z.string().uuid(),
  requesterId: z.string().uuid(),
  ownerId: z.string().uuid(),
  status: HotPicsStatusSchema,
  expiresAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type HotPicsRequest = z.infer<typeof HotPicsRequestSchema>;

// Photo Scores
export const PhotoScoreSchema = z.object({
  url: z.string().url(),
  quality: z.number().int().min(0).max(100),
  lighting: z.number().int().min(0).max(100),
  blur: z.number().int().min(0).max(100),
  smile: z.number().int().min(0).max(100),
  background: z.number().int().min(0).max(100),
  appeal: z.number().int().min(0).max(100),
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
});
export type PhotoScore = z.infer<typeof PhotoScoreSchema>;

// AI Types
export const AITypeSchema = z.enum([
  "auto_reply",
  "context_reply",
  "icebreaker",
  "date_plan",
  "rizz",
  "escalation",
  "wingman",
  "summary",
  "translation",
  "photo_enhance",
  "catfish_check",
  "best_time",
  "autocomplete",
  "meme",
  "voice_note",
  "digest",
  "pickup_line",
  "bio_writer",
]);
export const AIConversationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  conversationId: z.string().uuid().nullable().optional(),
  type: AITypeSchema,
  input: z.record(z.string(), z.any()),
  output: z.record(z.string(), z.any()),
  model: z.string().default("heuristic"),
  tokensUsed: z.number().int().min(0),
  latencyMs: z.number().int().min(0),
  createdAt: z.string().datetime(),
});
export type AIConversation = z.infer<typeof AIConversationSchema>;

// Chat
export const ChatPinnedSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
  pinnedBy: z.string().uuid(),
  pinnedAt: z.string().datetime(),
});
export type ChatPinned = z.infer<typeof ChatPinnedSchema>;

export const ChatEphemeralSettingsSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  durationSec: z.number().int(),
  enabled: z.boolean(),
  updatedAt: z.string().datetime(),
});
export type ChatEphemeralSettings = z.infer<typeof ChatEphemeralSettingsSchema>;

// Group
export const GroupRoleSchema = z.enum(["member", "admin", "moderator", "owner"]);
export const GroupBroadcastSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  authorId: z.string().uuid(),
  body: z.string().min(1).max(1000),
  createdAt: z.string().datetime(),
});
export type GroupBroadcast = z.infer<typeof GroupBroadcastSchema>;

// Speed Dating
export const SpeedDatingStatusSchema = z.enum(["scheduled", "live", "ended", "cancelled"]);
export const SpeedDatingEventSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(100),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  maxParticipants: z.number().int().min(2).max(100),
  roundDurationSec: z.number().int().min(60).max(600),
  status: SpeedDatingStatusSchema,
  createdAt: z.string().datetime(),
});
export type SpeedDatingEvent = z.infer<typeof SpeedDatingEventSchema>;

// Calendar
export const CalendarProviderSchema = z.enum(["none", "google", "apple", "outlook"]);
export const CalendarEventSourceSchema = z.enum(["manual", "google", "apple", "outlook", "fyk"]);
export const CalendarEventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(100),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  location: z.string().max(200).optional(),
  isPrivate: z.boolean(),
  source: CalendarEventSourceSchema,
  createdAt: z.string().datetime(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

// Stats
export const ProfileStatsSchema = z.object({
  userId: z.string().uuid(),
  viewsTotal: z.number().int().min(0),
  viewsUnique: z.number().int().min(0),
  likesSent: z.number().int().min(0),
  likesReceived: z.number().int().min(0),
  matchesTotal: z.number().int().min(0),
  messagesSent: z.number().int().min(0),
  messagesReceived: z.number().int().min(0),
  replyRate: z.number().min(0).max(1),
  bestPhotoUrl: z.string().url().nullable().optional(),
  bestReplyHour: z.number().int().min(0).max(23).nullable().optional(),
  updatedAt: z.string().datetime(),
});
export type ProfileStats = z.infer<typeof ProfileStatsSchema>;

// Consumables
export const ConsumableTypeSchema = z.enum(["boost", "super_like", "read_receipt", "spotlight", "gift", "extra_likes"]);
export const ConsumableCatalogSchema = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  priceCoins: z.number().int().min(1),
  priceUsdCents: z.number().int().min(1).optional(),
  type: ConsumableTypeSchema,
  quantity: z.number().int().min(1),
  active: z.boolean(),
  createdAt: z.string().datetime(),
});
export type ConsumableCatalog = z.infer<typeof ConsumableCatalogSchema>;

// Grid Presets
export const GridPresetSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(50),
  filters: z.record(z.string(), z.any()),
  isQuick: z.boolean(),
  icon: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type GridPreset = z.infer<typeof GridPresetSchema>;

// Compatibility
export const CompatibilityScoreSchema = z.object({
  id: z.string().uuid(),
  userA: z.string().uuid(),
  userB: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  dimensions: z.object({
    vibe: z.number().min(0).max(1),
    intimacy: z.number().min(0).max(1),
    logistics: z.number().min(0).max(1),
    lifestyle: z.number().min(0).max(1),
  }),
  calculatedAt: z.string().datetime(),
});
export type CompatibilityScore = z.infer<typeof CompatibilityScoreSchema>;

// Safety
export const EmergencyShareSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  contactId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  place: z.string().max(200).optional(),
  message: z.string().max(500).optional(),
  sharedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});
export type EmergencyShare = z.infer<typeof EmergencyShareSchema>;

export const DeletionRequestStatusSchema = z.enum(["pending", "grace", "deleted", "cancelled"]);
export const DeletionRequestSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  status: DeletionRequestStatusSchema,
  graceEndsAt: z.string().datetime(),
  requestedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});
export type DeletionRequest = z.infer<typeof DeletionRequestSchema>;

// Common
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const IdempotencySchema = z.object({
  idempotencyKey: z.string().uuid().optional(),
});

// Translation
export const TranslationRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  sourceLang: z.string().min(2).max(10).optional(),
  targetLang: z.string().min(2).max(10),
  model: z.enum(["on_device", "server", "auto"]).default("auto"),
});
export type TranslationRequest = z.infer<typeof TranslationRequestSchema>;

export const TranslationResultSchema = z.object({
  original: z.string(),
  translated: z.string(),
  sourceLang: z.string(),
  targetLang: z.string(),
  confidence: z.number().min(0).max(1),
  model: z.enum(["on_device", "server"]),
});
export type TranslationResult = z.infer<typeof TranslationResultSchema>;

// Match domain — canonical
export type Profile = {
  id: string;
  age: number;
  bodyType: string;
  languages: string[];
  tagCodes: string[];
  interests: string[];
  tribes: string[];
  intents: string[];
  lookingFor: string[];
  position: string[];
  city: string;
  verification: string;
  online: boolean;
  lastActiveAt?: string;
};

export type MatchDimensions = {
  interests: number;
  goals: number;
  chemistry: number;
  lifestyle: number;
  communication: number;
};

export type MatchResult = {
  overall: number;
  dimensions: MatchDimensions;
  reasons: string[];
  vibe: string;
};

// Feature flags — canonical list
export const AppFeatureSchema = z.enum([
  "discreet_icon",
  "app_lock",
  "pause_mode",
  "widget",
  "multi_account",
  "scheduled_messages",
  "wishlist",
  "hot_pics",
  "photo_scores",
  "ai_conversations",
  "translation",
  "pay_per_read",
  "chat_pinned",
  "ephemeral",
  "screenshot_protection",
  "group_roles",
  "group_broadcast",
  "rewarded_chat",
  "speed_dating",
  "calendar_sync",
  "profile_stats",
  "consumables",
  "promo_codes",
  "engagement_nudges",
  "reengagement",
  "analytics_funnel",
  "grid_presets",
  "compatibility",
  "secret_admirer",
  "emergency_share",
  "deletion_request",
  "rate_limit",
  "backup_export",
  "offline_queue",
  "privacy_report",
]);
export type AppFeature = z.infer<typeof AppFeatureSchema>;
