/**
 * Message Entity — Core Domain — Hexagonal Architecture
 * Compared to Grindr: unsend, expiring photos, private albums, translation
 * Compared to Romeo: unlimited free chat, QuickShare, instant messaging
 */

export type MessageId = string & { readonly brand: unique symbol };
export type ConversationId = string & { readonly brand: unique symbol };
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'location' | 'gift' | 'system' | 'poll' | 'voice-note';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'deleted';

export interface Message {
  id: MessageId;
  conversationId: ConversationId;
  senderId: string;
  receiverId: string;
  type: MessageType;
  content: string;
  mediaUrl: string | null;
  mediaMetadata: {
    width: number | null;
    height: number | null;
    duration: number | null; // for audio/video
    mimeType: string | null;
    size: number | null;
    expiring: boolean; // Grindr: expiring photos
    expiresAt: Date | null;
    privateAlbum: boolean; // Grindr: private albums, MachoBB: hidden albums
  } | null;
  location: {
    lat: number;
    lng: number;
    place: string | null;
  } | null;
  replyTo: MessageId | null;
  reactions: {
    emoji: string;
    userIds: string[];
  }[];
  isEdited: boolean;
  isDeleted: boolean; // Grindr: unsend
  deletedAt: Date | null;
  status: MessageStatus;
  isEphemeral: boolean; // disappearing messages
  ephemeralExpiresAt: Date | null;
  isPinned: boolean; // pinned messages
  isRewarded: boolean; // rewarded ad temp token
  isBroadcast: boolean; // admin broadcast
  translation: {
    original: string;
    translated: string | null;
    language: string | null;
    autoTranslated: boolean; // Grindr: chat translation
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: ConversationId;
  participantIds: string[];
  lastMessage: Message | null;
  unreadCount: number;
  isArchived: boolean;
  isMuted: boolean;
  isPinned: boolean;
  isBlocked: boolean;
  isFavorite: boolean;
  theme: string | null; // chat themes
  wallpaper: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TypingIndicator {
  conversationId: ConversationId;
  userId: string;
  isTyping: boolean;
  timestamp: Date;
}

export interface ReadReceipt {
  messageId: MessageId;
  userId: string;
  readAt: Date;
}

export function createMessageId(id: string): MessageId {
  return id as MessageId;
}

export function createConversationId(id: string): ConversationId {
  return id as ConversationId;
}

export function canUnsendMessage(message: Message, userId: string, windowMs = 10 * 60 * 1000): boolean {
  if (message.senderId !== userId) return false;
  if (message.isDeleted) return false;
  return Date.now() - message.createdAt.getTime() < windowMs;
}

export function isMessageExpired(message: Message): boolean {
  if (!message.isEphemeral || !message.ephemeralExpiresAt) return false;
  return Date.now() > message.ephemeralExpiresAt.getTime();
}

export function shouldAutoTranslate(message: Message, userPrefs: { autoTranslate: boolean; language: string }): boolean {
  if (!userPrefs.autoTranslate) return false;
  if (!message.translation) return false;
  if (message.translation.language === userPrefs.language) return false;
  return true;
}

export function getConversationName(conversation: Conversation, currentUserId: string, users: Map<string, { displayName: string }>): string {
  const otherId = conversation.participantIds.find(id => id !== currentUserId);
  if (!otherId) return 'Unknown';
  return users.get(otherId)?.displayName ?? 'Unknown';
}
