export type ProfileUser = {
  id: string;
  email: string;
  pseudo: string;
  nick?: string;
  age?: number;
  birthday?: string;
  description?: string;
  occupation?: string;
  relationshipStatus?: string;
  ethnicity?: string;
  height?: number;
  weight?: number;
  bodyType?: string;
  position: string[];
  languages: string[];
  lookingFor: string[];
  intents: string[];
  tagCodes: string[];
  interests: string[];
  tribes: string[];
  photos: string[];
  geo?: { lat: number; lng: number; city?: string };
  city?: string;
  area?: string;
  status: string;
  role: string;
  tier: string;
  verification: number;
  trustScore: number;
  profileComplete: number;
  online: boolean;
  visible: boolean;
  hidden: boolean;
  incognito: boolean;
  isDemo: boolean;
  exposureLevel: string;
  hideDistance: boolean;
  hideOnline: boolean;
  lastSeen: string;
  lastActiveAt: string;
  onboardingDone: boolean;
  createdAt: string;
  updatedAt: string;
  verified?: boolean;
  avatar?: string;
  displayName?: string;
};

export type MatchDimensions = {
  interests: number;
  lifestyle: number;
  communication: number;
  goals: number;
  chemistry: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: string;
  content?: string;
  media_url?: string;
  media_duration?: number;
  reply_to_id?: string;
  is_edited: boolean;
  is_pinned: boolean;
  is_recalled: boolean;
  is_ephemeral: boolean;
  ephemeral_expires_at?: string;
  toxicity_score?: number;
  created_at: string;
  reactions?: Array<{ emoji: string; user_id: string }>;
  readBy?: Array<{ user_id: string }>;
};

export type ConversationWithMeta = {
  id: string;
  type: string;
  name?: string;
  lastMessage?: { content?: string; created_at: string; sender_id: string };
  unread: number;
  otherUser?: ProfileUser;
  lastMessageAt: string;
  memberCount?: number;
  avatar?: string;
  muted?: boolean;
};

export type Tap = {
  id: string;
  tapper_id: string;
  tapped_id: string;
  type: string;
  is_super: boolean;
  created_at: string;
  tapper?: ProfileUser;
  tapped?: ProfileUser;
  matchScore?: number;
  matchDimensions?: MatchDimensions;
};

export type EventData = {
  id: string;
  name: string;
  description?: string;
  cover_url?: string;
  category?: string;
  location?: string;
  lat?: number;
  lng?: number;
  start_time: string;
  end_time?: string;
  created_by: string;
  max_attendees?: number;
  cost?: string;
  status: string;
  tags: string[];
  attendee_count?: number;
  user_rsvp?: string;
};

export type Notification = {
  id: string;
  type: string;
  title: string;
  body?: string;
  actor_id?: string;
  href?: string;
  read: boolean;
  created_at: string;
  actor?: ProfileUser;
};

export type WalletData = {
  balance: number;
  currency: string;
  transactions: Array<{ id: string; type: string; amount: number; description: string; created_at: string }>;
  consumables: Array<{ type: string; quantity: number }>;
  subscription?: { tier: string; status: string };
  shop: Array<{ id: string; name: string; emoji: string; description: string; bone_cost: number }>;
  tiers: Array<{ tier: string; name: string; price: string; perks: string[] }>;
  currentTier: string;
};

export type KingPet = {
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
};

export type Candidate = ProfileUser & {
  matchScore: number;
  matchDimensions: MatchDimensions;
  distanceKm: number;
  isFavorite: boolean;
  verified?: boolean;
  views_count?: number;
  dimensions?: MatchDimensions;
};

export type Footprint = {
  id: string;
  visitor_id: string;
  visited_id: string;
  preset?: string;
  created_at: string;
  visitor?: ProfileUser;
  user?: ProfileUser;
};

export type GroupItem = {
  id: string;
  name: string;
  description?: string;
  cover_url?: string;
  icon?: string;
  privacy: string;
  member_count: number;
  created_by: string;
  is_member?: boolean;
  joined?: boolean;
};

export type MeetNowPost = {
  id: string;
  user_id: string;
  category: string;
  note?: string;
  location?: string;
  expires_at: string;
  active: boolean;
  created_at: string;
  user?: ProfileUser;
};

export type NoteItem = {
  id: string;
  target_user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type Shout = {
  id: string;
  user_id: string;
  content: string;
  media_url?: string;
  likes_count: number;
  created_at: string;
  user?: ProfileUser;
  liked?: boolean;
};

export type PetItem = {
  id: string;
  name: string;
  type: string;
  emoji: string;
  bone_cost: number;
  stage_required: string;
};

export type PetAdventure = {
  id: string;
  theme: string;
  description: string;
  emoji: string;
  duration_minutes: number;
  bone_cost: number;
  reward_type: string;
  reward_amount: number;
};

export type AlbumItem = {
  id: string;
  name: string;
  type: string;
  cover_url?: string;
  photo_count: number;
  created_at: string;
  photos?: Array<{ id: string; photo_url: string; caption?: string; is_hotpic: boolean }>;
};

export type EventItem = {
  id: string;
  name: string;
  description?: string;
  cover_url?: string;
  category?: string;
  location?: string;
  lat?: number;
  lng?: number;
  start_time: string;
  end_time?: string;
  created_by: string;
  max_attendees?: number;
  cost?: string;
  status: string;
  tags: string[];
  attendee_count?: number;
  user_rsvp?: string;
  attending?: boolean;
  isMine?: boolean;
  creator?: ProfileUser;
};
