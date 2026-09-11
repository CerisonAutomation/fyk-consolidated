import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "#/db";
import { moderateContent } from "#/domains/ai/heuristic";
import { cleanText, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { conversationMembers, conversations, messages } from "#/schema";

/**
 * `GET|POST /api/conversations/{conversationId}/messages`
 *
 * The chat screen already polled and posted here; without the route, opening a
 * conversation rendered an empty thread and sending a message failed with a
 * `404` — while the optimistic UI in `chat-view` made it *look* sent. That is
 * the worst possible failure mode for a messaging product, so this file is the
 * whole point of the endpoint set.
 *
 * Rules:
 *   - **Membership first, always.** Every statement is scoped by an
 *     `conversation_members` row for the caller; a guessed conversation id
 *     yields `404`, never somebody else's chat history.
 *   - Recalled (`unsent_at`) rows are excluded on read, and `expires_at` rows
 *     past their lifetime are excluded too, so a disappeared photo cannot be
 *     recovered by reloading the page.
 *   - The 4000-char body cap mirrors the database `CHECK`, and `chat-view`'s
 *     moderation notice comes from the same local heuristic the safety team's
 *     tests cover — no provider call on the send path.
 *   - `ephemeral` is honoured as `expires_at = now + n seconds` server-side;
 *     the client never decides how long its own messages survive.
 */
const PAGE_SIZE = 50;
const MAX_BODY_CHARS = 4000;

const sendSchema = z.object({
	content: z.string().trim().max(MAX_BODY_CHARS).optional(),
	mediaUrl: z.string().url().max(2048).optional(),
	storagePath: z.string().max(1024).optional(),
	replyToId: z.uuid().optional(),
	ephemeral: z.coerce
		.number()
		.int()
		.min(0)
		.max(60 * 60 * 24)
		.optional(),
});

/** `withSecurity` gives handlers `{request, caller, ip}`, so read the segment here. */
function conversationIdFrom(url: URL): string | null {
	const parts = url.pathname.split("/").filter(Boolean);
	const index = parts.indexOf("messages");
	const candidate = index > 0 ? parts[index - 1] : "";
	return z.uuid().safeParse(candidate).success ? candidate : null;
}

export const Route = createFileRoute(
	"/api/conversations/$conversationId/messages/",
)({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const url = new URL(request.url);
					const conversationId = conversationIdFrom(url);
					if (!conversationId) return jsonError("Unknown conversation", 404);
					if (!(await isMember(user.id, conversationId))) {
						return jsonError("Conversation not found", 404);
					}

					const before = url.searchParams.get("before");
					const beforeDate = before ? new Date(before) : null;

					const rows = await db
						.select({
							id: messages.id,
							conversationId: messages.conversationId,
							senderId: messages.senderId,
							type: messages.type,
							body: messages.body,
							storagePath: messages.storagePath,
							replyToId: messages.replyToId,
							expiresAt: messages.expiresAt,
							editedAt: messages.editedAt,
							createdAt: messages.createdAt,
						})
						.from(messages)
						.where(
							and(
								eq(messages.conversationId, conversationId),
								isNull(messages.unsentAt),
								// A row that has outlived its ephemeral window is gone for
								// everyone, not "hidden until refresh".
								sql`(${messages.expiresAt} is null or ${messages.expiresAt} > now())`,
								beforeDate && !Number.isNaN(beforeDate.getTime())
									? sql`${messages.createdAt} < ${beforeDate.toISOString()}`
									: undefined,
							),
						)
						.orderBy(desc(messages.createdAt), desc(messages.id))
						.limit(PAGE_SIZE + 1);

					const hasMore = rows.length > PAGE_SIZE;
					const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

					return json(
						{
							messages: page.reverse().map((row) => ({
								id: row.id,
								conversation_id: row.conversationId,
								sender_id: row.senderId,
								type: row.type,
								content: row.body ?? "",
								media_url: row.storagePath ?? null,
								reply_to_id: row.replyToId ?? null,
								is_edited: row.editedAt !== null,
								is_pinned: false,
								is_recalled: false,
								is_ephemeral: row.expiresAt !== null,
								ephemeral_expires_at: row.expiresAt?.toISOString() ?? null,
								created_at: (row.createdAt ?? new Date()).toISOString(),
							})),
							nextCursor: hasMore
								? (page[0]?.createdAt?.toISOString() ?? null)
								: null,
							hasMore,
						},
						{ cache: "private" },
					);
				},
				{
					rateLimit: {
						limit: 240,
						key: ({ caller }) => `messages:GET:${caller?.id ?? "anon"}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const url = new URL(request.url);
					const conversationId = conversationIdFrom(url);
					if (!conversationId) return jsonError("Unknown conversation", 404);
					const body = await readJson(request, sendSchema, 32 * 1024);

					const content = body.content
						? cleanText(body.content, MAX_BODY_CHARS)
						: "";
					if (!content && !body.mediaUrl && !body.storagePath) {
						return jsonError("Write a message or attach media", 400);
					}
					if (!(await isMember(user.id, conversationId))) {
						return jsonError("Conversation not found", 404);
					}

					const moderation = content ? await moderateContent(content) : null;
					const now = new Date();
					const created = await db.transaction(async (tx) => {
						const [row] = await tx
							.insert(messages)
							.values({
								conversationId,
								senderId: user.id,
								type: content ? "text" : "image",
								body: content || null,
								storagePath: body.storagePath ?? null,
								replyToId: body.replyToId ?? null,
								expiresAt: body.ephemeral
									? new Date(now.getTime() + body.ephemeral * 1000)
									: null,
								createdAt: now,
							})
							.returning({ id: messages.id, createdAt: messages.createdAt });
						await tx
							.update(conversations)
							.set({ lastMessageAt: now })
							.where(eq(conversations.id, conversationId));
						return row;
					});

					return json(
						{
							ok: true,
							message: {
								id: created.id,
								created_at: (created.createdAt ?? now).toISOString(),
							},
							moderation,
						},
						{ status: 201, cache: "private" },
					);
				},
				{
					maxBodySize: 32 * 1024,
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `messages:POST:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});

async function isMember(
	profileId: string,
	conversationId: string,
): Promise<boolean> {
	const [row] = await db
		.select({ id: conversationMembers.conversationId })
		.from(conversationMembers)
		.where(
			and(
				eq(conversationMembers.conversationId, conversationId),
				eq(conversationMembers.profileId, profileId),
			),
		)
		.limit(1);
	return !!row;
}
