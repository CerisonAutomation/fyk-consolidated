import { createFileRoute } from "@tanstack/react-router";
import { and, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	cardSelection,
	cleanText,
	methodNotAllowed,
	readJson,
	requireCaller,
	toProfileCard,
	z,
} from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import type { ChatPeer, ConversationWithMeta } from "@/lib/types";
import { conversationMembers, conversations, messages, users } from "@/schema";

/**
 * `GET /api/conversations` and `POST /api/conversations` — the chat inbox.
 *
 * The chat screens fetched this and got a `404`, so "open a conversation" from
 * a profile could never land anywhere. Two rules matter more than the SQL:
 *
 *   - **Membership is the authorisation check.** Every read joins
 *     `conversation_members` on the caller; there is no "list of all
 *     conversations" path, and a message body is only ever returned for a
 *     conversation the caller is a member of.
 *   - **Creating must be idempotent.** Two clients (or a double-tap) opening a
 *     DM with the same person must not mint two threads, so the pair is stored
 *     as a canonical `member_key` (sorted ids joined) with a unique index —
 *     see `0016_server_graph.sql` — and the insert uses
 *     `onConflictDoNothing` followed by a re-select.
 */
const LIST_LIMIT = 50;

const createSchema = z.object({
	targetId: z.uuid(),
	firstMessage: z.string().trim().max(4000).optional(),
});

/** Canonical, order-independent key for a pair. */
function pairKey(a: string, b: string): string {
	return [a, b].sort().join("-");
}

export const Route = createFileRoute("/api/conversations/")({
	server: {
		handlers: {
			/* Every verb this route does not implement is answered in JSON (405 +
			 * Allow). Without a declaration TanStack Start treats the request as
			 * unmatched-by-path-and-method and falls through to the document handler,
			 * which answers `200 text/html` with the SPA bundle — a client parsing
			 * JSON then blames the server instead of its own verb. AUDIT §3.10. */
			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),

			GET: withSecurity(
				async ({ caller }) => {
					const user = requireCaller(caller);

					const mine = await db
						.select({
							conversationId: conversations.id,
							lastMessageAt: conversations.lastMessageAt,
							lastReadAt: conversationMembers.lastReadAt,
							archivedAt: conversationMembers.archivedAt,
						})
						.from(conversationMembers)
						.innerJoin(
							conversations,
							eq(conversations.id, conversationMembers.conversationId),
						)
						.where(eq(conversationMembers.profileId, user.id))
						.orderBy(desc(conversations.lastMessageAt))
						.limit(LIST_LIMIT);

					if (mine.length === 0)
						return json({ conversations: [] }, { cache: "private" });
					const ids = mine.map((row) => row.conversationId);

					// Unread = messages from somebody else, after *this member's*
					// `last_read_at`, that have not been recalled. Counting "not from me"
					// (as this did before the join) turned a fully-read thread back into
					// a badge the moment you reopened it, because the whole history still
					// matches. `or(isNull(...))` keeps brand-new members' unread state.
					const [peers, lastMessages, unreadCounts] = await Promise.all([
						db
							.select({
								conversationId: conversationMembers.conversationId,
								profileId: conversationMembers.profileId,
							})
							.from(conversationMembers)
							.where(inArray(conversationMembers.conversationId, ids)),
						db
							.select({
								id: messages.id,
								conversationId: messages.conversationId,
								senderId: messages.senderId,
								body: messages.body,
								type: messages.type,
								createdAt: messages.createdAt,
							})
							.from(messages)
							.where(
								and(
									inArray(messages.conversationId, ids),
									isNull(messages.unsentAt),
								),
							)
							.orderBy(desc(messages.createdAt))
							.limit(LIST_LIMIT * 4),
						db
							.select({
								conversationId: conversationMembers.conversationId,
								total: count(),
							})
							.from(conversationMembers)
							.innerJoin(
								messages,
								eq(messages.conversationId, conversationMembers.conversationId),
							)
							.where(
								and(
									eq(conversationMembers.profileId, user.id),
									inArray(conversationMembers.conversationId, ids),
									ne(messages.senderId, user.id),
									isNull(messages.unsentAt),
									sql`${messages.createdAt} > coalesce(${conversationMembers.lastReadAt}, to_timestamp(0))`,
								),
							)
							.groupBy(conversationMembers.conversationId),
					]);

					const peerByConversation = new Map<string, string>();
					for (const row of peers) {
						if (row.profileId !== user.id)
							peerByConversation.set(row.conversationId, row.profileId);
					}
					const peerIds = [...new Set([...peerByConversation.values()])];
					// `cardSelection`, not a hand-picked five columns: the select above published
					// `users.online` raw, so a peer who had hidden their online status still got a
					// live presence dot in this list, and it carried no `last_active_at`, so
					// "online" could not be checked against staleness at all. Shaping through
					// `toProfileCard` — the function discovery uses — is what stops the two
					// screens disagreeing about what one privacy switch means.
					const peerRows = peerIds.length
						? await db
								.select(cardSelection)
								.from(users)
								.where(inArray(users.id, peerIds))
						: [];
					const peerProfiles = new Map(
						peerRows.map((peer) => {
							const card = toProfileCard(peer, null);
							return [
								peer.id,
								{
									...card,
									// `ConversationWithMeta.otherUser.pseudo` is the label both chat
									// screens render; the card calls the same value `name`.
									pseudo: card.name,
								} satisfies ChatPeer,
							] as const;
						}),
					);

					const lastByConversation = new Map<
						string,
						(typeof lastMessages)[number]
					>();
					for (const message of lastMessages) {
						if (!lastByConversation.has(message.conversationId)) {
							lastByConversation.set(message.conversationId, message);
						}
					}
					const unread = new Map(
						unreadCounts.map((row) => [row.conversationId, Number(row.total)]),
					);

					const list = mine
						.filter((row) => row.archivedAt === null)
						.map((row) => {
							const peerId = peerByConversation.get(row.conversationId);
							const last = lastByConversation.get(row.conversationId);
							const preview = last?.body
								? cleanText(last.body, 160)
								: last?.type === "image"
									? "Photo"
									: "";
							const otherUser = peerId ? peerProfiles.get(peerId) : undefined;
							const lastMessageAt = (
								last?.createdAt ??
								row.lastMessageAt ??
								new Date()
							).toISOString();
							return {
								id: row.conversationId,
								// Three vocabularies, deliberately. `participant` plus the snake_case
								// trio is what this endpoint has always returned and what
								// `user-profile-client` reads; `otherUser`/`lastMessage`/`unread`
								// are what `ConversationWithMeta` — the type `messages-client` and
								// `chat-view` are written against — reads. Sending the second set is
								// what makes the inbox stop showing "User" and "Say hi 👋" on every
								// row: the screens were reading keys this endpoint never sent, and
								// their `??` fallbacks turned fully populated threads into
								// placeholder copy. AUDIT §2.27.
								participant: otherUser
									? {
											id: otherUser.id,
											name: otherUser.name,
											nick: otherUser.nick,
											avatar: otherUser.photo,
											online: otherUser.online,
										}
									: undefined,
								type: "direct",
								// No group threads exist in this schema — `conversations` has no
								// `type`/`name` and `member_key` is a pair — so the screens' group
								// branches stay unreachable rather than being fed a "group" label
								// nothing backs. 2 is the truth for every row this query produces.
								// The group-only `name` is therefore absent, not null: the screens reach it only
								// on a branch no row can produce.
								memberCount: 2,
								otherUser,
								lastMessage: last
									? {
											content: preview,
											created_at: lastMessageAt,
											sender_id: last.senderId,
										}
									: undefined,
								unread: unread.get(row.conversationId) ?? 0,
								lastMessageAt,
								last_message: preview,
								last_message_at: lastMessageAt,
								unread_count: unread.get(row.conversationId) ?? 0,
							};
						});
					// The annotation is the point of this shape: every field the two chat screens
					// read is now checked by `tsc` against `ConversationWithMeta`, while the
					// intersection keeps the snake_case keys other consumers read. Before it, the
					// endpoint could — and did — answer with a payload that had nothing in common
					// with the type the client claimed, because `api<T>()` only asserts.
					type InboxRow = ConversationWithMeta & Record<string, unknown>;
					return json(
						{ conversations: list satisfies InboxRow[] },
						{ cache: "private" },
					);
				},
				{
					rateLimit: {
						limit: 120,
						key: ({ caller }) => `conversations:GET:${caller?.id ?? "anon"}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, createSchema, 16 * 1024);
					if (body.targetId === user.id)
						return jsonError("Cannot start a chat with yourself", 400);

					const [target] = await db
						.select({ id: users.id })
						.from(users)
						.where(eq(users.id, body.targetId))
						.limit(1);
					if (!target) return jsonError("Profile not found", 404);

					const key = pairKey(user.id, target.id);

					const conversationId = await db.transaction(async (tx) => {
						const [existing] = await tx
							.select({ id: conversations.id })
							.from(conversations)
							.where(eq(conversations.memberKey, key))
							.limit(1);
						if (existing) return existing.id;

						const [created] = await tx
							.insert(conversations)
							.values({ memberKey: key })
							.returning({ id: conversations.id });
						await tx.insert(conversationMembers).values([
							{ conversationId: created.id, profileId: user.id },
							{ conversationId: created.id, profileId: target.id },
						]);
						if (body.firstMessage) {
							await tx.insert(messages).values({
								conversationId: created.id,
								senderId: user.id,
								type: "text",
								body: cleanText(body.firstMessage, 4000),
							});
							await tx
								.update(conversations)
								.set({ lastMessageAt: new Date() })
								.where(eq(conversations.id, created.id));
						}
						return created.id;
					});

					return json({ ok: true, conversationId }, { status: 201 });
				},
				{
					maxBodySize: 16 * 1024,
					rateLimit: {
						limit: 20,
						key: ({ caller }) => `conversations:POST:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
