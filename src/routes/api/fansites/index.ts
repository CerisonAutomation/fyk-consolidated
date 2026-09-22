import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, gt, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	cleanText,
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
	entityPromotions,
	fansiteSubscribers,
	fansites,
	users,
} from "@/schema";

/**
 * `GET/POST /api/fansites` — the fansite list, and the creator's own CRUD.
 *
 * Following and unfollowing stay where they are: `POST /api/fansites/subscribe`
 * writes the `fansite_subscribers` edge and the notification the creator receives.
 * This route is the list that edge feeds, plus the create/edit/delete/boost a
 * creator needs — none of which existed, so `/fansites` rendered an empty grid from
 * an HTML 404.
 *
 * `subscriber_count` is derived from the edge by a 0019 trigger and a direct write
 * raises, so it is read back here and never incremented.
 */

const actionSchema = z.discriminatedUnion("action", [
	z
		.object({
			action: z.literal("create"),
			name: z.string().min(3).max(80),
			description: z.string().max(500).optional(),
			coverUrl: z.string().url().max(2048).optional(),
		})
		.strict(),
	z
		.object({
			action: z.literal("update"),
			fansiteId: z.uuid(),
			name: z.string().min(3).max(80).optional(),
			description: z.string().max(500).nullish(),
			coverUrl: z.string().url().max(2048).nullish(),
		})
		.strict(),
	z.object({ action: z.literal("delete"), fansiteId: z.uuid() }).strict(),
	z
		.object({
			action: z.literal("boost"),
			fansiteId: z.uuid(),
			minutes: z.number().int().min(30).max(720).optional(),
			idempotencyKey: z.string().max(120).optional(),
		})
		.strict(),
]);

/** Live promotion for one fansite, as a scalar subquery usable in ORDER BY. */
function livePromotionEnds(entityId: typeof fansites.id) {
	return db
		.select({ endsAt: entityPromotions.endsAt })
		.from(entityPromotions)
		.where(
			and(
				eq(entityPromotions.entityType, "fansite"),
				eq(entityPromotions.entityId, entityId),
				gt(entityPromotions.endsAt, new Date()),
			),
		)
		.limit(1);
}

export const Route = createFileRoute("/api/fansites/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ request, caller }) => {
					try {
						const url = new URL(request.url);
						const { limit, before } = readFeedPage(url);
						const q = cleanText(url.searchParams.get("q"), 80) ?? "";
						const mine = url.searchParams.get("mine") === "1";
						const subscribedOnly = url.searchParams.get("subscribed") === "1";

						const conditions = [];
						if (before) conditions.push(sql`${fansites.createdAt} < ${before}`);
						if (q)
							conditions.push(
								or(
									ilike(fansites.name, `%${q}%`),
									ilike(fansites.description, `%${q}%`),
								),
							);
						if (mine) {
							if (!caller) return jsonError("Sign in first", 401);
							conditions.push(eq(fansites.userId, caller.id));
						}
						if (subscribedOnly) {
							if (!caller) return jsonError("Sign in first", 401);
							conditions.push(
								sql`exists (select 1 from ${fansiteSubscribers} where ${fansiteSubscribers.fansiteId} = ${fansites.id} and ${fansiteSubscribers.userId} = ${caller.id})`,
							);
						}

						const rows = await db
							.select({
								id: fansites.id,
								name: fansites.name,
								description: fansites.description,
								coverUrl: fansites.coverUrl,
								subscriberCount: fansites.subscriberCount,
								createdAt: fansites.createdAt,
								ownerId: fansites.userId,
								promotedUntil: sql<Date | null>`${livePromotionEnds(fansites.id)}`,
								subscribedByMe: caller
									? sql<boolean>`exists (select 1 from ${fansiteSubscribers} where ${fansiteSubscribers.fansiteId} = ${fansites.id} and ${fansiteSubscribers.userId} = ${caller.id})`
									: sql<boolean>`false`,
								// Nested so the site's `id` and the owner's `id` stay distinct.
								owner: publicProfileSelection,
							})
							.from(fansites)
							.innerJoin(users, eq(users.id, fansites.userId))
							.where(conditions.length > 0 ? and(...conditions) : undefined)
							.orderBy(
								sql`(${livePromotionEnds(fansites.id)}) is null`,
								desc(sql`coalesce(${fansites.subscriberCount}, 0)`),
								desc(fansites.createdAt),
							)
							.limit(limit);

						return json({
							items: rows.map((row) => ({
								id: row.id,
								name: row.name,
								description: row.description,
								coverUrl: row.coverUrl,
								subscriberCount: Number(row.subscriberCount ?? 0),
								createdAt: row.createdAt?.toISOString() ?? null,
								promotedUntil: row.promotedUntil?.toISOString() ?? null,
								subscribedByMe: Boolean(row.subscribedByMe),
								mine: caller ? row.ownerId === caller.id : false,
								owner: publicProfile(row.owner),
							})),
							nextCursor: nextFeedCursor(rows, limit),
							limit,
							// Following is a separate canonical route, so the screen does not
							// have to guess which of the two owns the write.
							subscribeRoute: "/api/fansites/subscribe",
						});
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("fansites/list", error);
					}
				},
				{
					auth: "optional",
					rateLimit: {
						limit: 60,
						key: ({ caller, ip }) => `fansites:list:${caller?.id ?? ip}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					try {
						const body = await readJson(request, actionSchema, 8 * 1024);

						if (body.action === "create") {
							const name = cleanText(body.name, 80);
							if (name.length < 3)
								return jsonError(
									"A fansite name needs at least 3 characters",
									400,
								);

							// One fansite per account: a grid of six near-identical sites from
							// one member is spam with extra steps, and the list is ranked by
							// subscribers, so a second site would only split their own.
							const [existing] = await db
								.select({ id: fansites.id })
								.from(fansites)
								.where(eq(fansites.userId, user.id))
								.limit(1);
							if (existing)
								return jsonError(
									"You already have a fansite — edit it instead",
									409,
								);

							const [created] = await db
								.insert(fansites)
								.values({
									userId: user.id,
									name,
									description: cleanText(body.description, 500) || null,
									coverUrl: body.coverUrl ?? null,
								})
								.returning({
									id: fansites.id,
									name: fansites.name,
									description: fansites.description,
									coverUrl: fansites.coverUrl,
									subscriberCount: fansites.subscriberCount,
									createdAt: fansites.createdAt,
								});
							return json(
								{
									ok: true,
									fansite: {
										...created,
										subscriberCount: Number(created.subscriberCount ?? 0),
										createdAt: created.createdAt?.toISOString() ?? null,
										promotedUntil: null,
										subscribedByMe: false,
										mine: true,
									},
								},
								{ status: 201 },
							);
						}

						// Every remaining action is on one site, and only its owner may take it.
						const [site] = await db
							.select({ id: fansites.id, userId: fansites.userId })
							.from(fansites)
							.where(eq(fansites.id, body.fansiteId))
							.limit(1);
						if (!site) return jsonError("That fansite does not exist", 404);
						if (site.userId !== user.id)
							return jsonError("That is not your fansite", 403);

						switch (body.action) {
							case "update": {
								const patch: Partial<{
									name: string;
									description: string | null;
									coverUrl: string | null;
								}> = {};
								if (body.name !== undefined) {
									const name = cleanText(body.name, 80);
									if (name.length < 3)
										return jsonError(
											"A fansite name needs at least 3 characters",
											400,
										);
									patch.name = name;
								}
								if (body.description !== undefined)
									patch.description =
										cleanText(body.description ?? "", 500) || null;
								if (body.coverUrl !== undefined)
									patch.coverUrl = body.coverUrl ?? null;
								if (Object.keys(patch).length === 0)
									return jsonError("Nothing to update", 400);

								const [updated] = await db
									.update(fansites)
									.set(patch)
									.where(eq(fansites.id, site.id))
									.returning({
										id: fansites.id,
										name: fansites.name,
										description: fansites.description,
										coverUrl: fansites.coverUrl,
										subscriberCount: fansites.subscriberCount,
									});
								return json({
									ok: true,
									fansite: {
										...updated,
										subscriberCount: Number(updated.subscriberCount ?? 0),
									},
								});
							}

							case "delete": {
								// Subscriptions and promotions cascade from the site row.
								await db.delete(fansites).where(eq(fansites.id, site.id));
								return json({ ok: true, deleted: site.id });
							}

							case "boost": {
								const outcome = await db.transaction((tx) =>
									startPromotion(
										{
											userId: user.id,
											entityType: "fansite",
											entityId: site.id,
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
						}
					} catch (error) {
						const status = promotionFailureStatus(error);
						if (status === 402)
							return jsonError("Not enough bones for that boost", 402);
						if (status === 409)
							return jsonError(
								"Somebody promoted this fansite a moment ago. Try again.",
								409,
							);
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("fansites/action", error);
					}
				},
				{
					auth: "required",
					maxBodySize: 8 * 1024,
					rateLimit: {
						limit: 30,
						key: ({ caller }) => `fansites:write:${caller?.id ?? "anon"}`,
					},
				},
			),

			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),
		},
	},
});
