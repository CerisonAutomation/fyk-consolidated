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
import { promotionFailureStatus, startPromotion } from "@/lib/promotion.server";
import { ApiError, json, jsonError, withSecurity } from "@/middleware";
import {
	entityPromotions,
	groupMembers,
	groupMessages,
	groups,
	notifications,
	users,
} from "@/schema";

/**
 * `GET/POST /api/groups/{groupId}` — one group, its members, its feed, and every
 * mutation the surface offers as an `action`.
 *
 * One endpoint with a validated `action` is the house pattern (`#/routes/api/social`,
 * `#/routes/api/wallet`): the alternative — a path per verb — is what produced
 * `/api/groups/{id}/boost`, `/api/groups/{id}/join` and `/api/groups/{id}/message`
 * in the generated screens, none of which existed.
 *
 * PERMISSION LADDER (0013's CHECK on `group_members.role`)
 *   member    read, post
 *   moderator member, plus remove a member of a lower rank
 *   admin     moderator, plus edit the group and set roles below admin
 *   owner     admin, plus delete the group; cannot be removed or demoted here
 *
 * A secret group answers 404 rather than 403 to a non-member. The distinction is
 * disclosure: 403 confirms the group exists, which is the one thing `privacy =
 * 'secret'` was chosen to hide.
 */

const MESSAGE_TYPES = ["text", "image", "video"] as const;
const ASSIGNABLE_ROLES = ["member", "moderator", "admin"] as const;
const PRIVACY = ["public", "private", "secret"] as const;

const ROLE_RANK: Record<string, number> = {
	member: 0,
	moderator: 1,
	admin: 2,
	owner: 3,
};

function rankOf(role: string | null | undefined): number {
	return ROLE_RANK[role ?? ""] ?? -1;
}

const idSchema = z.uuid();

const actionSchema = z.discriminatedUnion("action", [
	z.object({ action: z.literal("join") }).strict(),
	z.object({ action: z.literal("leave") }).strict(),
	z
		.object({
			action: z.literal("message"),
			content: z.string().min(1).max(1000),
			type: z.enum(MESSAGE_TYPES).optional(),
			mediaUrl: z.string().url().max(2048).optional(),
		})
		.strict(),
	z
		.object({
			action: z.literal("update"),
			name: z.string().min(3).max(60).optional(),
			description: z.string().max(500).nullish(),
			privacy: z.enum(PRIVACY).optional(),
			icon: z.string().max(64).nullish(),
			coverUrl: z.string().url().max(2048).nullish(),
		})
		.strict(),
	z
		.object({
			action: z.literal("setRole"),
			userId: z.uuid(),
			role: z.enum(ASSIGNABLE_ROLES),
		})
		.strict(),
	z.object({ action: z.literal("removeMember"), userId: z.uuid() }).strict(),
	z.object({ action: z.literal("delete") }).strict(),
	z
		.object({
			action: z.literal("boost"),
			minutes: z.number().int().min(30).max(720).optional(),
			idempotencyKey: z.string().max(120).optional(),
		})
		.strict(),
]);

function lastPathSegment(request: Request): string {
	return new URL(request.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
}

async function myRole(groupId: string, userId: string | null) {
	if (!userId) return null;
	const [row] = await db
		.select({ role: groupMembers.role })
		.from(groupMembers)
		.where(
			and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
		)
		.limit(1);
	return row?.role ?? null;
}

export const Route = createFileRoute("/api/groups/$groupId/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ request, caller }) => {
					try {
						const parsed = idSchema.safeParse(lastPathSegment(request));
						if (!parsed.success)
							return jsonError("That is not a group id", 400);
						const groupId = parsed.data;

						const url = new URL(request.url);
						const messageLimit = Math.min(
							Math.max(
								Number.parseInt(url.searchParams.get("messages") ?? "50", 10) ||
									50,
								1,
							),
							100,
						);

						const [group] = await db
							.select({
								id: groups.id,
								name: groups.name,
								description: groups.description,
								coverUrl: groups.coverUrl,
								icon: groups.icon,
								privacy: groups.privacy,
								memberCount: groups.memberCount,
								createdBy: groups.createdBy,
								createdAt: groups.createdAt,
							})
							.from(groups)
							.where(eq(groups.id, groupId))
							.limit(1);
						if (!group) return jsonError("That group does not exist", 404);

						const role = await myRole(groupId, caller?.id ?? null);
						if (group.privacy === "secret" && !role)
							return jsonError("That group does not exist", 404);

						const [memberRows, totalRow, promotedRow] = await Promise.all([
							db
								.select({
									...publicProfileSelection,
									role: groupMembers.role,
									joinedAt: groupMembers.joinedAt,
								})
								.from(groupMembers)
								.innerJoin(users, eq(users.id, groupMembers.userId))
								.where(eq(groupMembers.groupId, groupId))
								.orderBy(desc(groupMembers.joinedAt))
								.limit(50),
							db
								.select({ n: sql<number>`count(*)::int` })
								.from(groupMembers)
								.where(eq(groupMembers.groupId, groupId)),
							db
								.select({ endsAt: entityPromotions.endsAt })
								.from(entityPromotions)
								.where(
									and(
										eq(entityPromotions.entityType, "group"),
										eq(entityPromotions.entityId, groupId),
										gt(entityPromotions.endsAt, new Date()),
									),
								)
								.orderBy(desc(entityPromotions.endsAt))
								.limit(1),
						]);

						// Members are ranked for display, not fetched ranked: `rankOf` is a
						// client-side concept the database has no column for.
						const members = memberRows
							.map((row) => ({
								...publicProfile(row),
								role: row.role,
								joinedAt: row.joinedAt?.toISOString() ?? null,
								rank: rankOf(row.role),
							}))
							// Owner first, then admin, moderator, member; newest join last.
							.sort(
								(a, b) =>
									b.rank - a.rank ||
									(a.joinedAt ?? "").localeCompare(b.joinedAt ?? ""),
							)
							.map(({ rank: _rank, ...rest }) => rest);

						// The feed is member-only unless the group is public. A private
						// group's messages are the reason it is private.
						const canReadFeed = Boolean(role) || group.privacy === "public";
						const messages = canReadFeed
							? (
									await db
										.select({
											id: groupMessages.id,
											senderId: groupMessages.senderId,
											content: groupMessages.content,
											type: groupMessages.type,
											createdAt: groupMessages.createdAt,
											senderName: users.displayName,
											senderAvatar: users.avatar,
										})
										.from(groupMessages)
										.leftJoin(users, eq(users.id, groupMessages.senderId))
										.where(eq(groupMessages.groupId, groupId))
										.orderBy(desc(groupMessages.createdAt))
										.limit(messageLimit)
								)
									// Fetched newest-first (the index order) and reversed, so the
									// client can append to a chat without re-sorting.
									.reverse()
									.map((m) => ({
										id: m.id,
										content: m.content,
										type: m.type ?? "text",
										createdAt: m.createdAt?.toISOString() ?? null,
										sender: publicProfile({
											id: m.senderId,
											displayName: m.senderName,
											handle: null,
											avatar: m.senderAvatar,
											online: false,
											lastActiveAt: null,
											city: null,
											area: null,
											hideOnline: true,
											hideLastOnline: true,
										}),
									}))
							: [];

						return json({
							group: {
								id: group.id,
								name: group.name,
								description: group.description,
								coverUrl: group.coverUrl,
								icon: group.icon,
								privacy: group.privacy ?? "public",
								memberCount: Number(totalRow[0]?.n ?? group.memberCount ?? 0),
								createdBy: group.createdBy,
								createdAt: group.createdAt?.toISOString() ?? null,
								promotedUntil: promotedRow[0]?.endsAt?.toISOString() ?? null,
							},
							role,
							canPost: Boolean(role),
							canModerate: rankOf(role) >= ROLE_RANK.moderator,
							canAdmin: rankOf(role) >= ROLE_RANK.admin,
							isOwner: role === "owner",
							members,
							messages,
						});
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("groups/detail", error);
					}
				},
				{
					auth: "optional",
					rateLimit: {
						limit: 120,
						key: ({ caller, ip }) => `groups:read:${caller?.id ?? ip}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					try {
						const parsed = idSchema.safeParse(lastPathSegment(request));
						if (!parsed.success)
							return jsonError("That is not a group id", 400);
						const groupId = parsed.data;
						const body = await readJson(request, actionSchema, 8 * 1024);

						switch (body.action) {
							case "join": {
								const result = await db.transaction(async (tx) => {
									const [group] = await tx
										.select({
											id: groups.id,
											name: groups.name,
											privacy: groups.privacy,
											createdBy: groups.createdBy,
										})
										.from(groups)
										.where(eq(groups.id, groupId))
										.limit(1);
									if (!group) return { missing: true } as const;
									if (group.privacy === "secret")
										return { hidden: true } as const;

									const [existing] = await tx
										.select({ id: groupMembers.id })
										.from(groupMembers)
										.where(
											and(
												eq(groupMembers.groupId, groupId),
												eq(groupMembers.userId, user.id),
											),
										)
										.limit(1);
									if (existing) return { already: true } as const;

									await tx
										.insert(groupMembers)
										.values({ groupId, userId: user.id, role: "member" })
										.onConflictDoNothing();

									const [who] = await tx
										.select({ displayName: users.displayName })
										.from(users)
										.where(eq(users.id, user.id))
										.limit(1);

									// `member_count` is derived from this edge by a 0019 trigger,
									// so the number the owner sees moves without being written.
									if (group.createdBy && group.createdBy !== user.id)
										await tx.insert(notifications).values({
											userId: group.createdBy,
											type: "system",
											title: "New member",
											body: `${cleanText(who?.displayName, 60) || "Someone"} joined ${
												cleanText(group.name, 80) || "your group"
											}.`,
											href: `/groups/${group.id}`,
											actorId: user.id,
											read: false,
										});

									const [countRow] = await tx
										.select({ n: groups.memberCount })
										.from(groups)
										.where(eq(groups.id, groupId))
										.limit(1);

									return {
										joined: true,
										memberCount: Number(countRow?.n ?? 0),
									} as const;
								});

								if ("missing" in result)
									return jsonError("That group does not exist", 404);
								if ("hidden" in result)
									return jsonError("That group does not exist", 404);
								if ("already" in result)
									return jsonError("You are already a member", 409);
								return json({ ok: true, role: "member", ...result });
							}

							case "leave": {
								const role = await myRole(groupId, user.id);
								if (!role) return jsonError("You are not a member", 404);
								if (role === "owner")
									// An ownerless group is a group nobody can moderate or delete,
									// so leaving as owner is refused rather than silently orphaning it.
									return jsonError(
										"The owner cannot leave. Hand the group to an admin, or delete it.",
										409,
									);
								await db
									.delete(groupMembers)
									.where(
										and(
											eq(groupMembers.groupId, groupId),
											eq(groupMembers.userId, user.id),
										),
									);
								const [countRow] = await db
									.select({ n: groups.memberCount })
									.from(groups)
									.where(eq(groups.id, groupId))
									.limit(1);
								return json({
									ok: true,
									left: true,
									memberCount: Number(countRow?.n ?? 0),
								});
							}

							case "message": {
								const role = await myRole(groupId, user.id);
								if (!role)
									return jsonError("Join the group before posting in it", 403);

								const content = cleanText(body.content, 1000);
								if (!content)
									return jsonError("A message needs some text", 400);
								const type = body.type ?? (body.mediaUrl ? "image" : "text");
								if (type !== "text" && !body.mediaUrl)
									return jsonError(`A ${type} message needs a mediaUrl`, 400);

								const [message] = await db
									.insert(groupMessages)
									.values({
										groupId,
										senderId: user.id,
										content,
										type,
									})
									.returning({
										id: groupMessages.id,
										content: groupMessages.content,
										type: groupMessages.type,
										createdAt: groupMessages.createdAt,
									});

								return json(
									{
										ok: true,
										message: {
											id: message.id,
											content: message.content,
											type: message.type ?? "text",
											createdAt: message.createdAt?.toISOString() ?? null,
										},
									},
									{ status: 201 },
								);
							}

							case "update": {
								const role = await myRole(groupId, user.id);
								if (rankOf(role) < ROLE_RANK.admin)
									return jsonError("Only an admin can edit the group", 403);

								const patch: Partial<{
									name: string;
									description: string | null;
									privacy: string;
									icon: string | null;
									coverUrl: string | null;
								}> = {};
								if (body.name !== undefined) {
									const name = cleanText(body.name, 60);
									if (name.length < 3)
										return jsonError(
											"A group name needs at least 3 characters",
											400,
										);
									patch.name = name;
								}
								if (body.description !== undefined)
									patch.description =
										cleanText(body.description ?? "", 500) || null;
								if (body.privacy !== undefined) patch.privacy = body.privacy;
								if (body.icon !== undefined)
									patch.icon = cleanText(body.icon ?? "", 64) || null;
								if (body.coverUrl !== undefined)
									patch.coverUrl = body.coverUrl ?? null;

								if (Object.keys(patch).length === 0)
									return jsonError("Nothing to update", 400);

								const [updated] = await db
									.update(groups)
									.set(patch)
									.where(eq(groups.id, groupId))
									.returning({
										id: groups.id,
										name: groups.name,
										description: groups.description,
										coverUrl: groups.coverUrl,
										icon: groups.icon,
										privacy: groups.privacy,
										memberCount: groups.memberCount,
										createdAt: groups.createdAt,
									});
								return json({ ok: true, group: updated });
							}

							case "setRole": {
								const role = await myRole(groupId, user.id);
								if (rankOf(role) < ROLE_RANK.admin)
									return jsonError("Only an admin can set roles", 403);
								const targetRole = await myRole(groupId, body.userId);
								if (!targetRole)
									return jsonError("That person is not a member", 404);
								if (targetRole === "owner")
									return jsonError(
										"The owner's role cannot be changed here",
										409,
									);
								// An admin may not rewrite a peer: two admins could otherwise
								// demote each other in a loop with nobody able to stop it.
								if (rankOf(targetRole) >= rankOf(role))
									return jsonError(
										"You cannot change the role of a member at your rank or above",
										403,
									);

								await db
									.update(groupMembers)
									.set({ role: body.role })
									.where(
										and(
											eq(groupMembers.groupId, groupId),
											eq(groupMembers.userId, body.userId),
										),
									);
								return json({ ok: true, userId: body.userId, role: body.role });
							}

							case "removeMember": {
								const role = await myRole(groupId, user.id);
								if (rankOf(role) < ROLE_RANK.moderator)
									return jsonError("Only a moderator can remove a member", 403);
								const targetRole = await myRole(groupId, body.userId);
								if (!targetRole)
									return jsonError("That person is not a member", 404);
								if (rankOf(targetRole) >= rankOf(role))
									return jsonError(
										"You cannot remove a member at your rank or above",
										403,
									);

								await db
									.delete(groupMembers)
									.where(
										and(
											eq(groupMembers.groupId, groupId),
											eq(groupMembers.userId, body.userId),
										),
									);
								const [countRow] = await db
									.select({ n: groups.memberCount })
									.from(groups)
									.where(eq(groups.id, groupId))
									.limit(1);
								return json({
									ok: true,
									removed: body.userId,
									memberCount: Number(countRow?.n ?? 0),
								});
							}

							case "delete": {
								const role = await myRole(groupId, user.id);
								if (role !== "owner")
									return jsonError("Only the owner can delete the group", 403);
								// Memberships, messages and promotions cascade from the group row.
								await db.delete(groups).where(eq(groups.id, groupId));
								return json({ ok: true, deleted: groupId });
							}

							case "boost": {
								const role = await myRole(groupId, user.id);
								if (rankOf(role) < ROLE_RANK.admin)
									return jsonError(
										"Only an admin can put the group at the top of the list",
										403,
									);

								const outcome = await db.transaction((tx) =>
									startPromotion(
										{
											userId: user.id,
											entityType: "group",
											entityId: groupId,
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
								"Somebody promoted this group a moment ago. Try again.",
								409,
							);
						if (isDuplicateError(error))
							return jsonError("You are already a member", 409);
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("groups/action", error);
					}
				},
				{
					auth: "required",
					maxBodySize: 8 * 1024,
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `groups:action:${caller?.id ?? "anon"}`,
					},
				},
			),

			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),
		},
	},
});
