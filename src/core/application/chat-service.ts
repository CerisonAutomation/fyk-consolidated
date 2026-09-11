// ═══════════════════════════════════════════════════════════════════════════════
// Application — Chat & Messaging Use Cases
// ═══════════════════════════════════════════════════════════════════════════════
//
// Orchestrates domain logic with repository ports.
// Contains NO Prisma imports — only port interfaces.

import type { ConversationRepository, NotificationRepository, ProfileRepository } from "../ports/repositories";
import type { Conversation, Message } from "../domain/types";
import { ok, fail, type Result } from "../domain/errors";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConversationSummary {
  id: string;
  type: string;
  name?: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
}

export interface SendMessageOptions {
  replyToId?: string;
  ephemeral?: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ChatService {
  constructor(
    private conversationRepo: ConversationRepository,
    private notificationRepo: NotificationRepository,
    private profileRepo: ProfileRepository,
  ) {}

  // ── Queries ──────────────────────────────────────────────────────────────

  /**
   * Returns all conversations for a user, sorted by most recent activity.
   * Includes unread counts.
   */
  async getConversations(userId: string): Promise<Result<ConversationSummary[]>> {
    const conversations = await this.conversationRepo.findByUserId(userId);

    const summaries: ConversationSummary[] = conversations.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      participants: c.participants,
      lastMessage: c.lastMessage,
      unreadCount: c.unreadCount,
      createdAt: c.createdAt,
    }));

    // Sort by last message time (most recent first)
    summaries.sort((a, b) => {
      const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return ok(summaries);
  }

  /**
   * Returns messages in a conversation, marks them as read for the user.
   * Verifies the user is a participant.
   */
  async getMessages(
    conversationId: string,
    userId: string,
  ): Promise<Result<Message[]>> {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) {
      return fail("CONVERSATION_NOT_FOUND", `Conversation "${conversationId}" does not exist`);
    }

    if (!conversation.participants.includes(userId)) {
      return fail("NOT_PARTICIPANT", "You are not a participant in this conversation");
    }

    const messages = await this.conversationRepo.getMessages(conversationId);

    // Mark conversation as read for this user
    await this.conversationRepo.markRead(conversationId, userId);

    return ok(messages);
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  /**
   * Sends a message in a conversation.
   * Creates notifications for other participants.
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    options?: SendMessageOptions,
  ): Promise<Result<Message>> {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) {
      return fail("CONVERSATION_NOT_FOUND", `Conversation "${conversationId}" does not exist`);
    }

    if (!conversation.participants.includes(senderId)) {
      return fail("NOT_PARTICIPANT", "You are not a participant in this conversation");
    }

    if (!content.trim()) {
      return fail("EMPTY_MESSAGE", "Message content cannot be empty");
    }

    // Send the message through the repository
    const message = await this.conversationRepo.sendMessage(
      conversationId,
      senderId,
      content.trim(),
      {
        replyToId: options?.replyToId,
        ephemeral: options?.ephemeral,
      },
    );

    // Create notifications for other participants
    const sender = await this.profileRepo.findById(senderId);
    const senderName = sender?.pseudo ?? "Someone";

    const otherParticipants = conversation.participants.filter((id) => id !== senderId);

    await Promise.all(
      otherParticipants.map((participantId) =>
        this.notificationRepo.create({
          userId: participantId,
          type: "message",
          title: `New message from ${senderName}`,
          body: content.length > 100 ? `${content.slice(0, 100)}...` : content,
          actorId: senderId,
          href: `/chat/${conversationId}`,
        }),
      ),
    );

    return ok(message);
  }

  /**
   * Creates or finds a direct conversation between two users.
   * If a conversation already exists between them, returns the existing one.
   */
  async startConversation(
    userId1: string,
    userId2: string,
  ): Promise<Result<ConversationSummary>> {
    if (userId1 === userId2) {
      return fail("SELF_CONVERSATION", "Cannot start a conversation with yourself");
    }

    // Verify both users exist
    const [user1, user2] = await Promise.all([
      this.profileRepo.findById(userId1),
      this.profileRepo.findById(userId2),
    ]);

    if (!user1) return fail("USER1_NOT_FOUND", "First user profile not found");
    if (!user2) return fail("USER2_NOT_FOUND", "Second user profile not found");

    const conversation = await this.conversationRepo.findOrCreateDirect(userId1, userId2);

    return ok({
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      participants: conversation.participants,
      lastMessage: conversation.lastMessage,
      unreadCount: conversation.unreadCount,
      createdAt: conversation.createdAt,
    });
  }

  /**
   * Adds a reaction (emoji) to a message.
   */
  async reactToMessage(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<Result<void>> {
    if (!emoji.trim()) {
      return fail("EMPTY_REACTION", "Reaction emoji cannot be empty");
    }

    // Find which conversation this message belongs to
    // We need to verify the user has access — the repo handles this
    try {
      await this.conversationRepo.addReaction(messageId, userId, emoji.trim());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found") || message.includes("not a participant")) {
        return fail("REACTION_FAILED", `Could not add reaction: ${message}`);
      }
      throw error;
    }

    return ok(undefined);
  }

  /**
   * Marks all messages in a conversation as read for the user.
   */
  async markConversationRead(
    conversationId: string,
    userId: string,
  ): Promise<Result<void>> {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) {
      return fail("CONVERSATION_NOT_FOUND", `Conversation "${conversationId}" does not exist`);
    }

    if (!conversation.participants.includes(userId)) {
      return fail("NOT_PARTICIPANT", "You are not a participant in this conversation");
    }

    await this.conversationRepo.markRead(conversationId, userId);
    return ok(undefined);
  }

  /**
   * Returns the total unread message count across all conversations.
   */
  async getUnreadCount(userId: string): Promise<Result<number>> {
    const conversations = await this.conversationRepo.findByUserId(userId);
    const total = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    return ok(total);
  }
}
