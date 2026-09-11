import { PrismaClient } from "../../generated/prisma";
import type {
  Conversation,
  Message,
  MessageReaction,
} from "../../core/domain/types";
import type { ConversationRepository } from "../../core/ports/repositories";

// ── Domain <-> Prisma mappers ──────────────────────────────────────────────

function toDomainMessage(row: any): Message {
  const rawReactions = (row.reactions as any[]) ?? [];
  const reactions: MessageReaction[] = rawReactions.map((r: any) => ({
    messageId: row.id,
    userId: r.userId ?? r.userId,
    emoji: r.emoji,
    createdAt: r.createdAt ?? row.createdAt.toISOString(),
  }));

  return {
    id: row.id,
    conversationId: row.conversationId ?? "",
    senderId: row.senderId,
    type: row.type,
    content: row.content || undefined,
    mediaUrl: row.mediaUrl || undefined,
    replyToId: row.replyToId ?? undefined,
    reactions,
    reads: [],
    attachments: [],
    isEdited: row.isEdited ?? false,
    isPinned: false,
    isRecalled: row.isDeleted ?? false,
    isEphemeral: row.isEphemeral ?? false,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDomainConversation(
  row: any,
  participantIds: string[],
  lastMessage?: any,
): Conversation {
  return {
    id: row.id,
    type: row.type,
    name: row.name ?? undefined,
    participants: participantIds,
    lastMessage: lastMessage ? toDomainMessage(lastMessage) : undefined,
    unreadCount: 0,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Adapter ────────────────────────────────────────────────────────────────

export function createConversationRepository(db: PrismaClient): ConversationRepository {
  return {
    async findByUserId(userId: string): Promise<Conversation[]> {
      const participations = await db.conversationParticipant.findMany({
        where: { userId },
        include: {
          conversation: {
            include: {
              participants: true,
              messages: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
        orderBy: {
          conversation: { updatedAt: "desc" },
        },
      });

      return participations.map((p: any) => {
        const conv = p.conversation;
        const participantIds = conv.participants.map((pp: any) => pp.userId);
        const lastMsg = conv.messages[0] ?? null;
        return toDomainConversation(conv, participantIds, lastMsg);
      });
    },

    async findById(id: string): Promise<Conversation | null> {
      const row = await db.conversation.findUnique({
        where: { id },
        include: {
          participants: true,
        },
      });
      if (!row) return null;

      const participantIds = row.participants.map((p: any) => p.userId);
      return toDomainConversation(row, participantIds);
    },

    async create(type: string, participantIds: string[]): Promise<Conversation> {
      const row = await db.conversation.create({
        data: {
          type,
          participants: {
            create: participantIds.map((userId) => ({ userId })),
          },
        },
        include: { participants: true },
      });

      return toDomainConversation(row, participantIds);
    },

    async findOrCreateDirect(userId1: string, userId2: string): Promise<Conversation> {
      // Find existing DM conversation between these two users
      const existing = await db.conversation.findFirst({
        where: {
          type: "dm",
          participants: {
            every: {
              userId: { in: [userId1, userId2] },
            },
          },
        },
        include: { participants: true },
      });

      if (existing && existing.participants.length === 2) {
        return toDomainConversation(
          existing,
          existing.participants.map((p: any) => p.userId),
        );
      }

      // Create new DM conversation inline (cannot use `this` in object literal)
      const row = await db.conversation.create({
        data: {
          type: "dm",
          participants: {
            create: [
              { userId: userId1 },
              { userId: userId2 },
            ],
          },
        },
        include: { participants: true },
      });

      return toDomainConversation(
        row,
        row.participants.map((pp: any) => pp.userId),
      );
    },

    async getMessages(
      conversationId: string,
      limit: number = 50,
    ): Promise<Message[]> {
      const rows = await db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        take: limit,
      });
      return rows.map(toDomainMessage);
    },

    async sendMessage(
      conversationId: string,
      senderId: string,
      content: string,
      options?: { replyToId?: string; ephemeral?: boolean; toxicScore?: number },
    ): Promise<Message> {
      const row = await db.message.create({
        data: {
          conversationId,
          senderId,
          content,
          type: "text",
          replyToId: options?.replyToId ?? null,
          isEphemeral: options?.ephemeral ?? false,
        },
      });

      // Update conversation's last message timestamp
      await db.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return toDomainMessage(row);
    },

    async markRead(conversationId: string, userId: string): Promise<void> {
      await db.conversationParticipant.updateMany({
        where: {
          conversationId,
          userId,
        },
        data: {
          lastReadAt: new Date(),
          unreadCount: 0,
        },
      });
    },

    async addReaction(
      messageId: string,
      userId: string,
      emoji: string,
    ): Promise<void> {
      const existing = await db.messageReaction.findUnique({
        where: {
          messageId_userId_emoji: { messageId, userId, emoji },
        },
      });

      if (existing) {
        // Toggle off: remove existing reaction
        await db.messageReaction.delete({
          where: {
            messageId_userId_emoji: { messageId, userId, emoji },
          },
        });
      } else {
        // Add reaction
        await db.messageReaction.create({
          data: { messageId, userId, emoji },
        });

        // Also update the reactions JSON array on the message
        const message = await db.message.findUnique({ where: { id: messageId } });
        if (message) {
          const reactions = (message.reactions as any[]) ?? [];
          reactions.push({ userId, emoji, createdAt: new Date().toISOString() });
          await db.message.update({
            where: { id: messageId },
            data: { reactions },
          });
        }
      }
    },
  };
}
