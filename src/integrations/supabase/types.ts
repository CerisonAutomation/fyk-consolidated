/**
 * Database types for the FYK MVP schema.
 *
 * Hand-written to match `supabase/migrations/001_schema.sql`. Once the Supabase
 * CLI is available these should be replaced by generated output:
 *   supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 * Until then, this file and the SQL must be kept in step by review.
 */

export type ExposureLevel = "clean" | "mature" | "explicit";
export type LikeKind = "like" | "tap" | "woof";
export type GrantStatus = "pending" | "approved" | "denied" | "revoked";
export type RsvpStatus = "going" | "maybe" | "declined";
export type MessageType = "text" | "image" | "video" | "audio" | "system" | "album_request" | "album_share";
export type MediaAccessPolicy = "standard" | "timed" | "view_once" | "open_count";
export type SharedMediaStatus = "pending" | "active" | "declined" | "expired" | "revoked" | "consumed" | "failed";
export type ReportStatus = "open" | "in_review" | "action_taken" | "dismissed";
export type PostKind = "invite" | "offer" | "ask" | "photo" | "text";
export type WhereMode = "out" | "mine" | "yours" | "either";
export type PlanTier = "free" | "plus" | "gold" | "platinum";

export type Profile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  headline: string | null;
  age: number | null;
  age_verified_at: string | null;
  city: string | null;
  area: string | null;
  /** Coarsened to a ~250 m grid before it is ever written. */
  lat_coarse: number | null;
  lng_coarse: number | null;
  exposure_level: ExposureLevel;
  height_cm: number | null;
  body_type: string | null;
  position_role: string | null;
  pronouns: string | null;
  hide_distance: boolean;
  hide_online: boolean;
  incognito: boolean;
  is_demo: boolean;
  is_suspended: boolean;
  onboarding_completed_at: string | null;
  last_active_at: string;
  created_at: string;
  updated_at: string;
  /**
   * Mirrored from `public.users` by `users_apply_projection()` (0018). The
   * jsonb bags are untyped on purpose: PostgREST hands back `unknown` and each
   * caller narrows them with `asStringArray`-style helpers.
   */
  photos: unknown;
  tribes: unknown;
  position: unknown;
  languages: unknown;
  interests: unknown;
  looking_for: unknown;
  tag_codes: unknown;
  verification: number;
  trust_score: number;
  relationship_status: string | null;
  occupation: string | null;
  tier: string | null;
  weight: number | null;
  online: boolean;
  discoverable: boolean;
};

export type ProfilePrivate = {
  id: string;
  dob: string;
  created_at: string;
  updated_at: string;
};

export type ProfilePhoto = {
  id: string;
  owner_id: string;
  storage_path: string;
  position: number;
  is_primary: boolean;
  width: number | null;
  height: number | null;
  created_at: string;
};

export type PrivateAlbumItem = {
  id: string;
  owner_id: string;
  storage_path: string;
  position: number;
  album_id: string | null;
  media_kind: string;
  caption: string | null;
  created_at: string;
};

export type PrivateAlbum = {
  id: string;
  owner_id: string;
  name: string;
  default_access_policy: MediaAccessPolicy;
  default_duration_seconds: number | null;
  default_max_opens: number | null;
  created_at: string;
  updated_at: string;
};

export type AlbumShare = {
  id: string;
  album_id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  access_policy: MediaAccessPolicy;
  expires_at: string | null;
  max_opens: number | null;
  opens_used: number;
  opened_at: string | null;
  revoked_at: string | null;
  status: SharedMediaStatus;
  created_at: string;
};

export type AlbumGrant = {
  id: string;
  owner_id: string;
  grantee_id: string;
  status: GrantStatus;
  created_at: string;
  resolved_at: string | null;
};

export type Like = { id: string; from_id: string; to_id: string; kind: LikeKind; created_at: string };
export type Match = { id: string; user_a: string; user_b: string; created_at: string; unmatched_at: string | null };
export type Block = { id: string; blocker_id: string; blocked_id: string; created_at: string };

export type Conversation = { id: string; match_id: string | null; last_message_at: string; created_at: string };
export type ConversationMember = {
  conversation_id: string;
  profile_id: string;
  last_read_at: string | null;
  archived_at: string | null;
};
export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: MessageType;
  body: string | null;
  storage_path: string | null;
  album_share_id: string | null;
  reply_to_id: string | null;
  expires_at: string | null;
  unsent_at: string | null;
  edited_at: string | null;
  created_at: string;
};

export type MessageAttachment = {
  id: string;
  message_id: string;
  conversation_id: string;
  sender_id: string;
  storage_path: string;
  media_kind: "image" | "video" | "audio";
  mime_type: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  access_policy: MediaAccessPolicy;
  expires_at: string | null;
  max_opens: number | null;
  opens_used: number;
  opened_at: string | null;
  revoked_at: string | null;
  status: SharedMediaStatus;
  created_at: string;
};

export type MessageReaction = {
  message_id: string;
  profile_id: string;
  emoji: "heart" | "fire" | "laugh" | "wow" | "like";
  created_at: string;
};

export type Offer = {
  id: string;
  owner_id: string;
  activity_ids: string[];
  note: string | null;
  where_mode: WhereMode;
  spots: number | null;
  expires_at: string;
  created_at: string;
};
export type OfferJoin = { offer_id: string; profile_id: string; status: string; created_at: string };

export type Event = {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  activity_id: string | null;
  scale: string;
  cost: string | null;
  venue: string | null;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  explicitness: ExposureLevel;
  status: string;
  created_at: string;
  updated_at: string;
};
export type EventRsvp = { event_id: string; profile_id: string; status: RsvpStatus; created_at: string };

export type BoardPost = {
  id: string;
  author_id: string;
  kind: PostKind;
  body: string;
  activity_id: string | null;
  storage_path: string | null;
  city: string | null;
  area: string | null;
  spots: number | null;
  join_count: number;
  expires_at: string;
  created_at: string;
};
export type BoardComment = { id: string; post_id: string; author_id: string; body: string; created_at: string };
export type PostJoin = { post_id: string; profile_id: string; created_at: string };

export type Report = {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
};

export type PremiumEntitlement = {
  profile_id: string;
  tier: PlanTier;
  source: string;
  expires_at: string | null;
  updated_at: string;
};

export type Group = {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  icon: string | null;
  privacy: string;
  created_by: string | null;
  member_count: number;
  created_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

export type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  type: string;
  created_at: string;
};

export type Fansite = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  subscriber_count: number;
  created_at: string;
};

export type Tribe = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  member_count: number;
  created_at: string;
};

export type Shout = {
  id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  likes_count: number;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  actor_id: string | null;
  href: string | null;
  read: boolean;
  created_at: string;
};

export type Favorite = {
  id: string;
  user_id: string;
  target_id: string;
  created_at: string;
};

export type Tap = {
  id: string;
  tapper_id: string;
  tapped_id: string;
  type: string;
  is_super: boolean;
  created_at: string;
};

export type ShoutLike = {
  id: string;
  shout_id: string;
  user_id: string;
  created_at: string;
};

export type Footprint = {
  id: string;
  visitor_id: string;
  visited_id: string;
  preset: string | null;
  created_at: string;
};

export type UserNote = {
  id: string;
  note_owner_id: string;
  target_user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type Subscription = {
  id: string;
  user_id: string;
  tier: string;
  stripe_subscription_id: string | null;
  status: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type KingPet = {
  id: string;
  user_id: string;
  name: string;
  stage: string;
  mood: string;
  bones: number;
  experience: number;
  level: number;
  streak: number;
  wardrobe: string[];
  equipped: string[];
  adventures: string[];
  mood_log: Array<{ mood: string; time: string }>;
  last_fed_at: string | null;
  last_played_at: string | null;
  last_adventure_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PetItem = {
  id: string;
  name: string;
  type: string;
  emoji: string | null;
  bone_cost: number;
  stage_required: string;
};

export type PetAdventure = {
  id: string;
  theme: string;
  description: string | null;
  emoji: string | null;
  duration_minutes: number;
  bone_cost: number;
  reward_type: string;
  reward_amount: number;
};

export type WalletRow = {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type WalletTransaction = {
  id: string;
  wallet_id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
};

export type ConsumablesInventory = {
  id: string;
  user_id: string;
  type: string;
  quantity: number;
  expires_at: string | null;
  created_at: string;
};


export type Story = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  background: string | null;
  viewed_by: unknown;
  expires_at: string;
  created_at: string;
};

export type StoryView = {
  id: string;
  story_id: string;
  user_id: string;
  viewed_at: string;
};

/**
 * `public.users` — the server-owned row. Browser code reads its own account
 * through `/api/*` and everyone else's through `profiles`; direct selects are
 * revoked in 0018, so this shape exists for the integrations that still write
 * with a service token and for the Drizzle schema's naming to stay checkable.
 * There is no `password_hash`, `apple_id` or `google_id` any more: Supabase
 * owns credentials in `auth.users`.
 */
export type User = {
  id: string | null;
  email: string | null;
  phone: string | null;
  pseudo: string | null;
  nick: string | null;
  description: string | null;
  occupation: string | null;
  relationship_status: string | null;
  ethnicity: string | null;
  pronouns: string | null;
  birthday: string | null;
  age: number | null;
  height: number | null;
  weight: number | null;
  body_type: string | null;
  position: unknown;
  languages: unknown;
  looking_for: unknown;
  intents: unknown;
  tag_codes: unknown;
  interests: unknown;
  tribes: unknown;
  photos: unknown;
  avatar: string | null;
  geo_mode: string | null;
  h3_index: string | null;
  lat: number | null;
  lng: number | null;
  lat_coarse: number | null;
  lng_coarse: number | null;
  city: string | null;
  area: string | null;
  status: string | null;
  role: string | null;
  tier: string | null;
  verification: number | null;
  trust_score: number | null;
  profile_complete: number | null;
  online: boolean | null;
  visible: boolean | null;
  hidden: boolean | null;
  incognito: boolean | null;
  is_demo: boolean | null;
  is_suspended: boolean | null;
  exposure_level: string | null;
  hide_distance: boolean | null;
  hide_online: boolean | null;
  theme: string | null;
  accent: string | null;
  font_size: number | null;
  grid_columns: number | null;
  card_style: string | null;
  dnd_mode: boolean | null;
  colorblind_mode: boolean | null;
  language: string | null;
  notif_prefs: unknown;
  ai_prefs: unknown;
  last_cursor: string | null;
  last_seen: string | null;
  last_active_at: string;
  onboarding_done: boolean | null;
  boost_expires_at: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type Table<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      users: Table<User>;
      profiles: Table<Profile>;
      profile_private: Table<ProfilePrivate>;
      profile_photos: Table<ProfilePhoto>;
      private_album_items: Table<PrivateAlbumItem>;
      private_albums: Table<PrivateAlbum>;
      album_grants: Table<AlbumGrant>;
      album_shares: Table<AlbumShare>;
      likes: Table<Like>;
      matches: Table<Match>;
      blocks: Table<Block>;
      conversations: Table<Conversation>;
      conversation_members: Table<ConversationMember>;
      messages: Table<Message>;
      message_attachments: Table<MessageAttachment>;
      message_reactions: Table<MessageReaction>;
      offers: Table<Offer>;
      offer_joins: Table<OfferJoin>;
      events: Table<Event>;
      event_rsvps: Table<EventRsvp>;
      board_posts: Table<BoardPost>;
      board_comments: Table<BoardComment>;
      post_joins: Table<PostJoin>;
      reports: Table<Report>;
      premium_entitlements: Table<PremiumEntitlement>;
      groups: Table<Group>;
      group_members: Table<GroupMember>;
      group_messages: Table<GroupMessage>;
      fansites: Table<Fansite>;
      tribes: Table<Tribe>;
      shouts: Table<Shout>;
      notifications: Table<Notification>;
      favorites: Table<Favorite>;
      taps: Table<Tap>;
      subscriptions: Table<Subscription>;
      shout_likes: Table<ShoutLike>;
      footprints: Table<Footprint>;
      user_notes: Table<UserNote>;
      king_pet: Table<KingPet>;
      pet_items: Table<PetItem>;
      pet_adventures: Table<PetAdventure>;
      wallet: Table<WalletRow>;
      wallet_transactions: Table<WalletTransaction>;
      consumables_inventory: Table<ConsumablesInventory>;
      stories: Table<Story>;
      story_views: Table<StoryView>;

    };
    Views: Record<string, never>;
    Functions: {
      register_media_open: { Args: { target: string }; Returns: MessageAttachment };
      register_album_open: { Args: { target: string }; Returns: AlbumShare };
      find_similar_profiles: { Args: { query_embedding: string; match_count: number; match_threshold: number }; Returns: Record<string, unknown>[] };
      find_similar_messages: { Args: { query_embedding: string; conv_id: string; match_count: number }; Returns: Record<string, unknown>[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
