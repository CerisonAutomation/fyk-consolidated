import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, gt, ilike, type SQL, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	cleanText,
	isDuplicateError,
	isMissingProfileError,
	methodNotAllowed,
	publicProfile,
	publicProfileSelection,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "@/lib/api-helpers";
import { promotionFailureStatus, startPromotion } from "@/lib/promotion.server";
import { nextFeedCursor, readFeedPage } from "@/lib/routing/feed";
import { ApiError, json, jsonError, withSecurity } from "@/middleware";
import {
	boardComments,
	boardPosts,
	entityPromotions,
	postJoins,
	users,
} from "@/schema";

/**
 * `GET/POST /api/board` — the public board: invites, offers, asks, photos and text.
 *
 * `board_posts` (0000) is the one table in this set whose author is `profiles.id`
 * rather than `users.id` — the auth-uid lineage — and `post_joins` follows it. A
 * Supabase uid is what `#/lib/supabase-auth.server#getCaller` returns, so the write
 * lands on the right row; a caller with no profile row gets a 409 from
 * `isMissingProfileError` instead of a raw foreign-key 500.
 *
 * THREE COUNTERS, THREE RULES
 *   - `join_count` is derived from `post_joins` by `refresh_post_join_count`
 *     (0002, re-registered 0022). Joining inserts the edge; the number is read back.
 *   - `expires_at` is NOT NULL, so a post without a chosen lifetime gets 24 hours and
 *     the list filters on it: a board of stale invites is a board nobody posts to.
 *   - `body` is CHECKed at 1..400 characters, so the schema here stops at 400 and the
 *     database never has to refuse the row.
 */

const KINDS = ["invite", "offer", "ask", "photo", "text"] as const;
const MAX_BODY = 400;
const DEFAULT_HOURS = 24;
const MAX_HOURS = 168;

const actionSchema = z.discriminatedUnion("action", [
	z
		.object({
			action: z.literal("create"),
			kind: z.enum(KINDS).optional(),
			body: z.string().min(1).max(MAX_BODY),
			city: z.string().max(80).optional(),
			area: z.string().max(80).optional(),
			spots: z.number().int().min(1).max(50).optional(),
			/** Free text in the DDL, not a uuid: activities are named, not linked. */
			activityId: z.string().max(120).optional(),
			storagePath: z.string().max(500).optional(),
			expiresInHours: z.number().int().min(1).max(MAX_HOURS).optional(),
		})
		.strict(),
	z
		.object({
			action: z.literal("comment"),
			postId: z.uuid(),
			body: z.string().min(1).max(MAX_BODY),
		})
		.strict(),
	z.object({ action: z.literal("join"), postId: z.uuid() }).strict(),
	z.object({ action: z.literal("leave"), postId: z.uuid() }).strict(),
	z
		.object({
			action: z.literal("boost"),
			postId: z.uuid(),
			minutes: z.number().int().min(30).max(720).optional(),
			idempotencyKey: z.string().max(120).optional(),
		})
		.strict(),
	z.object({ action: z.literal("delete"), postId: z.uuid() }).strict(),
]);

/** Live promotion for one post, as a scalar subquery usable in ORDER BY. */
function livePromotionEnds(entityId: typeof boardPosts.id) {
	return db
		.select({ endsAt: entityPromotions.endsAt })
		.from(entityPromotions)
		.where(
			and(
				eq(entityPromotions.entityType, "board_post"),
				eq(entityPromotions.entityId, entityId),
				gt(entityPromotions.endsAt, new Date()),
			),
		)
		.limit(1);
}

function commentCount(postId: typeof boardPosts.id) {
	return db
		.select({ n: sql<number>`count(*)::int` })
		.from(boardComments)
		.where(eq(boardComments.postId, postId));
}

export const Route = createFileRoute("/api/board/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ request, caller }) => {
					try {
						const url = new URL(request.url);
						const { limit, before } = readFeedPage(url);
						const kindParam = url.searchParams.get("kind");
						const kind = (KINDS as readonly string[]).includes(kindParam ?? "")
							? kindParam
							: null;
						const mine = url.searchParams.get("mine") === "1";
						const includeExpired = url.searchParams.get("expired") === "1";
						const postId = url.searchParams.get("postId");
						const city = cleanText(url.searchParams.get("city"), 80) ?? "";
						const q = cleanText(url.searchParams.get("q"), 80) ?? "";

						// One post with its comments: the sheet view. Comments are capped
						// because a board post is a listing, not a thread.
						if (postId) {
							const parsedPost = z.uuid().safeParse(postId);
							if (!parsedPost.success)
								return jsonError("That is not a post id", 400);
							const [post] = await db
								.select({
									id: boardPosts.id,
									authorId: boardPosts.authorId,
									kind: boardPosts.kind,
									body: boardPosts.body,
									activityId: boardPosts.activityId,
									storagePath: boardPosts.storagePath,
									city: boardPosts.city,
									area: boardPosts.area,
									spots: boardPosts.spots,
									joinCount: boardPosts.joinCount,
									expiresAt: boardPosts.expiresAt,
									createdAt: boardPosts.createdAt,
									// Nested so the post's own `id` and the author's `id` do not
									// collide in one flat select list.
									author: publicProfileSelection,
								})
								.from(boardPosts)
								.innerJoin(users, eq(users.id, boardPosts.authorId))
								.where(eq(boardPosts.id, parsedPost.data))
								.limit(1);
							if (!post) return jsonError("That post does not exist", 404);

							const comments = await db
								.select({
									id: boardComments.id,
									body: boardComments.body,
									createdAt: boardComments.createdAt,
									authorId: boardComments.authorId,
									authorName: users.displayName,
									authorHandle: users.handle,
									authorAvatar: users.avatar,
								})
								.from(boardComments)
								.leftJoin(users, eq(users.id, boardComments.authorId))
								.where(eq(boardComments.postId, post.id))
								.orderBy(boardComments.createdAt)
								.limit(100);

							const joined = caller
								? await db
										.select({ profileId: postJoins.profileId })
										.from(postJoins)
										.where(
											and(
												eq(postJoins.postId, post.id),
												eq(postJoins.profileId, caller.id),
											),
										)
										.limit(1)
								: [];

							return json({
								post: {
									id: post.id,
									kind: post.kind ?? "text",
									body: post.body,
									activityId: post.activityId,
									storagePath: post.storagePath,
									city: post.city,
									area: post.area,
									spots: post.spots,
									joinCount: Number(post.joinCount ?? 0),
									expiresAt: post.expiresAt?.toISOString() ?? null,
									createdAt: post.createdAt?.toISOString() ?? null,
									expired:
										post.expiresAt !== null &&
										post.expiresAt.getTime() < Date.now(),
									joinedByMe: joined.length > 0,
									mine: caller ? post.authorId === caller.id : false,
									author: publicProfile(post.author),
								},
								comments: comments.map((c) => ({
									id: c.id,
									body: c.body,
									createdAt: c.createdAt?.toISOString() ?? null,
									author: publicProfile({
										id: c.authorId,
										displayName: c.authorName,
										handle: c.authorHandle,
										avatar: c.authorAvatar,
										online: false,
										lastActiveAt: null,
										city: null,
										area: null,
										hideOnline: true,
										hideLastOnline: true,
									}),
								})),
							});
						}

						const now = new Date();
						const conditions = [
							// A board that shows expired invites trains people to ignore it.
							includeExpired ? undefined : gt(boardPosts.expiresAt, now),
							kind ? eq(boardPosts.kind, kind) : undefined,
							before ? sql`${boardPosts.createdAt} < ${before}` : undefined,
							city ? ilike(boardPosts.city, `%${city}%`) : undefined,
							q ? ilike(boardPosts.body, `%${q}%`) : undefined,
							mine
								? caller
									? eq(boardPosts.authorId, caller.id)
									: sql`false`
								: undefined,
						].filter((c): c is SQL => c !== undefined);

						const rows = await db
							.select({
								id: boardPosts.id,
								authorId: boardPosts.authorId,
								kind: boardPosts.kind,
								body: boardPosts.body,
								activityId: boardPosts.activityId,
								city: boardPosts.city,
								area: boardPosts.area,
								spots: boardPosts.spots,
								joinCount: boardPosts.joinCount,
								expiresAt: boardPosts.expiresAt,
								createdAt: boardPosts.createdAt,
								commentCount: sql<number>`(${commentCount(boardPosts.id)})`,
								promotedUntil: sql<Date | null>`${livePromotionEnds(boardPosts.id)}`,
								joinedByMe: caller
									? sql<boolean>`exists (select 1 from ${postJoins} where ${postJoins.postId} = ${boardPosts.id} and ${postJoins.profileId} = ${caller.id})`
									: sql<boolean>`false`,
								author: publicProfileSelection,
							})
							.from(boardPosts)
							.innerJoin(users, eq(users.id, boardPosts.authorId))
							.where(and(...conditions))
							.orderBy(
								sql`(${livePromotionEnds(boardPosts.id)}) is null`,
								desc(boardPosts.expiresAt),
								desc(boardPosts.createdAt),
							)
							.limit(limit);

						return json({
							items: rows.map((row) => ({
								id: row.id,
								kind: row.kind ?? "text",
								body: row.body,
								activityId: row.activityId,
								city: row.city,
								area: row.area,
								spots: row.spots,
								joinCount: Number(row.joinCount ?? 0),
								commentCount: Number(row.commentCount ?? 0),
								expiresAt: row.expiresAt?.toISOString() ?? null,
								createdAt: row.createdAt?.toISOString() ?? null,
								joinedByMe: Boolean(row.joinedByMe),
								promotedUntil: row.promotedUntil?.toISOString() ?? null,
								mine: caller ? row.authorId === caller.id : false,
								author: publicProfile(row.author),
							})),
							nextCursor: nextFeedCursor(rows, limit),
							limit,
							kinds: KINDS,
						});
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("board/list", error);
					}
				},
				{
					auth: "optional",
					rateLimit: {
						limit: 60,
						key: ({ caller, ip }) => `board:list:${caller?.id ?? ip}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					try {
						const body = await readJson(request, actionSchema, 8 * 1024);

						switch (body.action) {
							case "create": {
								const text = cleanText(body.body, MAX_BODY);
								if (!text) return jsonError("A post needs some text", 400);
								if ((body.kind ?? "text") === "photo" && !body.storagePath)
									return jsonError("A photo post needs a storagePath", 400);
								if (body.spots !== undefined && body.kind !== "invite")
									return jsonError("Only an invite has places", 400);

								const hours = Math.min(
									Math.max(body.expiresInHours ?? DEFAULT_HOURS, 1),
									MAX_HOURS,
								);
								try {
									const [post] = await db
										.insert(boardPosts)
										.values({
											authorId: user.id,
											kind: body.kind ?? "text",
											body: text,
											activityId: cleanText(body.activityId, 120) || null,
											storagePath: body.storagePath ?? null,
											city: cleanText(body.city, 80) || null,
											area: cleanText(body.area, 80) || null,
											spots: body.spots ?? null,
											expiresAt: new Date(Date.now() + hours * 3_600_000),
										})
										.returning({
											id: boardPosts.id,
											kind: boardPosts.kind,
											body: boardPosts.body,
											expiresAt: boardPosts.expiresAt,
											createdAt: boardPosts.createdAt,
											joinCount: boardPosts.joinCount,
										});
									return json(
										{
											ok: true,
											post: {
												...post,
												kind: post.kind ?? "text",
												joinCount: Number(post.joinCount ?? 0),
												expiresAt: post.expiresAt?.toISOString() ?? null,
												createdAt: post.createdAt?.toISOString() ?? null,
												commentCount: 0,
												joinedByMe: false,
												promotedUntil: null,
												mine: true,
											},
										},
										{ status: 201 },
									);
								} catch (error) {
									// `author_id` references `profiles(id)`: a brand-new auth user
									// with no profile row cannot post, and that is a 409 with an
									// instruction, not a foreign-key 500.
									if (isMissingProfileError(error))
										return jsonError(
											"Finish your profile before posting to the board",
											409,
										);
									throw error;
								}
							}

							case "comment": {
								const text = cleanText(body.body, MAX_BODY);
								if (!text) return jsonError("A comment needs some text", 400);
								const [post] = await db
									.select({
										id: boardPosts.id,
										expiresAt: boardPosts.expiresAt,
									})
									.from(boardPosts)
									.where(eq(boardPosts.id, body.postId))
									.limit(1);
								if (!post) return jsonError("That post does not exist", 404);
								if (post.expiresAt && post.expiresAt.getTime() < Date.now())
									return jsonError("That post has expired", 410);

								try {
									const [comment] = await db
										.insert(boardComments)
										.values({ postId: post.id, authorId: user.id, body: text })
										.returning({
											id: boardComments.id,
											body: boardComments.body,
											createdAt: boardComments.createdAt,
										});
									return json(
										{
											ok: true,
											comment: {
												id: comment.id,
												body: comment.body,
												createdAt: comment.createdAt?.toISOString() ?? null,
											},
										},
										{ status: 201 },
									);
								} catch (error) {
									if (isMissingProfileError(error))
										return jsonError(
											"Finish your profile before commenting",
											409,
										);
									throw error;
								}
							}

							case "join":
							case "leave": {
								const joining = body.action === "join";
								const outcome = await db.transaction(async (tx) => {
									const [post] = await tx
										.select({
											id: boardPosts.id,
											spots: boardPosts.spots,
											expiresAt: boardPosts.expiresAt,
										})
										.from(boardPosts)
										.where(eq(boardPosts.id, body.postId))
										.limit(1);
									if (!post) return { missing: true } as const;
									if (post.expiresAt && post.expiresAt.getTime() < Date.now())
										return { expired: true } as const;

									const joins = await tx
										.select({ profileId: postJoins.profileId })
										.from(postJoins)
										.where(eq(postJoins.postId, post.id));
									const already = joins.some((j) => j.profileId === user.id);

									if (joining) {
										if (already) return { already: true } as const;
										// `spots` is the host's own limit; honouring it in the same
										// transaction as the read is the only way "2 places left"
										// means two.
										if (post.spots !== null && joins.length >= post.spots)
											return { full: true } as const;
										await tx
											.insert(postJoins)
											.values({ postId: post.id, profileId: user.id })
											.onConflictDoNothing();
									} else {
										if (!already) return { notJoined: true } as const;
										await tx
											.delete(postJoins)
											.where(
												and(
													eq(postJoins.postId, post.id),
													eq(postJoins.profileId, user.id),
												),
											);
									}

									// Derived from the edge (0002/0022): read back, never written.
									const [countRow] = await tx
										.select({ n: boardPosts.joinCount })
										.from(boardPosts)
										.where(eq(boardPosts.id, post.id))
										.limit(1);
									return {
										joined: joining,
										joinCount: Number(countRow?.n ?? 0),
										spots: post.spots,
									} as const;
								});

								if ("missing" in outcome)
									return jsonError("That post does not exist", 404);
								if ("expired" in outcome)
									return jsonError("That post has expired", 410);
								if ("already" in outcome)
									return jsonError("You are already going", 409);
								if ("notJoined" in outcome)
									return jsonError("You are not on that post", 404);
								if ("full" in outcome)
									return jsonError("That post is full", 409);
								return json({ ok: true, ...outcome });
							}

							case "boost": {
								const [post] = await db
									.select({ id: boardPosts.id, authorId: boardPosts.authorId })
									.from(boardPosts)
									.where(eq(boardPosts.id, body.postId))
									.limit(1);
								if (!post) return jsonError("That post does not exist", 404);
								if (post.authorId !== user.id)
									return jsonError("You can only boost your own post", 403);

								const outcome = await db.transaction((tx) =>
									startPromotion(
										{
											userId: user.id,
											entityType: "board_post",
											entityId: post.id,
											minutes: body.minutes,
											idempotencyKey: body.idempotencyKey,
										},
										tx,
									),
								);
								if (outcome.kind === "insufficient")
									return jsonError(
										`That costs ${outcome.cost} bones and the wallet holds ${outcome.balance}`,
										402,
									);
								if (outcome.kind === "held")
									return jsonError(
										`Already promoted until ${outcome.endsAt.toISOString()}`,
										409,
									);
								if (outcome.kind === "duplicate")
									return json({
										ok: true,
										duplicate: true,
										note: "That boost was already applied.",
									});
								return json({ ok: true, ...outcome });
							}

							case "delete": {
								const [deleted] = await db
									.delete(boardPosts)
									.where(
										and(
											eq(boardPosts.id, body.postId),
											eq(boardPosts.authorId, user.id),
										),
									)
									.returning({ id: boardPosts.id });
								if (!deleted)
									return jsonError(
										"That post does not exist, or it is not yours",
										404,
									);
								return json({ ok: true, deleted: deleted.id });
							}
						}
					} catch (error) {
						const status = promotionFailureStatus(error);
						if (status === 402)
							return jsonError("Not enough bones for that boost", 402);
						if (status === 409)
							return jsonError(
								"Somebody promoted this post a moment ago. Try again.",
								409,
							);
						if (isDuplicateError(error))
							return jsonError("You are already going", 409);
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("board/action", error);
					}
				},
				{
					auth: "required",
					maxBodySize: 8 * 1024,
					rateLimit: {
						// Board spam is the failure mode that empties a board, so the write
						// budget is tighter than the read budget.
						limit: 20,
						key: ({ caller }) => `board:write:${caller?.id ?? "anon"}`,
					},
				},
			),

			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),
		},
	},
});
