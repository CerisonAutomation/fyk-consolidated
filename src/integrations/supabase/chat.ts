import { dataUrlToBlob, processPhoto } from "../../lib/media";
import { getSupabase, ok, toFailure, type Result } from "./client";
import type {
  AlbumShare,
  MediaAccessPolicy,
  Message,
  MessageAttachment,
  MessageReaction,
  PrivateAlbum,
  PrivateAlbumItem,
  Profile,
} from "./types";

export type ChatProfile = Pick<Profile, "id" | "display_name" | "handle" | "avatar_url" | "age" | "headline">;
export type ChatConversation = {
  id: string;
  lastMessageAt: string;
  lastReadAt: string | null;
  other: ChatProfile;
  preview: string;
};

export type ChatAttachment = MessageAttachment & { localUrl?: string };
export type ChatAlbumShare = AlbumShare & { album: PrivateAlbum | null };
export type ChatMessage = Message & {
  attachments: ChatAttachment[];
  reactions: MessageReaction[];
  albumShare: ChatAlbumShare | null;
  reply: Pick<Message, "id" | "body" | "type" | "sender_id"> | null;
};

export type AccessChoice = {
  policy: MediaAccessPolicy;
  durationSeconds?: number;
  maxOpens?: number;
};

export type AlbumWithItems = PrivateAlbum & { items: PrivateAlbumItem[] };

const PROFILE_COLUMNS = "id,display_name,handle,avatar_url,age,headline";
const MESSAGE_COLUMNS =
  "id,conversation_id,sender_id,type,body,storage_path,album_share_id,reply_to_id,expires_at,unsent_at,edited_at,created_at";
const ATTACHMENT_COLUMNS =
  "id,message_id,conversation_id,sender_id,storage_path,media_kind,mime_type,caption,width,height,bytes,access_policy,expires_at,max_opens,opens_used,opened_at,revoked_at,status,created_at";
const SHARE_COLUMNS =
  "id,album_id,conversation_id,sender_id,recipient_id,access_policy,expires_at,max_opens,opens_used,opened_at,revoked_at,status,created_at";
const ALBUM_COLUMNS =
  "id,owner_id,name,default_access_policy,default_duration_seconds,default_max_opens,created_at,updated_at";

export function accessFields(choice: AccessChoice) {
  const now = Date.now();
  if (choice.policy === "timed") {
    const seconds = Math.max(60, Math.min(604_800, choice.durationSeconds ?? 3_600));
    return { access_policy: choice.policy, expires_at: new Date(now + seconds * 1000).toISOString(), max_opens: null };
  }
  if (choice.policy === "view_once") {
    return { access_policy: choice.policy, expires_at: null, max_opens: 1 };
  }
  if (choice.policy === "open_count") {
    return { access_policy: choice.policy, expires_at: null, max_opens: Math.max(1, Math.min(20, choice.maxOpens ?? 3)) };
  }
  return { access_policy: "standard" as const, expires_at: null, max_opens: null };
}

export async function loadConversations(userId: string): Promise<Result<ChatConversation[]>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const mine = await client.from("conversation_members").select("conversation_id,last_read_at").eq("profile_id", userId);
  if (mine.error) return toFailure(mine.error);
  const memberships = mine.data ?? [];
  if (!memberships.length) return ok([]);
  const ids = memberships.map((row) => row.conversation_id);

  const [conversations, members, latest] = await Promise.all([
    client.from("conversations").select("id,last_message_at,created_at").in("id", ids).order("last_message_at", { ascending: false }),
    client.from("conversation_members").select("conversation_id,profile_id").in("conversation_id", ids),
    client.from("messages").select("conversation_id,body,type,created_at").in("conversation_id", ids).order("created_at", { ascending: false }),
  ]);
  if (conversations.error) return toFailure(conversations.error);
  if (members.error) return toFailure(members.error);
  if (latest.error) return toFailure(latest.error);

  const otherIds = [...new Set((members.data ?? []).filter((row) => row.profile_id !== userId).map((row) => row.profile_id))];
  if (!otherIds.length) return ok([]);
  const profiles = await client.from("profiles").select(PROFILE_COLUMNS).in("id", otherIds);
  if (profiles.error) return toFailure(profiles.error);
  const profileMap = new Map((profiles.data ?? []).map((profile) => [profile.id, profile]));

  return ok(
    (conversations.data ?? []).flatMap((conversation) => {
      const otherId = (members.data ?? []).find(
        (row) => row.conversation_id === conversation.id && row.profile_id !== userId,
      )?.profile_id;
      const other = otherId ? profileMap.get(otherId) : undefined;
      if (!other) return [];
      const last = (latest.data ?? []).find((message) => message.conversation_id === conversation.id);
      const preview = last?.body || (last?.type === "album_share" ? "Shared an album" : last ? "Sent media" : "New match");
      return [{
        id: conversation.id,
        lastMessageAt: conversation.last_message_at,
        lastReadAt: memberships.find((row) => row.conversation_id === conversation.id)?.last_read_at ?? null,
        other,
        preview,
      }];
    }),
  );
}

const MESSAGE_PAGE_SIZE = 50;

export type PaginatedMessages = {
  messages: ChatMessage[];
  /** The created_at of the last (oldest) message in this batch, used as the cursor for the next page. */
  nextCursor: string | null;
  /** Whether more messages exist before this batch. */
  hasMore: boolean;
};

/**
 * Load messages for a conversation with cursor-based pagination.
 *
 * @param conversationId - The conversation to load messages for.
 * @param cursor - An ISO timestamp. When provided, loads messages OLDER than this
 *                 cursor (i.e. going back in history). When omitted, loads the
 *                 most recent page of messages.
 */
export async function loadMessages(
  conversationId: string,
  cursor?: string,
): Promise<Result<PaginatedMessages>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  // Build query: if a cursor is provided, fetch messages older than it;
  // otherwise fetch the most recent page (descending, then reverse for display).
  let query = client
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId);

  if (cursor) {
    // Cursor-based: load older messages (created_at < cursor)
    query = query.lt("created_at", cursor).order("created_at", { ascending: false }).limit(MESSAGE_PAGE_SIZE);
  } else {
    // Initial load: most recent messages
    query = query.order("created_at", { ascending: false }).limit(MESSAGE_PAGE_SIZE);
  }

  const messages = await query;
  if (messages.error) return toFailure(messages.error);

  let rows = messages.data ?? [];
  // When loading the most recent page, reverse so oldest-first for display
  if (!cursor) rows = rows.reverse();

  if (!rows.length) return ok({ messages: [], nextCursor: null, hasMore: false });

  // Determine if there are more messages before this batch
  const oldestCreated = rows[0].created_at;
  const countResult = await client
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .lt("created_at", oldestCreated);
  const hasMore = (countResult.count ?? 0) > 0;

  // The cursor for the next page is the oldest message's created_at
  const nextCursor = rows[0].created_at;

  const messageIds = rows.map((row) => row.id);
  const shareIds = rows.map((row) => row.album_share_id).filter((id): id is string => !!id);

  const [attachments, reactions, shares] = await Promise.all([
    client.from("message_attachments").select(ATTACHMENT_COLUMNS).in("message_id", messageIds).order("created_at"),
    client.from("message_reactions").select("message_id,profile_id,emoji,created_at").in("message_id", messageIds),
    shareIds.length ? client.from("album_shares").select(SHARE_COLUMNS).in("id", shareIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (attachments.error) return toFailure(attachments.error);
  if (reactions.error) return toFailure(reactions.error);
  if (shares.error) return toFailure(shares.error);

  const shareRows = shares.data ?? [];
  const albumIds = [...new Set(shareRows.map((share) => share.album_id))];
  const albums = albumIds.length ? await client.from("private_albums").select(ALBUM_COLUMNS).in("id", albumIds) : { data: [], error: null };
  if (albums.error) return toFailure(albums.error);
  const albumMap = new Map((albums.data ?? []).map((album) => [album.id, album]));
  const rowMap = new Map(rows.map((row) => [row.id, row]));

  const chatMessages = rows.map((message) => {
    const share = message.album_share_id ? shareRows.find((item) => item.id === message.album_share_id) : undefined;
    const reply = message.reply_to_id ? rowMap.get(message.reply_to_id) : undefined;
    return {
      ...message,
      attachments: (attachments.data ?? []).filter((item) => item.message_id === message.id),
      reactions: (reactions.data ?? []).filter((item) => item.message_id === message.id),
      albumShare: share ? { ...share, album: albumMap.get(share.album_id) ?? null } : null,
      reply: reply ? { id: reply.id, body: reply.body, type: reply.type, sender_id: reply.sender_id } : null,
    };
  });

  return ok({ messages: chatMessages, nextCursor, hasMore });
}

export async function sendTextMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
  replyToId?: string;
}): Promise<Result<Message>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));
  const body = input.body.trim();
  if (!body || body.length > 4000) return { ok: false, code: "validation", message: "Messages must contain 1–4000 characters." };
  const result = await client.from("messages").insert({
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    type: "text",
    body,
    reply_to_id: input.replyToId ?? null,
  }).select(MESSAGE_COLUMNS).single();
  return result.error ? toFailure(result.error) : ok(result.data);
}

export async function sendAttachments(input: {
  conversationId: string;
  senderId: string;
  files: File[];
  caption: string;
  access: AccessChoice;
}): Promise<Result<Message>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));
  if (!input.files.length || input.files.length > 8) return { ok: false, code: "validation", message: "Choose 1–8 files." };
  const messageId = crypto.randomUUID();
  const uploaded: string[] = [];
  const fields = accessFields(input.access);

  for (const file of input.files) {
    const image = file.type.startsWith("image/");
    const video = file.type.startsWith("video/");
    if (!image && !video) return { ok: false, code: "validation", message: "Chat attachments must be images or videos." };
    if (file.size > 50 * 1024 * 1024) return { ok: false, code: "validation", message: "Each attachment must be under 50 MB." };
  }

  try {
    const attachmentRows: Partial<MessageAttachment>[] = [];
    for (const file of input.files) {
      const id = crypto.randomUUID();
      const isImage = file.type.startsWith("image/");
      const processed = isImage ? await processPhoto(file, "PRIVATE") : null;
      const blob = processed ? dataUrlToBlob(processed.url) : file;
      const ext = isImage ? "webp" : (file.name.split(".").pop()?.toLowerCase() || "mp4");
      const path = `${input.conversationId}/${messageId}/${id}.${ext}`;
      const upload = await client.storage.from("chat-media-private").upload(path, blob, {
        contentType: blob.type,
        cacheControl: "60",
      });
      if (upload.error) throw upload.error;
      uploaded.push(path);
      attachmentRows.push({
        id,
        message_id: messageId,
        conversation_id: input.conversationId,
        sender_id: input.senderId,
        storage_path: path,
        media_kind: isImage ? "image" : "video",
        mime_type: blob.type,
        caption: null,
        width: processed?.width ?? null,
        height: processed?.height ?? null,
        bytes: blob.size,
        ...fields,
        status: "active",
      });
    }

    const message = await client.from("messages").insert({
      id: messageId,
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      type: input.files.some((file) => file.type.startsWith("video/")) ? "video" : "image",
      body: input.caption.trim() || null,
    }).select(MESSAGE_COLUMNS).single();
    if (message.error) throw message.error;
    const attachmentInsert = await client.from("message_attachments").insert(attachmentRows);
    if (attachmentInsert.error) throw attachmentInsert.error;
    return ok(message.data);
  } catch (error) {
    if (uploaded.length) await client.storage.from("chat-media-private").remove(uploaded);
    await client.from("messages").delete().eq("id", messageId).eq("sender_id", input.senderId);
    return toFailure(error);
  }
}

export async function loadOwnedAlbums(userId: string): Promise<Result<AlbumWithItems[]>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));
  const albums = await client.from("private_albums").select(ALBUM_COLUMNS).eq("owner_id", userId).order("created_at", { ascending: false });
  if (albums.error) return toFailure(albums.error);
  const rows = albums.data ?? [];
  if (!rows.length) return ok([]);
  const items = await client.from("private_album_items").select("id,owner_id,storage_path,position,album_id,media_kind,caption,created_at").in("album_id", rows.map((album) => album.id)).order("position");
  if (items.error) return toFailure(items.error);
  return ok(rows.map((album) => ({ ...album, items: (items.data ?? []).filter((item) => item.album_id === album.id) })));
}

export async function createAlbumFromFiles(input: {
  userId: string;
  name: string;
  files: File[];
  defaults: AccessChoice;
}): Promise<Result<AlbumWithItems>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));
  if (!input.files.length || input.files.length > 9) return { ok: false, code: "validation", message: "Choose 1–9 album images." };
  const fields = accessFields(input.defaults);
  const album = await client.from("private_albums").insert({
    owner_id: input.userId,
    name: input.name.trim() || "Private album",
    default_access_policy: fields.access_policy,
    default_duration_seconds: input.defaults.durationSeconds ?? null,
    default_max_opens: fields.max_opens,
  }).select(ALBUM_COLUMNS).single();
  if (album.error) return toFailure(album.error);
  const uploaded: string[] = [];
  try {
    const items: Partial<PrivateAlbumItem>[] = [];
    for (const [position, file] of input.files.entries()) {
      const processed = await processPhoto(file, "PRIVATE");
      const blob = dataUrlToBlob(processed.url);
      const path = `${input.userId}/${album.data.id}/${crypto.randomUUID()}.webp`;
      const upload = await client.storage.from("albums-private").upload(path, blob, { contentType: blob.type, cacheControl: "60" });
      if (upload.error) throw upload.error;
      uploaded.push(path);
      items.push({ owner_id: input.userId, album_id: album.data.id, storage_path: path, position, media_kind: "image", caption: null });
    }
    const inserted = await client.from("private_album_items").insert(items).select("id,owner_id,storage_path,position,album_id,media_kind,caption,created_at");
    if (inserted.error) throw inserted.error;
    return ok({ ...album.data, items: inserted.data });
  } catch (error) {
    if (uploaded.length) await client.storage.from("albums-private").remove(uploaded);
    await client.from("private_albums").delete().eq("id", album.data.id).eq("owner_id", input.userId);
    return toFailure(error);
  }
}

export async function shareAlbum(input: {
  albumId: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  access: AccessChoice;
}): Promise<Result<AlbumShare>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));
  const fields = accessFields(input.access);
  const share = await client.from("album_shares").insert({
    album_id: input.albumId,
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    recipient_id: input.recipientId,
    ...fields,
    status: "pending",
  }).select(SHARE_COLUMNS).single();
  if (share.error) return toFailure(share.error);
  const message = await client.from("messages").insert({
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    type: "album_share",
    body: null,
    album_share_id: share.data.id,
  });
  if (message.error) {
    await client.from("album_shares").delete().eq("id", share.data.id).eq("sender_id", input.senderId);
    return toFailure(message.error);
  }
  return ok(share.data);
}

export async function revokeAttachment(id: string, senderId: string): Promise<Result<null>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));
  const result = await client.from("message_attachments").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", id).eq("sender_id", senderId).is("opened_at", null).select("id").maybeSingle();
  if (result.error) return toFailure(result.error);
  return result.data ? ok(null) : { ok: false, code: "already_opened", message: "Only unopened media can be revoked." };
}

export async function revokeAlbumShare(id: string, senderId: string): Promise<Result<null>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));
  const result = await client.from("album_shares").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", id).eq("sender_id", senderId);
  return result.error ? toFailure(result.error) : ok(null);
}

export async function respondToAlbumShare(id: string, recipientId: string, accept: boolean): Promise<Result<null>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));
  const result = await client.from("album_shares").update({ status: accept ? "active" : "declined" }).eq("id", id).eq("recipient_id", recipientId).eq("status", "pending");
  return result.error ? toFailure(result.error) : ok(null);
}

export async function reactToMessage(messageId: string, userId: string, emoji: MessageReaction["emoji"]): Promise<Result<null>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));
  const result = await client.from("message_reactions").upsert({ message_id: messageId, profile_id: userId, emoji }, { onConflict: "message_id,profile_id" });
  return result.error ? toFailure(result.error) : ok(null);
}

export async function openAttachment(attachment: ChatAttachment, own: boolean): Promise<Result<string>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));
  const download = await client.storage.from("chat-media-private").download(attachment.storage_path);
  if (download.error) return toFailure(download.error);
  if (!own) {
    const opened = await client.rpc("register_media_open", { target: attachment.id });
    if (opened.error) return toFailure(opened.error);
  }
  return ok(URL.createObjectURL(download.data));
}

export async function openAlbumShare(share: ChatAlbumShare, own: boolean): Promise<Result<{ urls: string[]; items: PrivateAlbumItem[] }>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));
  const items = await client.from("private_album_items").select("id,owner_id,storage_path,position,album_id,media_kind,caption,created_at").eq("album_id", share.album_id).order("position");
  if (items.error) return toFailure(items.error);
  const urls: string[] = [];
  for (const item of items.data ?? []) {
    const download = await client.storage.from("albums-private").download(item.storage_path);
    if (download.error) {
      urls.forEach(URL.revokeObjectURL);
      return toFailure(download.error);
    }
    urls.push(URL.createObjectURL(download.data));
  }
  if (!own) {
    const opened = await client.rpc("register_album_open", { target: share.id });
    if (opened.error) {
      urls.forEach(URL.revokeObjectURL);
      return toFailure(opened.error);
    }
  }
  return ok({ urls, items: items.data ?? [] });
}

export async function markConversationRead(conversationId: string, userId: string): Promise<Result<null>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));
  const result = await client.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("profile_id", userId);
  return result.error ? toFailure(result.error) : ok(null);
}