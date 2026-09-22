import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, gt, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	asStringArray,
	cleanText,
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "@/lib/api-helpers";
import { promotionFailureStatus, startPromotion } from "@/lib/promotion.server";
import { normaliseTribeTokens } from "@/lib/tribes.server";
import { ApiError, json, jsonError, withSecurity } from "@/middleware";
import { entityPromotions, tribes, users } from "@/schema";

/**
 * `GET/POST /api/tribes` — the interest catalogue, and the caller's membership of it.
 *
 * Membership is not an edge table: it is `users.tribes`, a jsonb array with a GIN
 * index (0010), because `#/lib/compatibility.ts` scores two people by intersecting
 * those arrays and the discover filters use `@>` on them. `tribes.member_count` is
 * derived from that column by the `tribes_recount` trigger (0019 §7), so this route
 * writes the array and reads the counter back — writing the counter raises.
 *
 * Names are resolved through `#/lib/tribes.server#normaliseTribeTokens` before they
 * are stored. That is the 0022 fix: `hiking`, ` HIKING ` and `Hiking` used to be three
 * memberships of one tribe, and the third of them was invisible to the count trigger
 * and to every overlap score.
 */

const MAX_TRIBES = 24;

const actionSchema = z.discriminatedUnion("action", [
	z
		.object({ action: z.literal("join"), name: z.string().min(1).max(60) })
		.strict(),
	z
		.object({ action: z.literal("leave"), name: z.string().min(1).max(60) })
		.strict(),
	z
		.object({
			action: z.literal("boost"),
			tribeId: z.uuid(),
			minutes: z.number().int().min(30).max(720).optional(),
			idempotencyKey: z.string().max(120).optional(),
		})
		.strict(),
]);

/** Live promotion for one tribe, as a scalar subquery usable in ORDER BY. */
function livePromotionEnds(entityId: typeof tribes.id) {
	return db
		.select({ endsAt: entityPromotions.endsAt })
		.from(entityPromotions)
		.where(
			and(
				eq(entityPromotions.entityType, "tribe"),
				eq(entityPromotions.entityId, entityId),
				gt(entityPromotions.endsAt, new Date()),
			),
		)
		.limit(1);
}

async function myTribeNames(userId: string): Promise<string[]> {
	const [row] = await db
		.select({ tribes: users.tribes })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	return asStringArray(row?.tribes);
}

export const Route = createFileRoute("/api/tribes/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ request, caller }) => {
					try {
						const url = new URL(request.url);
						const q = cleanText(url.searchParams.get("q"), 60) ?? "";
						const joinedOnly = url.searchParams.get("joined") === "1";

						const mine = caller ? await myTribeNames(caller.id) : [];
						const mineLower = new Set(mine.map((n) => n.toLowerCase()));

						const conditions = [];
						if (q)
							conditions.push(
								or(
									ilike(tribes.name, `%${q}%`),
									ilike(tribes.description, `%${q}%`),
								),
							);

						const rows = await db
							.select({
								id: tribes.id,
								name: tribes.name,
								description: tribes.description,
								icon: tribes.icon,
								memberCount: tribes.memberCount,
								promotedUntil: sql<Date | null>`${livePromotionEnds(tribes.id)}`,
							})
							.from(tribes)
							.where(conditions.length > 0 ? and(...conditions) : undefined)
							.orderBy(
								sql`(${livePromotionEnds(tribes.id)}) is null`,
								desc(sql`coalesce(${tribes.memberCount}, 0)`),
								sql`${tribes.name}`,
							)
							.limit(200);

						const items = rows
							.map((row) => ({
								id: row.id,
								name: row.name,
								description: row.description,
								icon: row.icon,
								memberCount: Number(row.memberCount ?? 0),
								promotedUntil: row.promotedUntil?.toISOString() ?? null,
								joined: mineLower.has((row.name ?? "").toLowerCase()),
							}))
							.filter((item) => (joinedOnly ? item.joined : true));

						return json({
							items,
							joined: items.filter((i) => i.joined).map((i) => i.name),
							limit: MAX_TRIBES,
							unresolved: mine.filter(
								// 0022 keeps tokens it cannot resolve rather than emptying part of
								// someone's profile; the screen shows them as inert chips.
								(name) =>
									!rows.some(
										(row) => row.name?.toLowerCase() === name.toLowerCase(),
									),
							),
						});
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("tribes/list", error);
					}
				},
				{
					auth: "optional",
					rateLimit: {
						limit: 60,
						key: ({ caller, ip }) => `tribes:list:${caller?.id ?? ip}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					try {
						const body = await readJson(request, actionSchema, 4 * 1024);

						if (body.action === "boost") {
							// A tribe has no owner, so any member may buy it visibility; the
							// spend is theirs and it is recorded against their account.
							const [tribe] = await db
								.select({ id: tribes.id, name: tribes.name })
								.from(tribes)
								.where(eq(tribes.id, body.tribeId))
								.limit(1);
							if (!tribe) return jsonError("That tribe does not exist", 404);
							const mine = await myTribeNames(user.id);
							if (
								!mine.some(
									(n) => n.toLowerCase() === (tribe.name ?? "").toLowerCase(),
								)
							)
								return jsonError(
									"Join a tribe before putting it at the top of the list",
									403,
								);

							const outcome = await db.transaction((tx) =>
								startPromotion(
									{
										userId: user.id,
										entityType: "tribe",
										entityId: tribe.id,
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

						const wanted = cleanText(body.name, 60);
						const [catalogue] = await db
							.select({ id: tribes.id, name: tribes.name })
							.from(tribes)
							.where(sql`lower(${tribes.name}) = lower(${wanted})`)
							.limit(1);
						if (!catalogue?.name)
							return jsonError(`There is no tribe called "${wanted}"`, 404);

						const current = await myTribeNames(user.id);
						const joining = body.action === "join";
						const next = joining
							? [...current, catalogue.name]
							: current.filter(
									(n) => n.toLowerCase() !== catalogue.name.toLowerCase(),
								);

						if (joining && current.length >= MAX_TRIBES)
							return jsonError(
								`That is the limit — ${MAX_TRIBES} tribes. Leave one first.`,
								409,
							);
						if (!joining && next.length === current.length)
							return jsonError("You are not in that tribe", 404);

						// Resolved onto catalogue spelling before the write, so the recount
						// trigger and `tagOverlap` see the same token the catalogue has.
						const tokens = await normaliseTribeTokens(db, next);

						const [updated] = await db
							.update(users)
							.set({ tribes: tokens })
							.where(eq(users.id, user.id))
							.returning({ tribes: users.tribes });

						// Read back after the trigger has run, never computed here.
						const [countRow] = await db
							.select({ n: tribes.memberCount })
							.from(tribes)
							.where(eq(tribes.id, catalogue.id))
							.limit(1);

						return json({
							ok: true,
							joined: joining,
							tribe: {
								id: catalogue.id,
								name: catalogue.name,
								memberCount: Number(countRow?.n ?? 0),
							},
							tribes: asStringArray(updated?.tribes),
						});
					} catch (error) {
						const status = promotionFailureStatus(error);
						if (status === 402)
							return jsonError("Not enough bones for that boost", 402);
						if (status === 409)
							return jsonError(
								"Somebody promoted this tribe a moment ago. Try again.",
								409,
							);
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("tribes/action", error);
					}
				},
				{
					auth: "required",
					maxBodySize: 4 * 1024,
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `tribes:write:${caller?.id ?? "anon"}`,
					},
				},
			),

			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),
		},
	},
});
