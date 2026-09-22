/**
 * Repository Ports — Hexagonal Architecture
 * Interfaces for data access, implemented by adapters
 * Tech-agnostic core, swappable infra
 */

import type { User, UserId, UserPreferences, UserStats } from '../domain/entities/user';
import type { Message, MessageId, Conversation, ConversationId } from '../domain/entities/message';
import type { GridProfile, GridFilters } from '../domain/entities/grid';

// User Repository Port
export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findNearby(geohash: string, filters: GridFilters, limit: number, offset: number): Promise<GridProfile[]>;
  save(user: User): Promise<User>;
  delete(id: UserId): Promise<void>;
  search(query: string, filters: GridFilters, limit: number): Promise<GridProfile[]>;
  getPreferences(userId: UserId): Promise<UserPreferences | null>;
  savePreferences(prefs: UserPreferences): Promise<UserPreferences>;
  getStats(userId: UserId): Promise<UserStats | null>;
  updateStats(userId: UserId, stats: Partial<UserStats>): Promise<UserStats>;
  getBlocked(userId: UserId): Promise<UserId[]>;
  block(userId: UserId, blockedId: UserId): Promise<void>;
  unblock(userId: UserId, blockedId: UserId): Promise<void>;
  getFavorites(userId: UserId): Promise<UserId[]>;
  favorite(userId: UserId, favoriteId: UserId): Promise<void>;
  unfavorite(userId: UserId, favoriteId: UserId): Promise<void>;
  getVisitors(userId: UserId, days: number): Promise<{ visitorId: UserId; visitedAt: Date }[]>;
  recordVisit(visitorId: UserId, visitedId: UserId): Promise<void>;
}

// Message Repository Port
export interface MessageRepository {
  findById(id: MessageId): Promise<Message | null>;
  findByConversation(conversationId: ConversationId, limit: number, offset: number): Promise<Message[]>;
  save(message: Message): Promise<Message>;
  delete(id: MessageId): Promise<void>;
  unsend(id: MessageId, userId: string): Promise<void>; // Grindr: unsend
  getConversations(userId: string, limit: number, offset: number): Promise<Conversation[]>;
  findConversation(participantIds: string[]): Promise<Conversation | null>;
  createConversation(participantIds: string[]): Promise<Conversation>;
  updateConversation(conversation: Conversation): Promise<Conversation>;
  markAsRead(conversationId: ConversationId, userId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
  pinMessage(messageId: MessageId): Promise<void>;
  unpinMessage(messageId: MessageId): Promise<void>;
}

// Grid Repository Port
export interface GridRepository {
  getProfiles(geohash: string, filters: GridFilters, page: number, limit: number): Promise<{ profiles: GridProfile[]; hasMore: boolean; total: number }>;
  getProfile(id: string): Promise<GridProfile | null>;
  boostProfile(userId: string, durationHours: number): Promise<void>;
  getBoostedProfiles(geohash: string, limit: number): Promise<GridProfile[]>;
  getOnlineCount(geohash: string): Promise<number>;
}

// Safety Repository Port (Emergency share, check-in, etc.)
export interface SafetyRepository {
  createEmergencyShare(userId: string, contactId: string, location: { lat: number; lng: number; place?: string }, message?: string): Promise<{ id: string; expiresAt: Date }>;
  getEmergencyShares(userId: string): Promise<{ id: string; contactId: string; location: { lat: number; lng: number }; expiresAt: Date }[]>;
  deleteEmergencyShare(id: string, userId: string): Promise<void>;
  createCheckIn(userId: string, contactId: string | null, place: string | null, location: { lat: number; lng: number } | null, minutes: number): Promise<{ id: string; dueAt: Date; status: string }>;
  getActiveCheckIn(userId: string): Promise<{ id: string; dueAt: Date; status: string } | null>;
  getCheckInHistory(userId: string, limit: number): Promise<{ id: string; status: string; createdAt: Date }[]>;
  getContacts(userId: string): Promise<{ id: string; name: string; phone: string }[]>;
  createContact(userId: string, name: string, phone: string): Promise<{ id: string }>;
}

// Monetization Repository Port
export interface MonetizationRepository {
  getWallet(userId: string): Promise<{ id: string; balance: number; currency: string } | null>;
  getTransactions(walletId: string, limit: number): Promise<{ id: string; type: string; amount: number; createdAt: Date }[]>;
  createTransaction(walletId: string, type: string, amount: number, description: string, idempotencyKey?: string): Promise<{ id: string }>;
  getConsumables(userId: string): Promise<{ sku: string; quantity: number }[]>;
  purchaseConsumable(userId: string, sku: string, quantity: number, idempotencyKey?: string): Promise<{ success: boolean; remaining: number }>;
  validatePromo(code: string, userId: string): Promise<{ valid: boolean; discount: number; tier: string | null }>;
  applyPromo(userId: string, code: string): Promise<{ success: boolean; discount: number }>;
}

// AI Repository Port
export interface AIRepository {
  generateIcebreakers(context: string, vibe: string, count: number): Promise<string[]>;
  generatePickupLines(vibe: string, count: number): Promise<string[]>;
  enhancePhoto(photoUrl: string): Promise<{ enhancedUrl: string; scores: { quality: number; lighting: number; appeal: number } }>;
  translate(text: string, from: string, to: string): Promise<string>;
  analyzeCompatibility(userId: string, targetId: string): Promise<{ score: number; dimensions: { interests: number; lifestyle: number; communication: number; values: number; activity: number } }>;
  getRizzScore(message: string, context: string[]): Promise<{ score: number; engagement: number; momentum: number; toneDrift: number }>;
}

// Combined Repository Port for Dependency Injection
export interface Repositories {
  users: UserRepository;
  messages: MessageRepository;
  grid: GridRepository;
  safety: SafetyRepository;
  monetization: MonetizationRepository;
  ai: AIRepository;
}
