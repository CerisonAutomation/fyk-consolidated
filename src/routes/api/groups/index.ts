import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, gt, ilike, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	cleanText,
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "@/lib/api-helpers";
import { recordPromotionImpressions } from "@/lib/promotion.server";
import { nextFeedCursor, readFeedPage } from "@/lib/routing/feed";
import { json, jsonError, withSecurity } from "@/middleware";
import { entityPromotions, groupMembers, groups } from "@/schema";

/**
 * `GET/POST /api/groups` — the community-group list, and creating one.
 *
 * WHAT WAS MISSING
 * ----------------
 * `public.groups`, `group_members` and `group_messages` have existed since 0010 and
 * were hardened by 0013 (role and privacy CHECKs) and 0019 (`member_count` became a
 * derived column), but no route read or wrote them: `/groups` fetched
 * `/api/groups` and got the SPA's HTML 404 page back. This is that route.
 *
 * TWO RULES THE TABLES IMPOSE, AND THE ROUTE OBEYS
 *   - `member_count` is derived from `group_members` by a 0019 trigger, and writing
 *     it directly raises. Creating a group therefore inserts the owner's membership
 *     row and reads the counter back, never `set({ memberCount: 1 })`.
 *   - `privacy = 'secret'` means the group is not discoverable. A list that returned
 *     secret groups to non-members would leak their names and covers, so they are
 *     filtered out unless the caller is a member.
 *
 * Ordering puts a live paid promotion first (`entity_promotions`, 0030) and then
 * recency; the correlated subquery keeps that global rather than per page, so a
 * promoted group is first on page one and not merely first among whatever page it
 * happened to land on.
 */

const PRIVACY = ["public", "private", "secret"] as const;
const GROUP_ROLES = ["member", "moderator", "admin", "owner"] as const;

const createSchema = z
	.object({
		action: z.literal("create"),
		name: z.string().min(3).max(60),
		description: z.string().max(500).optional(),
		privacy: z.enum(PRIVACY).optional(),
		icon: z.string().max(64).optional(),
		coverUrl: z.string().url().max(2048).optional(),
	})
	.strict();

/** Live promotion for a group row, as a scalar subquery usable in ORDER BY. */
function livePromotionEnds(entityId: typeof groups.id) {
	return db
		.select({ endsAt: entityPromotions.endsAt })
		.from(entityPromotions)
		.where(
			and(
				eq(entityPromotions.entityType, "group"),
				eq(entityPromotions.entityId, entityId),
				gt(entityPromotions.endsAt, new Date()),
			),
		)
		.limit(1);
}

function toItem(row: {
	id: string;
	name: string | null;
	description: string | null;
	coverUrl: string | null;
	icon: string | null;
	privacy: string | null;
	memberCount: number | null;
	createdAt: Date | null;
	role: string | null;
	promotedUntil: Date | null;
}) {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		coverUrl: row.coverUrl,
		icon: row.icon,
		privacy: row.privacy ?? "public",
		memberCount: Number(row.memberCount ?? 0),
		createdAt: row.createdAt?.toISOString() ?? null,
		/** The caller's role in this group, or `null` when they are not a member. */
		role: row.role,
		promotedUntil: row.promotedUntil?.toISOString() ?? null,
	};
}

export const Route = createFileRoute("/api/groups/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ request, caller }) => {
					try {
						const url = new URL(request.url);
						const { limit, before } = readFeedPage(url);
						const q = cleanText(url.searchParams.get("q"), 60) ?? "";
						const privacyParam = url.searchParams.get("privacy");
						const privacy = (PRIVACY as readonly string[]).includes(
							privacyParam ?? "",
						)
							? privacyParam
							: null;
						const mine = url.searchParams.get("mine") === "1";

						const membership = groupMembers;
						const conditions = [];

						// A secret group is invisible to non-members: name, cover and member
						// count are all disclosure. Members see their own, everyone sees the rest.
						if (caller) {
							conditions.push(
								or(
									sql`${groups.privacy} <> 'secret'`,
									isNotNull(membership.id),
								),
							);
						} else {
							conditions.push(sql`${groups.privacy} = 'public'`);
						}

						if (privacy) conditions.push(eq(groups.privacy, privacy));
						if (q)
							conditions.push(
								or(
									ilike(groups.name, `%${q}%`),
									ilike(groups.description, `%${q}%`),
								),
							);
						if (before) conditions.push(sql`${groups.createdAt} < ${before}`);
						if (mine) {
							if (!caller) return jsonError("Sign in first", 401);
							conditions.push(isNotNull(membership.id));
						}

						const rows = await db
							.select({
								id: groups.id,
								name: groups.name,
								description: groups.description,
								coverUrl: groups.coverUrl,
								icon: groups.icon,
								privacy: groups.privacy,
								memberCount: groups.memberCount,
								createdAt: groups.createdAt,
								role: membership.role,
								promotedUntil: sql<Date | null>`${livePromotionEnds(groups.id)}`,
							})
							.from(groups)
							.leftJoin(
								membership,
								and(
									eq(membership.groupId, groups.id),
									caller ? eq(membership.userId, caller.id) : sql`false`,
								),
							)
							.where(and(...conditions))
							.orderBy(
								sql`(${livePromotionEnds(groups.id)}) is null`,
								desc(groups.createdAt),
							)
							.limit(limit);

						const promoted = rows
							.filter((r) => r.promotedUntil !== null)
							.map((r) => r.id);
						// Fire and forget is not an option here: the count is the receipt for
						// the bones somebody spent, so it is awaited before the response.
						if (promoted.length > 0)
							await recordPromotionImpressions("group", promoted);

						return json({
							items: rows.map(toItem),
							nextCursor: nextFeedCursor(rows, limit),
							limit,
							privacyOptions: PRIVACY,
							roles: GROUP_ROLES,
						});
					} catch (error) {
						return unexpected("groups/list", error);
					}
				},
				{
					auth: "optional",
					rateLimit: {
						limit: 60,
						key: ({ caller, ip }) => `groups:list:${caller?.id ?? ip}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					try {
						const body = await readJson(request, createSchema, 8 * 1024);
						const name = cleanText(body.name, 60);
						if (!name || name.length < 3)
							return jsonError("A group name needs at least 3 characters", 400);

						const created = await db.transaction(async (tx) => {
							const [group] = await tx
								.insert(groups)
								.values({
									name,
									description: cleanText(body.description, 500),
									privacy: body.privacy ?? "public",
									icon: body.icon ? cleanText(body.icon, 64) : null,
									coverUrl: body.coverUrl ?? null,
									createdBy: user.id,
								})
								.returning({
									id: groups.id,
									name: groups.name,
									description: groups.description,
									coverUrl: groups.coverUrl,
									icon: groups.icon,
									privacy: groups.privacy,
									createdAt: groups.createdAt,
								});

							// The owner's membership is what makes `member_count` 1: the
							// counter is derived (0019) and a direct write raises.
							await tx.insert(groupMembers).values({
								groupId: group.id,
								userId: user.id,
								role: "owner",
							});

							const [countRow] = await tx
								.select({ n: groups.memberCount })
								.from(groups)
								.where(eq(groups.id, group.id))
								.limit(1);

							return { group, memberCount: Number(countRow?.n ?? 1) };
						});

						return json(
							{
								ok: true,
								group: {
									...toItem({
										...created.group,
										memberCount: created.memberCount,
										role: "owner",
										promotedUntil: null,
									}),
								},
							},
							{ status: 201 },
						);
					} catch (error) {
						return unexpected("groups/create", error);
					}
				},
				{
					auth: "required",
					maxBodySize: 8 * 1024,
					// Ten groups an hour is a community, a hundred is a spam run.
					rateLimit: {
						limit: 10,
						key: ({ caller }) => `groups:create:${caller?.id}`,
					},
				},
			),

			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),
		},
	},
});
