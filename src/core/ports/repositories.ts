/**
 * Ports — Repository interfaces, hexagonal architecture
 * Domain defines what it needs, adapters implement
 */

export type PaginationParams = { limit: number; offset: number; cursor?: string };
export type PageResult<T> = { items: T[]; total: number; nextCursor?: string; hasMore: boolean };

export interface ProfileRepository {
  findById(id: string): Promise<unknown | null>;
  findNearby(lat: number, lng: number, radiusKm: number, params: PaginationParams): Promise<PageResult<unknown>>;
  upsert(profile: unknown): Promise<unknown>;
  delete(id: string): Promise<void>;
}

export interface ConversationRepository {
  findById(id: string): Promise<unknown | null>;
  findByParticipant(userId: string, params: PaginationParams): Promise<PageResult<unknown>>;
  create(participantIds: string[]): Promise<unknown>;
  addMessage(conversationId: string, message: unknown): Promise<unknown>;
}

export interface MessageRepository {
  findByConversation(conversationId: string, params: PaginationParams): Promise<PageResult<unknown>>;
  create(message: unknown): Promise<unknown>;
  markRead(conversationId: string, userId: string, messageId: string): Promise<void>;
}

export interface TapRepository {
  create(fromId: string, toId: string, type: string): Promise<unknown>;
  findReceived(userId: string, params: PaginationParams): Promise<PageResult<unknown>>;
  findSent(userId: string, params: PaginationParams): Promise<PageResult<unknown>>;
}

export interface BlockRepository {
  create(blockerId: string, blockedId: string): Promise<void>;
  remove(blockerId: string, blockedId: string): Promise<void>;
  isBlocked(userA: string, userB: string): Promise<boolean>;
  findByBlocker(blockerId: string): Promise<string[]>;
}

export interface PromoRepository {
  findByCode(code: string): Promise<unknown | null>;
  redeem(userId: string, code: string): Promise<{ ok: boolean; error?: string }>;
  findRedemptions(userId: string): Promise<unknown[]>;
}

export interface OtpRepository {
  create(phone: string, country: string, codeHash: string, expiresAt: Date): Promise<unknown>;
  findActive(phone: string, country: string): Promise<unknown | null>;
  incrementAttempts(id: string): Promise<void>;
  markVerified(id: string): Promise<void>;
  cleanupExpired(): Promise<number>;
}
