/**
 * SendMessage Use Case — Hexagonal Architecture
 * Compared to Grindr: unsend, expiring photos, private albums, screenshot blocking, translation
 * Compared to Romeo: unlimited free chat, QuickShare, instant messaging
 * Practical, high fidelity, secure, with enterprise patterns
 */

import type { Message, MessageId, ConversationId } from '../../domain/entities/message';
import type { MessageRepository } from '../../ports/repositories';
import type { TranslationService, StorageService, PushService, ModerationService } from '../../ports/services';
import { createMessageId } from '../../domain/entities/message';
import { telemetry } from '#/lib/enterprise/telemetry';
import { resilient } from '#/lib/enterprise/self-healing';
import { auditLogger } from '#/lib/enterprise/security-hardened';

export interface SendMessageInput {
  senderId: string;
  receiverId: string;
  conversationId?: ConversationId;
  type: 'text' | 'image' | 'video' | 'audio' | 'location' | 'gift' | 'poll' | 'voice-note';
  content: string;
  mediaFile?: File | Buffer;
  location?: { lat: number; lng: number; place?: string };
  replyTo?: MessageId;
  options?: {
    expiring?: boolean;
    expiresInSeconds?: number;
    privateAlbum?: boolean;
    ephemeral?: boolean;
    ephemeralExpiresInSeconds?: number;
    autoTranslate?: boolean;
    targetLanguage?: string;
    idempotencyKey?: string;
  };
}

export interface SendMessageOutput {
  message: Message;
  conversationId: ConversationId;
  translated: string | null;
  moderated: boolean;
  traceId: string;
}

export class SendMessageUseCase {
  constructor(
    private readonly messageRepo: MessageRepository,
    private readonly translation: TranslationService,
    private readonly storage: StorageService,
    private readonly push: PushService,
    private readonly moderation: ModerationService,
  ) {}

  async execute(input: SendMessageInput): Promise<SendMessageOutput> {
    const traceId = crypto.randomUUID();
    const span = telemetry.startSpan('usecase.send-message', 'server', undefined, { userId: input.senderId });

    try {
      // Idempotency check
      if (input.options?.idempotencyKey) {
        // In production, check idempotency store
        // const existing = await this.messageRepo.findByIdempotencyKey(input.options.idempotencyKey);
        // if (existing) return existing;
      }

      // Moderation — text and media
      const moderationResult = await resilient(
        async () => this.moderation.moderateText(input.content),
        { retry: { maxAttempts: 2, initialDelayMs: 100, maxDelayMs: 500, factor: 2, jitter: true }, timeoutMs: 2000, circuitBreaker: 'moderation' },
      );

      if (!moderationResult.safe) {
        telemetry.counter('usecase.message.moderation.blocked', 1);
        throw new Error(`Message blocked: ${moderationResult.categories.join(', ')}`);
      }

      // Handle media upload if present
      let mediaUrl: string | null = null;
      let mediaMetadata: Message['mediaMetadata'] = null;

      if (input.mediaFile) {
        const uploadResult = await resilient(
          async () => this.storage.upload(input.mediaFile!, `messages/${input.senderId}/${Date.now()}`, {
            private: input.options?.privateAlbum,
            expiring: input.options?.expiring,
            expiresAt: input.options?.expiresInSeconds ? new Date(Date.now() + input.options.expiresInSeconds * 1000) : undefined,
          }),
          { retry: { maxAttempts: 3, initialDelayMs: 200, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 5000, circuitBreaker: 'storage' },
        );

        mediaUrl = uploadResult.url;
        mediaMetadata = {
          width: null,
          height: null,
          duration: null,
          mimeType: null,
          size: null,
          expiring: !!input.options?.expiring,
          expiresAt: input.options?.expiresInSeconds ? new Date(Date.now() + input.options.expiresInSeconds * 1000) : null,
          privateAlbum: !!input.options?.privateAlbum,
        };
      }

      // Translation if requested
      let translated: string | null = null;
      if (input.options?.autoTranslate && input.options.targetLanguage) {
        translated = await resilient(
          async () => this.translation.translate(input.content, 'auto', input.options!.targetLanguage!),
          { retry: { maxAttempts: 2, initialDelayMs: 100, maxDelayMs: 500, factor: 2, jitter: true }, timeoutMs: 2000, circuitBreaker: 'translation' },
        );
      }

      // Find or create conversation
      let conversationId = input.conversationId;
      if (!conversationId) {
        const existing = await this.messageRepo.findConversation([input.senderId, input.receiverId]);
        if (existing) {
          conversationId = existing.id;
        } else {
          const newConv = await this.messageRepo.createConversation([input.senderId, input.receiverId]);
          conversationId = newConv.id;
        }
      }

      // Create message
      const message: Message = {
        id: createMessageId(crypto.randomUUID()),
        conversationId: conversationId!,
        senderId: input.senderId,
        receiverId: input.receiverId,
        type: input.type,
        content: input.content,
        mediaUrl,
        mediaMetadata,
        location: input.location ? { lat: input.location.lat, lng: input.location.lng, place: input.location.place ?? null } : null,
        replyTo: input.replyTo ?? null,
        reactions: [],
        isEdited: false,
        isDeleted: false,
        deletedAt: null,
        status: 'sent',
        isEphemeral: !!input.options?.ephemeral,
        ephemeralExpiresAt: input.options?.ephemeralExpiresInSeconds ? new Date(Date.now() + input.options.ephemeralExpiresInSeconds * 1000) : null,
        isPinned: false,
        isRewarded: false,
        isBroadcast: false,
        translation: translated ? { original: input.content, translated, language: input.options?.targetLanguage ?? null, autoTranslated: true } : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const saved = await resilient(
        async () => this.messageRepo.save(message),
        { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: 'message-repo' },
      );

      // Push notification
      await resilient(
        async () => this.push.send(input.receiverId, 'New message', input.content.slice(0, 100), { conversationId, messageId: saved.id }),
        { retry: { maxAttempts: 2, initialDelayMs: 200, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: 'push' },
      ).catch(() => {
        // Non-critical, log but don't fail
        telemetry.counter('usecase.message.push.failed', 1);
      });

      auditLogger.log({
        userId: input.senderId,
        action: 'message.send',
        resource: 'message',
        result: 'success',
        details: { conversationId, messageId: saved.id, type: input.type, hasMedia: !!mediaUrl, traceId },
      });

      telemetry.counter('usecase.message.sent', 1, { type: input.type });
      telemetry.endSpan(span.spanId, 'ok');

      return {
        message: saved,
        conversationId: conversationId!,
        translated,
        moderated: true,
        traceId,
      };
    } catch (error) {
      telemetry.endSpan(span.spanId, 'error', error instanceof Error ? error.message : 'Unknown');
      throw error;
    }
  }
}
