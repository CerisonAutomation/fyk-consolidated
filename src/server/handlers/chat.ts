import { asRows } from "../data/typed-rows";
/**
 * 1:1 messaging.
 *
 * The window rules a chat product is judged on — edit, recall, pin — are enforced
 * by triggers in 0006_mvp_gaps.sql. The handlers here mirror them so the API can
 * answer with a clean 4xx instead of a trigger error, but a client that skips the
 * API still cannot break them. That is the difference between a convention and a
 * guarantee.
 */

import { z } from "zod";
import { type ApiClient, type RequestCtx, readJson } from "../context";
import {
	PROFILE_LIST_COLUMNS,
	type ProfileRow,
	toPublicProfile,
} from "../data/profiles";
import {
	badRequest,
	conflict,
	dbFailure,
	forbidden,
	notFound,
} from "../errors";

/**
 * The three small acknowledgements the chat UI is allowed to know about. They are
 * declared next to the code that produces them and mirrored by
 * `src/lib/api-types.ts` as types rather than restated by hand: a hand-copied
 * response shape is how a client ends up reading a field the server stopped
 * sending, and no compiler can catch that.
 */
export type SendMessageAck = { id: string; createdAt: string };
export type MessageEditAck = { edited: boolean };
export type MessageActionAck = { recalled?: boolean; pinned?: boolean };

export const EDIT_WINDOW_MINUTES = 15;
export const RECALL_WINDOW_MINUTES = 60;
export const MAX_PINS_PER_CONVERSATION = 5;
const MESSAGE_COLUMNS =
	"id,conversation_id,sender_id,type,body,storage_path,album_share_id,reply_to_id,expires_at,unsent_at,edited_at,pinned_at,pinned_by,created_at";
const PAGE_SIZE = 50;

export const sendMessageSchema = z
	.object({
		body: z
			.string()
			.trim()
			.max(4000, "Messages are limited to 4000 characters.")
			.optional(),
		/** Returned by POST /api/media/chat; the path, not a URL, is what is stored. */
		mediaPath: z.string().trim().max(300).optional(),
		mediaKind: z.enum(["image", "video", "audio"]).optional(),
		replyToId: z.string().uuid().optional(),
		/** Client-generated, so a retry after a dropped request is not a second message. */
		idempotencyKey: z.string().min(8).max(64).optional(),
	})
	.refine((value) => Boolean(value.body?.trim()) || Boolean(value.mediaPath), {
		message: "Write something or attach a file.",
		path: ["body"],
	})
	.refine((value) => !value.mediaPath || Boolean(value.mediaKind), {
		message: "That attachment is missing its type.",
		path: ["mediaPath"],
	});

export const messageActionSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("edit"),
		value: z.string().trim().min(1).max(4000),
	}),
	z.object({ action: z.literal("recall") }),
	z.object({ action: z.literal("pin") }),
	z.object({ action: z.literal("unpin") }),
]);

export const reactionSchema = z.object({
	emoji: z.enum(["heart", "fire", "laugh", "wow", "like"]),
});

async function requireMembership(
	client: ApiClient,
	conversationId: string,
	userId: string,
) {
	const { data, error } = await client
		.from("conversation_members")
		.select("conversation_id,profile_id,last_read_at")
		.eq("conversation_id", conversationId)
		.eq("profile_id", userId)
		.maybeSingle();
	if (error) throw dbFailure(error, "That did not save. Please try again.");
	if (!data) throw forbidden("You are not part of that conversation.");
	return data;
}

export async function listConversations(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const client = ctx.db();

	const mine = await client
		.from("conversation_members")
		.select("conversation_id,last_read_at,archived_at")
		.eq("profile_id", caller.userId);
	if (mine.error)
		throw dbFailure(mine.error, "That did not save. Please try again.");
	const rows = (mine.data ?? []).filter(
		(row: { archived_at: string | null }) => !row.archived_at,
	);
	if (!rows.length) return { conversations: [] };

	const ids = rows.map(
		(row: { conversation_id: string }) => row.conversation_id,
	);
	const [conversations, members, latest] = await Promise.all([
		client
			.from("conversations")
			.select("id,last_message_at,match_id")
			.in("id", ids)
			.order("last_message_at", { ascending: false }),
		client
			.from("conversation_members")
			.select("conversation_id,profile_id")
			.in("conversation_id", ids),
		client
			.from("messages")
			.select("conversation_id,body,type,sender_id,created_at,unsent_at")
			.in("conversation_id", ids)
			.order("created_at", { ascending: false })
			.limit(ids.length * 5),
	]);
	if (conversations.error)
		throw dbFailure(
			conversations.error,
			"That did not save. Please try again.",
		);

	const otherIds = [
		...new Set(
			(members.data ?? [])
				.filter(
					(row: { profile_id: string }) => row.profile_id !== caller.userId,
				)
				.map((row: { profile_id: string }) => row.profile_id),
		),
	];
	const profiles = otherIds.length
		? await client
				.from("profiles")
				.select(PROFILE_LIST_COLUMNS)
				.in("id", otherIds)
		: { data: [] };
	const profileMap = new Map(
		asRows<ProfileRow>(profiles.data).map((row) => [row.id, row]),
	);

	const allMessages = asRows<{
		conversation_id: string;
		body: string | null;
		type: string;
		sender_id: string;
		created_at: string;
		unsent_at: string | null;
	}>(latest.data);

	const out = (conversations.data ?? []).map(
		(conversation: {
			id: string;
			last_message_at: string;
			match_id: string | null;
		}) => {
			const otherId = (members.data ?? []).find(
				(row: { conversation_id: string; profile_id: string }) =>
					row.conversation_id === conversation.id &&
					row.profile_id !== caller.userId,
			)?.profile_id as string | undefined;
			const other = otherId ? profileMap.get(otherId) : undefined;
			const messagesForConv = allMessages.filter(
				(message) => message.conversation_id === conversation.id,
			);
			const last = messagesForConv[0];
			const lastReadAt = rows.find(
				(row: { conversation_id: string }) =>
					row.conversation_id === conversation.id,
			)?.last_read_at as string | null;
			const unread = lastReadAt
				? messagesForConv.filter(
						(message) =>
							message.sender_id !== caller.userId &&
							Date.parse(message.created_at) > Date.parse(lastReadAt),
					).length
				: messagesForConv.length;

			const preview = last
				? last.unsent_at
					? "Message recalled"
					: last.body || (last.type !== "text" ? "Sent a photo" : "New match")
				: "New match";

			return {
				id: conversation.id,
				other: other ? toPublicProfile(other, { viewer: null, client }) : null,
				preview,
				lastMessageAt: conversation.last_message_at,
				unread,
				pinned: false,
			};
		},
	);

	// Pinned conversation is a per-member preference; it lives client-side until
	// there is a column for it, so it is reported as unsupported rather than faked.
	return {
		conversations: out.sort(
			(a: { lastMessageAt: string }, b: { lastMessageAt: string }) =>
				Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt),
		),
	};
}

export async function openConversationWith(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const body = await readJson(
		ctx.request,
		z.object({ targetId: z.string().uuid() }),
	);
	const client = ctx.db();
	if (body.targetId === caller.userId)
		throw badRequest("You cannot start a chat with yourself.");

	const blocked = await client
		.from("blocks")
		.select("id")
		.or(
			`and(blocker_id.eq.${caller.userId},blocked_id.eq.${body.targetId}),and(blocker_id.eq.${body.targetId},blocked_id.eq.${caller.userId})`,
		)
		.limit(1);
	if ((blocked.data ?? []).length)
		throw forbidden("You cannot message this person.");

	// A conversation may only exist for a mutual tap. Anything else would let a
	// user message a stranger who never opted in.
	const match = await client
		.from("matches")
		.select("id")
		.or(
			`and(user_a.eq.${caller.userId},user_b.eq.${body.targetId}),and(user_a.eq.${body.targetId},user_b.eq.${caller.userId})`,
		)
		.maybeSingle();
	if (match.error)
		throw dbFailure(match.error, "That did not save. Please try again.");
	if (!match.data)
		throw forbidden("You can only message someone who tapped you back.");

	const existing = await client
		.from("conversations")
		.select("id")
		.eq("match_id", match.data.id)
		.maybeSingle();
	if (existing.data)
		return { conversationId: existing.data.id, created: false };

	const created = await client
		.from("conversations")
		.insert({ match_id: match.data.id })
		.select("id")
		.single();
	if (created.error)
		throw dbFailure(created.error, "That did not save. Please try again.");
	await client.from("conversation_members").insert([
		{ conversation_id: created.data.id, profile_id: caller.userId },
		{ conversation_id: created.data.id, profile_id: body.targetId },
	]);
	return { conversationId: created.data.id, created: true };
}

export async function listMessages(ctx: RequestCtx, conversationId: string) {
	const caller = await ctx.auth();
	z.string().uuid().parse(conversationId);
	const client = ctx.db();
	await requireMembership(client, conversationId, caller.userId);

	const before = ctx.query.get("before");
	let builder = client
		.from("messages")
		.select(MESSAGE_COLUMNS)
		.eq("conversation_id", conversationId)
		.order("created_at", { ascending: false })
		.limit(PAGE_SIZE);
	if (before) builder = builder.lt("created_at", before);

	const [result, pinned] = await Promise.all([
		builder,
		client
			.from("messages")
			.select(MESSAGE_COLUMNS)
			.eq("conversation_id", conversationId)
			.not("pinned_at", "is", null)
			.order("pinned_at", { ascending: true }),
	]);
	if (result.error)
		throw dbFailure(result.error, "That did not save. Please try again.");

	const rows = asRows<Record<string, unknown>>(result.data).reverse();
	const senderIds = [...new Set(rows.map((row) => String(row.sender_id)))];
	const profiles = senderIds.length
		? await client
				.from("profiles")
				.select(PROFILE_LIST_COLUMNS)
				.in("id", senderIds)
		: { data: [] };
	const names = new Map(
		asRows<ProfileRow>(profiles.data).map((row) => [
			row.id,
			{
				displayName: row.display_name ?? row.handle ?? "Someone",
				avatarUrl: row.avatar_url,
			},
		]),
	);

	const ids = rows.map((row) => String(row.id));
	const reactions = ids.length
		? await client
				.from("message_reactions")
				.select("message_id,profile_id,emoji")
				.in("message_id", ids)
		: { data: [] };
	const reactionMap = new Map<string, { emoji: string; mine: boolean }[]>();
	for (const reaction of asRows<{
		message_id: string;
		profile_id: string;
		emoji: string;
	}>(reactions.data)) {
		const list = reactionMap.get(reaction.message_id) ?? [];
		list.push({
			emoji: reaction.emoji,
			mine: reaction.profile_id === caller.userId,
		});
		reactionMap.set(reaction.message_id, list);
	}

	// Media is served as a short signed URL minted per read, never as a stored
	// public link, because the bucket is private.
	const mediaPaths = rows
		.map((row) =>
			row.unsent_at || !row.storage_path ? null : String(row.storage_path),
		)
		.filter(Boolean) as string[];
	const signed = new Map<string, string>();
	if (mediaPaths.length) {
		const { data: signedRows } = await client.storage
			.from("chat-media-private")
			.createSignedUrls(mediaPaths, 60 * 10);
		for (const item of signedRows ?? []) {
			if (item.signedUrl && item.path) signed.set(item.path, item.signedUrl);
			// An attachment that failed to sign must render a fallback, not a
			// broken <img>; the client keys off the absence of `url`.
			if (item.error && item.path) signed.set(item.path, "");
		}
	}

	const messages = rows.map((row) => {
		// A recalled message's file is not handed out either. Minting a signed URL for
		// content the sender took back would leak it for the URL's whole ten-minute
		// life, which is exactly what recall is supposed to prevent.
		const path =
			row.unsent_at || !row.storage_path ? null : String(row.storage_path);
		return {
			id: row.id,
			senderId: row.sender_id,
			mine: row.sender_id === caller.userId,
			type: row.type,
			body: row.unsent_at ? null : row.body,
			recalled: Boolean(row.unsent_at),
			edited: Boolean(row.edited_at),
			editedAt: row.edited_at,
			pinnedAt: row.pinned_at,
			replyToId: row.reply_to_id,
			createdAt: row.created_at,
			mediaUrl: path ? signed.get(path) || null : null,
			mediaExpiresIn: path ? 600 : null,
			senderName: names.get(String(row.sender_id))?.displayName ?? "Someone",
			reactions: reactionMap.get(String(row.id)) ?? [],
			canEdit:
				row.sender_id === caller.userId &&
				!row.unsent_at &&
				!row.edited_at &&
				Date.now() - Date.parse(String(row.created_at)) <
					EDIT_WINDOW_MINUTES * 60_000,
			canRecall:
				row.sender_id === caller.userId &&
				!row.unsent_at &&
				Date.now() - Date.parse(String(row.created_at)) <
					RECALL_WINDOW_MINUTES * 60_000,
		};
	});

	const pinnedMessages = asRows<Record<string, unknown>>(pinned.data).map(
		(row) => ({
			id: row.id,
			body: row.unsent_at ? null : row.body,
			senderId: row.sender_id,
			pinnedAt: row.pinned_at,
		}),
	);

	// Opening a thread marks it read; unread counts come from this same write,
	// so the badge and the thread cannot disagree.
	await client
		.from("conversation_members")
		.update({ last_read_at: new Date().toISOString() })
		.eq("conversation_id", conversationId)
		.eq("profile_id", caller.userId);

	return {
		messages,
		pinned: pinnedMessages,
		hasMore: rows.length === PAGE_SIZE,
	};
}

export async function sendMessage(ctx: RequestCtx, conversationId: string) {
	const caller = await ctx.auth();
	z.string().uuid().parse(conversationId);
	const body = await readJson(ctx.request, sendMessageSchema);
	const client = ctx.db();
	await requireMembership(client, conversationId, caller.userId);

	// Blocks are checked both ways on send, so "they blocked me" stops delivery
	// before a row is written, not after.
	const members = await client
		.from("conversation_members")
		.select("profile_id")
		.eq("conversation_id", conversationId);
	const otherIds = asRows<{ profile_id: string }>(members.data)
		.map((row) => row.profile_id)
		.filter((id) => id !== caller.userId);
	if (otherIds.length) {
		const clauses = otherIds
			.flatMap((id) => [
				`and(blocker_id.eq.${caller.userId},blocked_id.eq.${id})`,
				`and(blocker_id.eq.${id},blocked_id.eq.${caller.userId})`,
			])
			.join(",");
		const blocked = await client
			.from("blocks")
			.select("id")
			.or(clauses)
			.limit(1);
		if ((blocked.data ?? []).length)
			throw forbidden("You cannot message this person.");
	}

	if (body.idempotencyKey) {
		// Content + window is the dedupe key available without a new column: an
		// identical body (or identical attachment path) inside a minute is treated as
		// the retry, so a flaky connection cannot double-send a message.
		const text = body.body?.trim() || null;
		const path = body.mediaPath ?? null;
		let probe = client
			.from("messages")
			.select("id")
			.eq("conversation_id", conversationId)
			.eq("sender_id", caller.userId)
			.gte("created_at", new Date(Date.now() - 60_000).toISOString());
		probe = text === null ? probe.is("body", null) : probe.eq("body", text);
		if (path !== null) probe = probe.eq("storage_path", path);
		const recent = await probe.limit(1);
		const duplicate = (recent.data ?? [])[0] as { id: string } | undefined;
		if (duplicate) return { message: { id: duplicate.id, deduplicated: true } };
	}

	if (body.replyToId) {
		const parent = await client
			.from("messages")
			.select("id,conversation_id")
			.eq("id", body.replyToId)
			.maybeSingle();
		if (!parent.data || parent.data.conversation_id !== conversationId)
			throw badRequest("That message is not in this conversation.");
	}

	const insert = await client
		.from("messages")
		.insert({
			conversation_id: conversationId,
			sender_id: caller.userId,
			type: "text",
			body: body.body,
			reply_to_id: body.replyToId ?? null,
		})
		.select(MESSAGE_COLUMNS)
		.single();
	if (insert.error)
		throw dbFailure(insert.error, "That did not save. Please try again.");

	await client
		.from("conversations")
		.update({ last_message_at: new Date().toISOString() })
		.eq("id", conversationId);

	// Deliberately small. `insert.data` is the raw row — snake_case columns, a
	// `storage_path`, an `album_share_id` — and none of it is the client's to know.
	// The thread itself arrives on the next read, projected.
	return sendMessageAck(insert.data);
}

/**
 * The answer a sender needs: it landed, and here is when. Extracted so the shape is
 * testable rather than an accident of whatever `.select()` happened to ask for.
 */
export function sendMessageAck(row: Record<string, unknown>): SendMessageAck {
	return { id: String(row.id), createdAt: String(row.created_at) };
}

export async function messageAction(ctx: RequestCtx, messageId: string) {
	const caller = await ctx.auth();
	z.string().uuid().parse(messageId);
	const body = await readJson(ctx.request, messageActionSchema);
	const client = ctx.db();

	const existing = await client
		.from("messages")
		.select(
			"id,sender_id,conversation_id,created_at,edited_at,unsent_at,pinned_at",
		)
		.eq("id", messageId)
		.maybeSingle();
	if (existing.error)
		throw dbFailure(existing.error, "That did not save. Please try again.");
	if (!existing.data) throw notFound("That message no longer exists.");
	const message = existing.data as unknown as {
		id: string;
		sender_id: string;
		conversation_id: string;
		created_at: string;
		edited_at: string | null;
		unsent_at: string | null;
		pinned_at: string | null;
	};

	await requireMembership(client, message.conversation_id, caller.userId);

	const ageMinutes = (Date.now() - Date.parse(message.created_at)) / 60_000;

	if (body.action === "edit") {
		if (message.sender_id !== caller.userId)
			throw forbidden("You can only edit your own messages.");
		if (message.unsent_at) throw conflict("That message was recalled.");
		if (message.edited_at) throw conflict("A message can only be edited once.");
		if (ageMinutes > EDIT_WINDOW_MINUTES)
			throw conflict(
				`Editing is only allowed for ${EDIT_WINDOW_MINUTES} minutes after sending.`,
			);
		const update = await client
			.from("messages")
			.update({ body: body.value })
			.eq("id", messageId)
			.select(MESSAGE_COLUMNS)
			.single();
		if (update.error)
			throw dbFailure(update.error, "That did not save. Please try again.");
		return { edited: true };
	}

	if (body.action === "recall") {
		if (message.sender_id !== caller.userId)
			throw forbidden("You can only recall your own messages.");
		if (ageMinutes > RECALL_WINDOW_MINUTES)
			throw conflict(
				`Recalling is only allowed for ${RECALL_WINDOW_MINUTES} minutes after sending.`,
			);
		const update = await client
			.from("messages")
			.update({ unsent_at: new Date().toISOString() })
			.eq("id", messageId)
			.select("id,unsent_at")
			.single();
		if (update.error)
			throw dbFailure(update.error, "That did not save. Please try again.");
		return { recalled: true };
	}

	// Pinning is a shared surface: either participant may pin, either may unpin.
	if (body.action === "pin") {
		if (message.pinned_at) throw conflict("That message is already pinned.");
		const count = await client
			.from("messages")
			.select("id")
			.eq("conversation_id", message.conversation_id)
			.not("pinned_at", "is", null)
			.limit(MAX_PINS_PER_CONVERSATION + 1);
		if ((count.data ?? []).length >= MAX_PINS_PER_CONVERSATION) {
			throw conflict(
				`You can pin at most ${MAX_PINS_PER_CONVERSATION} messages per conversation.`,
			);
		}
		const update = await client
			.from("messages")
			.update({ pinned_at: new Date().toISOString(), pinned_by: caller.userId })
			.eq("id", messageId)
			.select("id,pinned_at")
			.single();
		if (update.error)
			throw dbFailure(update.error, "That did not save. Please try again.");
		return { pinned: true };
	}

	if (!message.pinned_at) throw conflict("That message is not pinned.");
	const update = await client
		.from("messages")
		.update({ pinned_at: null, pinned_by: null })
		.eq("id", messageId)
		.select("id,pinned_at")
		.single();
	if (update.error)
		throw dbFailure(update.error, "That did not save. Please try again.");
	return { pinned: false };
}

export async function toggleReaction(ctx: RequestCtx, messageId: string) {
	const caller = await ctx.auth();
	z.string().uuid().parse(messageId);
	const body = await readJson(ctx.request, reactionSchema);
	const client = ctx.db();

	const message = await client
		.from("messages")
		.select("id,conversation_id,unsent_at")
		.eq("id", messageId)
		.maybeSingle();
	if (!message.data) throw notFound("That message no longer exists.");
	if ((message.data as { unsent_at: string | null }).unsent_at)
		throw conflict("That message was recalled.");
	await requireMembership(
		client,
		(message.data as { conversation_id: string }).conversation_id,
		caller.userId,
	);

	const existing = await client
		.from("message_reactions")
		.select("message_id")
		.eq("message_id", messageId)
		.eq("profile_id", caller.userId)
		.eq("emoji", body.emoji)
		.maybeSingle();
	if (existing.data) {
		await client
			.from("message_reactions")
			.delete()
			.eq("message_id", messageId)
			.eq("profile_id", caller.userId)
			.eq("emoji", body.emoji);
		return { active: false };
	}
	const insert = await client.from("message_reactions").insert({
		message_id: messageId,
		profile_id: caller.userId,
		emoji: body.emoji,
	});
	if (insert.error)
		throw dbFailure(insert.error, "That did not save. Please try again.");
	return { active: true };
}

export async function archiveConversation(
	ctx: RequestCtx,
	conversationId: string,
) {
	const caller = await ctx.auth();
	z.string().uuid().parse(conversationId);
	const body = await readJson(ctx.request, z.object({ archived: z.boolean() }));
	const client = ctx.db();
	await requireMembership(client, conversationId, caller.userId);
	const update = await client
		.from("conversation_members")
		.update({ archived_at: body.archived ? new Date().toISOString() : null })
		.eq("conversation_id", conversationId)
		.eq("profile_id", caller.userId);
	if (update.error)
		throw dbFailure(update.error, "That did not save. Please try again.");
	return { archived: body.archived };
}
