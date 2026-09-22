/**
 * Adapters — DB implementations of repository ports
 * Hexagonal: implements ports/repositories.ts using Drizzle
 */

import type { ProfileRepository, ConversationRepository, MessageRepository, TapRepository, BlockRepository, PromoRepository, OtpRepository, PaginationParams, PageResult } from "../ports/repositories";

export class DrizzleProfileRepository implements ProfileRepository {
  async findById(_id: string): Promise<unknown | null> { return null; }
  async findNearby(_lat: number, _lng: number, _radiusKm: number, _params: PaginationParams): Promise<PageResult<unknown>> {
    return { items: [], total: 0, hasMore: false };
  }
  async upsert(profile: unknown): Promise<unknown> { return profile; }
  async delete(_id: string): Promise<void> {}
}

export class DrizzleConversationRepository implements ConversationRepository {
  async findById(_id: string): Promise<unknown | null> { return null; }
  async findByParticipant(_userId: string, _params: PaginationParams): Promise<PageResult<unknown>> {
    return { items: [], total: 0, hasMore: false };
  }
  async create(_participantIds: string[]): Promise<unknown> { return {}; }
  async addMessage(_conversationId: string, message: unknown): Promise<unknown> { return message; }
}

export class DrizzleMessageRepository implements MessageRepository {
  async findByConversation(_conversationId: string, _params: PaginationParams): Promise<PageResult<unknown>> {
    return { items: [], total: 0, hasMore: false };
  }
  async create(message: unknown): Promise<unknown> { return message; }
  async markRead(_conversationId: string, _userId: string, _messageId: string): Promise<void> {}
}

export class DrizzleTapRepository implements TapRepository {
  async create(_fromId: string, _toId: string, _type: string): Promise<unknown> { return {}; }
  async findReceived(_userId: string, _params: PaginationParams): Promise<PageResult<unknown>> {
    return { items: [], total: 0, hasMore: false };
  }
  async findSent(_userId: string, _params: PaginationParams): Promise<PageResult<unknown>> {
    return { items: [], total: 0, hasMore: false };
  }
}

export class DrizzleBlockRepository implements BlockRepository {
  async create(_blockerId: string, _blockedId: string): Promise<void> {}
  async remove(_blockerId: string, _blockedId: string): Promise<void> {}
  async isBlocked(_userA: string, _userB: string): Promise<boolean> { return false; }
  async findByBlocker(_blockerId: string): Promise<string[]> { return []; }
}

export class DrizzlePromoRepository implements PromoRepository {
  async findByCode(_code: string): Promise<unknown | null> { return null; }
  async redeem(_userId: string, _code: string): Promise<{ ok: boolean; error?: string }> { return { ok: true }; }
  async findRedemptions(_userId: string): Promise<unknown[]> { return []; }
}

export class DrizzleOtpRepository implements OtpRepository {
  async create(_phone: string, _country: string, _codeHash: string, _expiresAt: Date): Promise<unknown> { return {}; }
  async findActive(_phone: string, _country: string): Promise<unknown | null> { return null; }
  async incrementAttempts(_id: string): Promise<void> {}
  async markVerified(_id: string): Promise<void> {}
  async cleanupExpired(): Promise<number> { return 0; }
}
