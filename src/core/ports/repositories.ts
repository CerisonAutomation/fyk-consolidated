import type { Profile, Wallet, WalletTransaction, Tap, Match, Favorite, Block, Report, Conversation, Message, Notification, PetState, PetItem, PetAdventure, Story, Shout, MeetNowPost, Fansite, Album, AlbumPhoto, BoardPost, Subscription, Consumable, ShopItem, Footprint, UserNote } from "../domain/types";

export interface WalletRepository {
  findByUserId(userId: string): Promise<Wallet | null>;
  create(userId: string): Promise<Wallet>;
  updateBalance(userId: string, delta: number): Promise<Wallet>;
  addTransaction(walletId: string, tx: { type: "credit" | "debit" | "refund"; amount: number; description: string }): Promise<WalletTransaction>;
  getTransactions(walletId: string, limit?: number): Promise<WalletTransaction[]>;
  getConsumables(userId: string): Promise<Consumable[]>;
  upsertConsumable(userId: string, type: string, quantityDelta: number): Promise<Consumable>;
}

export interface ProfileRepository {
  findById(id: string): Promise<Profile | null>;
  findByEmail(email: string): Promise<Profile | null>;
  create(data: Partial<Profile> & { email: string; passwordHash: string }): Promise<Profile>;
  update(id: string, data: Partial<Profile>): Promise<Profile>;
  findNearby(lat: number, lng: number, radiusKm: number, excludeIds?: string[]): Promise<Profile[]>;
  updateOnlineStatus(userId: string, online: boolean): Promise<void>;
  updateLastSeen(userId: string): Promise<void>;
}

export interface MatchRepository {
  findIncomingTaps(userId: string): Promise<Tap[]>;
  findOutgoingTaps(userId: string): Promise<Tap[]>;
  findMatches(userId: string): Promise<Match[]>;
  createTap(tapperId: string, tappedId: string, type?: string): Promise<Tap>;
  deleteTap(tapperId: string, tappedId: string): Promise<void>;
  createMatch(user1Id: string, user2Id: string): Promise<Match>;
  findReciprocalTap(fromId: string, toId: string): Promise<Tap | null>;
  findFavorites(userId: string): Promise<Favorite[]>;
  addFavorite(userId: string, targetId: string): Promise<Favorite>;
  removeFavorite(userId: string, targetId: string): Promise<void>;
  findBlocks(userId: string): Promise<Block[]>;
  blockUser(blockerId: string, blockedId: string, reason?: string): Promise<Block>;
  unblockUser(blockerId: string, blockedId: string): Promise<void>;
  createReport(data: { reporterId: string; reportedId: string; reason: string; details?: string }): Promise<Report>;
}

export interface NotificationRepository {
  create(notification: { userId: string; type: string; title: string; body?: string; actorId?: string; href?: string }): Promise<Notification>;
  findByUserId(userId: string, limit?: number): Promise<Notification[]>;
  markRead(id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  clear(userId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
}

export interface ConversationRepository {
  findByUserId(userId: string): Promise<Conversation[]>;
  findById(id: string): Promise<Conversation | null>;
  create(type: string, participantIds: string[]): Promise<Conversation>;
  findOrCreateDirect(userId1: string, userId2: string): Promise<Conversation>;
  getMessages(conversationId: string, limit?: number): Promise<Message[]>;
  sendMessage(conversationId: string, senderId: string, content: string, options?: { replyToId?: string; ephemeral?: boolean; toxicScore?: number }): Promise<Message>;
  markRead(conversationId: string, userId: string): Promise<void>;
  addReaction(messageId: string, userId: string, emoji: string): Promise<void>;
}

export interface PetRepository {
  findByUserId(userId: string): Promise<PetState | null>;
  create(userId: string): Promise<PetState>;
  update(userId: string, data: Partial<PetState>): Promise<PetState>;
  getItems(): Promise<PetItem[]>;
  getAdventures(): Promise<PetAdventure[]>;
}

export interface StoryRepository {
  findActive(userId: string): Promise<Story[]>;
  create(userId: string, data: { mediaUrl: string; caption?: string; background?: string }): Promise<Story>;
  view(storyId: string, userId: string): Promise<void>;
  delete(storyId: string, userId: string): Promise<void>;
  getRings(userId: string): Promise<Array<{ userId: string; user: Profile; stories: Story[]; viewed: boolean }>>;
}

export interface SocialRepository {
  findShouts(limit?: number): Promise<Shout[]>;
  createShout(userId: string, content: string): Promise<Shout>;
  likeShout(shoutId: string, userId: string): Promise<boolean>;
  findMeetNowPosts(userId: string): Promise<MeetNowPost[]>;
  createMeetNowPost(userId: string, category: string, note?: string, location?: string): Promise<MeetNowPost>;
  joinMeetNowPost(postId: string, userId: string): Promise<void>;
  findFansites(): Promise<Fansite[]>;
  subscribeFansite(fansiteId: string): Promise<void>;
}

export interface SubscriptionRepository {
  findByUserId(userId: string): Promise<Subscription | null>;
  create(userId: string, tier: string, stripeId?: string): Promise<Subscription>;
  delete(userId: string): Promise<void>;
  updateTier(userId: string, tier: string): Promise<void>;
}

export interface FootprintRepository {
  record(visitorId: string, visitedId: string, preset?: string): Promise<Footprint>;
  findReceived(userId: string): Promise<Footprint[]>;
}

export interface AlbumRepository {
  findByUserId(userId: string): Promise<Album[]>;
  findById(id: string): Promise<Album | null>;
  create(userId: string, name: string, type: string): Promise<Album>;
  getPhotos(albumId: string): Promise<AlbumPhoto[]>;
}

export interface BoardRepository {
  findActive(limit?: number): Promise<BoardPost[]>;
  create(authorId: string, data: { kind: string; body: string; activityId?: string; city?: string; spots?: number }): Promise<BoardPost>;
  delete(postId: string, authorId: string): Promise<void>;
  joinPost(postId: string, userId: string): Promise<void>;
  addComment(postId: string, authorId: string, body: string): Promise<void>;
}

export interface NoteRepository {
  findByOwner(userId: string): Promise<UserNote[]>;
  upsert(userId: string, targetUserId: string, content: string): Promise<UserNote>;
  delete(userId: string, targetUserId: string): Promise<void>;
}
