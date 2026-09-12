/**
 * FYK Domain Types — Canonical Single Source of Truth
 *
 * Every type defined here is imported from everywhere else.
 * No ORM imports (no Prisma, no Supabase client types).
 * All naming is camelCase.
 */

// ─── Geo ────────────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

// ─── Profile ────────────────────────────────────────────────────────────────

export interface Profile {
  // Identity
  id: string;
  email: string;
  pseudo: string;
  nick: string;
  age: number;
  birthday: string; // ISO date

  // Bio
  description: string;
  occupation: string;
  ethnicity: string;

  // Body
  height: number;
  weight: number;
  bodyType: string;

  // Preferences & identity
  position: string[];
  languages: string[];
  lookingFor: string[];
  intents: string[];
  tagCodes: string[];
  interests: string[];
  tribes: string[];

  // Media
  photos: string[]; // URLs

  // Location
  geo: LatLng;
  city: string;
  area: string;

  // Status & role
  status: string;
  role: string;
  tier: string;

  // Trust & verification
  verification: string;
  trustScore: number;
  profileComplete: number; // 0-100

  // Visibility
  online: boolean;
  visible: boolean;
  hidden: boolean;
  incognito: boolean;

  // Flags
  isDemo: boolean;
  isSuspended: boolean;
  exposureLevel: string;

  // Privacy
  hideDistance: boolean;
  hideOnline: boolean;

  // UI preferences
  theme: string;
  accent: string;
  fontSize: number;
  gridColumns: number;
  language: string;

  // Timestamps
  lastSeen: string;
  lastActiveAt: string;
  onboardingDone: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Grid / Discovery ───────────────────────────────────────────────────────

export interface MatchDimensions {
  interests: number;
  lifestyle: number;
  communication: number;
  goals: number;
  chemistry: number;
}

export interface GridProfile {
  id: string;
  name: string;
  age: number;
  photo: string;
  distance: number;
  status: string;
  verified: boolean;
  hosting: boolean;
  lookingFor: string[];
  tags: string[];
  city: string;
  bio: string;
  matchScore: number;
  dimensions: MatchDimensions;
  isFavorite: boolean;
  matched: boolean;
  position: string;
  tribes: string[];
  kinks: string[];
}

export interface MatchResult {
  overall: number; // 0-100
  dimensions: MatchDimensions;
  reasons: string[];
  vibe: string;
}

// ─── Tap / Discovery actions ────────────────────────────────────────────────

export interface Tap {
  id: string;
  tapperId: string;
  tappedId: string;
  type: string;
  isSuper: boolean;
  createdAt: string;
  tapper?: Profile;
  tapped?: Profile;
  matchScore?: number;
}

// ─── Favorite ───────────────────────────────────────────────────────────────

export interface Favorite {
  id: string;
  userId: string;
  targetId: string;
  createdAt: string;
}

// ─── Match ──────────────────────────────────────────────────────────────────

export interface Match {
  id: string;
  user1Id: string;
  user2Id: string;
  status: string;
  createdAt: string;
  unmatchedAt?: string;
}

// ─── Block ──────────────────────────────────────────────────────────────────

export interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  reason?: string;
  createdAt: string;
}

// ─── Report ─────────────────────────────────────────────────────────────────

export interface Report {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  details?: string;
  evidence: string[];
  status: string;
  priority: string;
  createdAt: string;
}

// ─── Messaging ──────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  type: string;
  name?: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: string;
  content?: string;
  mediaUrl?: string;
  replyToId?: string;
  reactions: MessageReaction[];
  reads: string[];
  attachments: MessageAttachment[];
  isEdited: boolean;
  isPinned: boolean;
  isRecalled: boolean;
  isEphemeral: boolean;
  createdAt: string;
}

export interface MessageReaction {
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface MessageAttachment {
  id: string;
  storagePath: string;
  mediaKind: string;
  mimeType: string;
  width?: number;
  height?: number;
  accessPolicy: string;
  expiresAt?: string;
  maxOpens?: number;
  opensUsed: number;
  status: string;
}

// ─── Events ─────────────────────────────────────────────────────────────────

export interface EventItem {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  location?: string;
  startTime: string;
  endTime?: string;
  maxAttendees?: number;
  cost?: number;
  status: string;
  tags: string[];
  attendeeCount?: number;
  userRsvp?: string;
  creator?: Profile;
}

// ─── Notifications ──────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  actorId?: string;
  href?: string;
  read: boolean;
  createdAt: string;
  actor?: Profile;
}

// ─── Wallet & Payments ──────────────────────────────────────────────────────

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  tier: string;
  stripeSubscriptionId?: string;
  status: string;
  currentPeriodEnd?: string;
  createdAt: string;
}

export interface Consumable {
  id: string;
  userId: string;
  type: string;
  quantity: number;
  expiresAt?: string;
  createdAt: string;
}

export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  boneCost: number;
  type: string;
}

export interface TierDefinition {
  tier: string;
  name: string;
  price: number;
  perks: string[];
}

// ─── Pet ────────────────────────────────────────────────────────────────────

export interface PetState {
  id: string;
  userId: string;
  name: string;
  stage: string;
  mood: string;
  bones: number;
  experience: number;
  level: number;
  streak: number;
  happiness: number;
  wardrobe: string[];
  equipped: string[];
  adventures: string[];
  moodLog: string[];
  lastFedAt?: string;
  lastPlayedAt?: string;
  lastAdventureAt?: string;
  createdAt: string;
}

export interface PetItem {
  id: string;
  name: string;
  type: string;
  emoji: string;
  boneCost: number;
  stageRequired: string;
}

export interface PetAdventure {
  id: string;
  theme: string;
  description: string;
  emoji: string;
  durationMinutes: number;
  boneCost: number;
  rewardType: string;
  rewardAmount: number;
}

// ─── Social Feed ────────────────────────────────────────────────────────────

export interface Story {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: string;
  caption?: string;
  background?: string;
  expiresAt: string;
  createdAt: string;
  user?: Profile;
  viewed?: boolean;
}

export interface Shout {
  id: string;
  userId: string;
  content: string;
  mediaUrl?: string;
  likesCount: number;
  createdAt: string;
  user?: Profile;
  liked?: boolean;
}

export interface MeetNowPost {
  id: string;
  userId: string;
  category: string;
  note?: string;
  location?: string;
  expiresAt: string;
  active: boolean;
  createdAt: string;
  user?: Profile;
}

// ─── Fansite ────────────────────────────────────────────────────────────────

export interface Fansite {
  id: string;
  userId: string;
  name: string;
  description?: string;
  coverUrl?: string;
  subscriberCount: number;
  createdAt: string;
  user?: Profile;
}

// ─── Albums ─────────────────────────────────────────────────────────────────

export interface Album {
  id: string;
  userId: string;
  name: string;
  type: string;
  coverUrl?: string;
  photoCount: number;
  createdAt: string;
}

export interface AlbumPhoto {
  id: string;
  albumId: string;
  photoUrl: string;
  caption?: string;
  sortOrder: number;
  isHotpic: boolean;
  visibility: string;
  createdAt: string;
}

// ─── Board ──────────────────────────────────────────────────────────────────

export interface BoardPost {
  id: string;
  authorId: string;
  kind: string;
  body: string;
  activityId?: string;
  city?: string;
  area?: string;
  spots?: string;
  joinCount: number;
  expiresAt: string;
  createdAt: string;
  author?: Profile;
}

// ─── User interactions ──────────────────────────────────────────────────────

export interface Footprint {
  id: string;
  visitorId: string;
  visitedId: string;
  preset?: string;
  createdAt: string;
}

export interface UserNote {
  id: string;
  noteOwnerId: string;
  targetUserId: string;
  content: string;
  createdAt: string;
}
