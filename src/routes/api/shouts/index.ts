import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	cleanText,
	isDuplicateError,
	methodNotAllowed,
	publicProfile,
	publicProfileSelection,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "@/lib/api-helpers";
import {
	promotionFailureStatus,
	recordPromotionImpressions,
	startPromotion,
} from "@/lib/promotion.server";
import { nextFeedCursor, readFeedPage } from "@/lib/routing/feed";
import { ApiError, json, jsonError, withSecurity } from "@/middleware";
import { entityPromotions, shoutLikes, shouts, users } from "@/schema";

/**
 * `GET/POST /api/shouts` — the public shouts feed.
 *
 * `public.shouts` and `public.shout_likes` have existed since 0010; nothing read
 * them. Two rules from 0019 shape the handler:
 *
 *   - `shouts.likes_count` is derived from `shout_likes` by a trigger and a direct
 *     write raises, so liking inserts the edge and the count is read back;
 *   - the edge is unique per (shout, member), so a double-tap is `onConflictDoNothing`
 *     and an unlike is a delete, never an increment that could drift.
 *
 * A shout is text, media, or both; the feed is public because that is what a shout
 * is, but the author's card goes through `publicProfile()`, which honours
 * `hide_online` and `hide_last_online` — publishing presence on a public surface is
 * how a privacy switch stops meaning anything.
 */

const MAX_CONTENT = 500;

const actionSchema = z.discriminatedUnion("action", [
	z
		.object({
			action: z.literal("create"),
			content: z.string().max(MAX_CONTENT).optional(),
			mediaUrl: z.string().url().max(2048).optional(),
		})
		.strict()
		.refine((v) => Boolean(cleanText(v.content, MAX_CONTENT)) || v.mediaUrl, {
			message: "A shout needs text, media, or both",
		}),
	z.object({ action: z.literal("like"), shoutId: z.uuid() }).strict(),
	z.object({ action: z.literal("unlike"), shoutId: z.uuid() }).strict(),
	z
		.object({
			action: z.literal("boost"),
			shoutId: z.uuid(),
			minutes: z.number().int().min(30).max(720).optional(),
			idempotencyKey: z.string().max(120).optional(),
		})
		.strict(),
	z.object({ action: z.literal("delete"), shoutId: z.uuid() }).strict(),
]);

/** Live promotion for one shout, as a scalar subquery usable in ORDER BY. */
function livePromotionEnds(entityId: typeof shouts.id) {
	return db
		.select({ endsAt: entityPromotions.endsAt })
		.from(entityPromotions)
		.where(
			and(
				eq(entityPromotions.entityType, "shout"),
				eq(entityPromotions.entityId, entityId),
				gt(entityPromotions.endsAt, new Date()),
			),
		)
		.limit(1);
}

export const Route = createFileRoute("/api/shouts/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ request, caller }) => {
					try {
						const url = new URL(request.url);
						const { limit, before } = readFeedPage(url);
						const mine = url.searchParams.get("mine") === "1";

						const conditions = [];
						if (before) conditions.push(sql`${shouts.createdAt} < ${before}`);
						// `#/routes/shouts/$shoutId` renders one shout. Parsed as a uuid so a
						// malformed link answers with an empty page instead of a driver error.
						const onlyId = z.uuid().safeParse(
							url.searchParams.get("id") ?? "",
						);
						if (onlyId.success) conditions.push(eq(shouts.id, onlyId.data));
						if (mine) {
							if (!caller) return jsonError("Sign in first", 401);
							conditions.push(eq(shouts.userId, caller.id));
						}

						const rows = await db
							.select({
								id: shouts.id,
								content: shouts.content,
								mediaUrl: shouts.mediaUrl,
								likesCount: shouts.likesCount,
								createdAt: shouts.createdAt,
								authorId: shouts.userId,
								promotedUntil: sql<Date | null>`${livePromotionEnds(shouts.id)}`,
								// A left join, not an `exists` subquery with a placeholder uuid:
								// an anonymous reader has no id to compare, and a made-up one
								// would be a value the database has to reason about.
								likedByMe: sql<boolean | null>`${shoutLikes.id} is not null`,
								author: publicProfileSelection,
							})
							.from(shouts)
							.innerJoin(users, eq(users.id, shouts.userId))
							.leftJoin(
								shoutLikes,
								and(
									eq(shoutLikes.shoutId, shouts.id),
									caller ? eq(shoutLikes.userId, caller.id) : sql`false`,
								),
							)
							.where(conditions.length > 0 ? and(...conditions) : undefined)
							.orderBy(
								sql`(${livePromotionEnds(shouts.id)}) is null`,
								desc(shouts.createdAt),
							)
							.limit(limit);

						const promoted = rows
							.filter((r) => r.promotedUntil !== null)
							.map((r) => r.id);
						if (promoted.length > 0)
							await recordPromotionImpressions("shout", promoted);

						return json({
							items: rows.map((row) => ({
								id: row.id,
								content: row.content,
								mediaUrl: row.mediaUrl,
								likesCount: Number(row.likesCount ?? 0),
								createdAt: row.createdAt?.toISOString() ?? null,
								likedByMe: Boolean(row.likedByMe),
								promotedUntil: row.promotedUntil?.toISOString() ?? null,
								mine: caller ? row.authorId === caller.id : false,
								author: publicProfile(row.author),
							})),
							nextCursor: nextFeedCursor(rows, limit),
							limit,
						});
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("shouts/list", error);
					}
				},
				{
					auth: "optional",
					rateLimit: {
						limit: 60,
						key: ({ caller, ip }) => `shouts:list:${caller?.id ?? ip}`,
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
								const content = cleanText(body.content, MAX_CONTENT);
								const [row] = await db
									.insert(shouts)
									.values({
										userId: user.id,
										// `content` is NOT NULL with no length CHECK, so a media-only
										// shout is an empty string rather than a rejected row.
										content,
										mediaUrl: body.mediaUrl ?? null,
									})
									.returning({
										id: shouts.id,
										content: shouts.content,
										mediaUrl: shouts.mediaUrl,
										likesCount: shouts.likesCount,
										createdAt: shouts.createdAt,
									});
								const [author] = await db
									.select(publicProfileSelection)
									.from(users)
									.where(eq(users.id, user.id))
									.limit(1);
								return json(
									{
										ok: true,
										shout: {
											id: row.id,
											content: row.content,
											mediaUrl: row.mediaUrl,
											likesCount: Number(row.likesCount ?? 0),
											createdAt: row.createdAt?.toISOString() ?? null,
											likedByMe: false,
											promotedUntil: null,
											mine: true,
											author: publicProfile(author),
										},
									},
									{ status: 201 },
								);
							}

							case "like":
							case "unlike": {
								const liked = body.action === "like";
								const outcome = await db.transaction(async (tx) => {
									const [shout] = await tx
										.select({ id: shouts.id })
										.from(shouts)
										.where(eq(shouts.id, body.shoutId))
										.limit(1);
									if (!shout) return { missing: true } as const;

									if (liked) {
										await tx
											.insert(shoutLikes)
											.values({ shoutId: shout.id, userId: user.id })
											.onConflictDoNothing();
									} else {
										await tx
											.delete(shoutLikes)
											.where(
												and(
													eq(shoutLikes.shoutId, shout.id),
													eq(shoutLikes.userId, user.id),
												),
											);
									}

									// Read back, never computed: `likes_count` is derived from
									// `shout_likes` by a 0019 trigger.
									const [countRow] = await tx
										.select({ n: shouts.likesCount })
										.from(shouts)
										.where(eq(shouts.id, shout.id))
										.limit(1);
									return { likesCount: Number(countRow?.n ?? 0) } as const;
								});

								if ("missing" in outcome)
									return jsonError("That shout no longer exists", 404);
								return json({ ok: true, liked, ...outcome });
							}

							case "boost": {
								const [shout] = await db
									.select({ id: shouts.id, userId: shouts.userId })
									.from(shouts)
									.where(eq(shouts.id, body.shoutId))
									.limit(1);
								if (!shout)
									return jsonError("That shout no longer exists", 404);
								if (shout.userId !== user.id)
									return jsonError("You can only boost your own shout", 403);

								const outcome = await db.transaction((tx) =>
									startPromotion(
										{
											userId: user.id,
											entityType: "shout",
											entityId: shout.id,
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
									.delete(shouts)
									.where(
										and(
											eq(shouts.id, body.shoutId),
											eq(shouts.userId, user.id),
										),
									)
									.returning({ id: shouts.id });
								if (!deleted)
									return jsonError(
										"That shout does not exist, or it is not yours",
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
								"Somebody promoted this shout a moment ago. Try again.",
								409,
							);
						if (isDuplicateError(error))
							return jsonError("You already liked that shout", 409);
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("shouts/action", error);
					}
				},
				{
					auth: "required",
					maxBodySize: 8 * 1024,
					rateLimit: {
						// A feed that can be spammed is a feed nobody reads.
						limit: 30,
						key: ({ caller }) => `shouts:write:${caller?.id ?? "anon"}`,
					},
				},
			),

			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),
		},
	},
});
