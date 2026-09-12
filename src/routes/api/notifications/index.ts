import { createFileRoute } from "@tanstack/react-router";
import { and, count, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "#/db";
import {
	cleanText,
	methodNotAllowed,
	publicProfile,
	publicProfileSelection,
	readJson,
	requireCaller,
	z,
} from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { notifications, users } from "#/schema";

/**
 * Notification inbox.
 *
 * Fixed relative to the previous version:
 *   - `getCurrentUser()` resolved a better-auth session that could never exist
 *     (no database configured), so `markRead`/`markAllRead`/`clear` answered 401
 *     for every signed-in user and the inbox was always `[]`.
 *   - The mapped rows hardcoded `status: "online"` and `geo: { lat: 0, lng: 0 }`
 *     for every actor: clients read "everyone online" and pinned offline users
 *     in the ocean. Presence now comes from the row (`#/lib/api-helpers`).
 *   - `action` was compared against unvalidated strings, so a typo silently fell
 *     through to "Unknown action" with a 400 that hid which field was wrong; the
 *     body is now a discriminated union on `action`.
 *   - Columns are the ones `0010_remaining_tables.sql` actually creates:
 *     `actor_id`/`href` (not `fromUserId`/`deepLink`). `read_at` and `hidden` are
 *     added by `0015_server_canonical.sql`.
 *   - `hide` soft-hides (`hidden = true`) instead of deleting, so moderation
 *     history and unread counts stay reconcilable.
 */

const NOTIFICATION_LIMIT = 50;

const markReadSchema = z.object({
	action: z.literal("markRead"),
	notificationId: z.uuid(),
});
const markAllSchema = z.object({ action: z.literal("markAllRead") });
const clearSchema = z.object({ action: z.literal("clear") });
const hideSchema = z.object({
	action: z.literal("hide"),
	notificationId: z.uuid(),
});

const bodySchema = z.discriminatedUnion("action", [
	markReadSchema,
	markAllSchema,
	clearSchema,
	hideSchema,
]);

/** Rows a user can still see: `hidden` is false, or null on pre-0015 databases. */
function visibleTo(userId: string) {
	return and(
		eq(notifications.userId, userId),
		or(eq(notifications.hidden, false), isNull(notifications.hidden)),
	);
}

export const Route = createFileRoute("/api/notifications/")({
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
				async ({ caller, request }) => {
					// The header bell polls this; an anonymous poll must not 401 in
					// the console, so it renders an empty inbox instead of erroring.
					if (!caller)
						return json({ notifications: [], unread: 0 }, { cache: "public" });

					const limit = Math.min(
						NOTIFICATION_LIMIT,
						Number(
							new URL(request.url).searchParams.get("limit") ??
								NOTIFICATION_LIMIT,
						) || NOTIFICATION_LIMIT,
					);

					const [rows, unreadRows] = await Promise.all([
						db
							.select({
								id: notifications.id,
								type: notifications.type,
								title: notifications.title,
								body: notifications.body,
								actorId: notifications.actorId,
								href: notifications.href,
								read: notifications.read,
								createdAt: notifications.createdAt,
							})
							.from(notifications)
							.where(visibleTo(caller.id))
							.orderBy(desc(notifications.createdAt), desc(notifications.id))
							.limit(limit),
						db
							.select({ total: count() })
							.from(notifications)
							.where(and(visibleTo(caller.id), eq(notifications.read, false))),
					]);

					const actorIds = [
						...new Set(
							rows.map((row) => row.actorId).filter((id): id is string => !!id),
						),
					];
					const actorRows = actorIds.length
						? await db
								.select(publicProfileSelection)
								.from(users)
								.where(inArray(users.id, actorIds))
						: [];
					const actors = new Map(actorRows.map((actor) => [actor.id, actor]));
					const unread = Number(unreadRows[0]?.total ?? 0);

					return json(
						{
							notifications: rows.map((row) => ({
								id: row.id,
								type: row.type,
								title: cleanText(row.title, 200),
								body: row.body ? cleanText(row.body, 500) : undefined,
								actor_id: row.actorId ?? undefined,
								// In-app only: `href` is a path, and clients must never
								// receive an absolute URL an attacker could have stored.
								href: row.href ?? undefined,
								read: row.read ?? false,
								created_at: (row.createdAt ?? new Date()).toISOString(),
								actor: row.actorId
									? publicProfile(actors.get(row.actorId))
									: undefined,
							})),
							unread,
							more: rows.length === limit,
						},
						{ cache: "private" },
					);
				},
				{
					auth: "optional",
					rateLimit: {
						limit: 120,
						key: ({ ip, caller }) => `notifications:GET:${caller?.id ?? ip}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, bodySchema, 8 * 1024);

					switch (body.action) {
						case "markRead": {
							// `userId` in the WHERE clause is what stops one user from
							// flipping another user's rows: id-only would be an IDOR.
							const updated = await db
								.update(notifications)
								.set({ read: true, readAt: new Date() })
								.where(
									and(
										eq(notifications.id, body.notificationId),
										eq(notifications.userId, user.id),
									),
								)
								.returning({ id: notifications.id });
							if (updated.length === 0)
								return jsonError("Notification not found", 404);
							return json({ ok: true });
						}
						case "markAllRead": {
							const updated = await db
								.update(notifications)
								.set({ read: true, readAt: new Date() })
								.where(and(visibleTo(user.id), eq(notifications.read, false)))
								.returning({ id: notifications.id });
							return json({ ok: true, updated: updated.length });
						}
						case "hide": {
							const hidden = await db
								.update(notifications)
								.set({ hidden: true })
								.where(
									and(
										eq(notifications.id, body.notificationId),
										eq(notifications.userId, user.id),
									),
								)
								.returning({ id: notifications.id });
							if (hidden.length === 0)
								return jsonError("Notification not found", 404);
							return json({ ok: true });
						}
						default: {
							// `action: "clear"` means "empty my inbox" — destructive, so it is
							// scoped to the caller and only ever removes read rows:
							// clearing an inbox that still holds unread safety alerts
							// would hide them from the user *and* from moderation.
							const removed = await db
								.delete(notifications)
								.where(and(visibleTo(user.id), eq(notifications.read, true)))
								.returning({ id: notifications.id });
							return json({ ok: true, removed: removed.length });
						}
					}
				},
				{
					maxBodySize: 8 * 1024,
					rateLimit: {
						limit: 60,
						key: ({ caller: user }) =>
							`notifications:POST:${user?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
