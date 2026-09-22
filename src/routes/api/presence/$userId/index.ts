import { createFileRoute } from "@tanstack/react-router";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import {
	methodNotAllowed,
	requireCaller,
	unexpected,
	z,
} from "@/lib/api-helpers";
import { onlineUntil } from "@/lib/compatibility";
import { json, jsonError, withSecurity } from "@/middleware";
import { blocks, hides as hidesTable, users } from "@/schema";

/**
 * `GET /api/presence/{userId}` — is one person online right now.
 *
 * `useIsUserOnline()` in `#/hooks/prd-hooks` polled this path every thirty seconds
 * and parsed `data.isOnline` out of the SPA's HTML 404, so every chat header showed
 * the same answer for everyone: offline.
 *
 * THE RULES, WHICH ARE THE SAME RULES EVERY OTHER SURFACE USES
 *   - `hide_online` decides whether presence is published at all, and it is read from
 *     the *subject's* row. A caller cannot ask for it to be ignored, and neither can
 *     this route: `#/lib/api-helpers#publicProfile` gates the identical two fields for
 *     every list, so a chat header and a profile card cannot disagree.
 *   - `hide_last_online` gates `lastSeen` the same way. An "offline" badge next to
 *     "last seen 4 minutes ago" reads straight through the first switch, which is why
 *     both are gated rather than one.
 *   - Presence is derived, not stored: `#/lib/compatibility#onlineUntil` treats
 *     `online = true` as a claim that expires `PRESENCE_WINDOW_MS` after
 *     `last_active_at`, so a client that stopped heartbeat-ing stops appearing online
 *     without anybody having to write `false`.
 *   - Blocked or hidden in either direction answers 404, not 403: the existence of a
 *     presence to hide is itself information.
 *
 * Authentication is required. An anonymous presence endpoint is an oracle for
 * "is this person using the app right now", one uuid at a time.
 */

const idSchema = z.uuid();

async function hiddenFromViewer(
	viewerId: string,
	targetId: string,
): Promise<boolean> {
	const [row] = await db
		.select({ id: blocks.id })
		.from(blocks)
		.where(
			or(
				and(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, targetId)),
				and(eq(blocks.blockerId, targetId), eq(blocks.blockedId, viewerId)),
				// One-directional: they hid me, so I do not get to watch them.
				and(
					eq(hidesTable.hiddenId, viewerId),
					eq(hidesTable.hiderId, targetId),
				),
			),
		)
		.limit(1);
	return Boolean(row);
}

export const Route = createFileRoute("/api/presence/$userId/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					try {
						const segment =
							new URL(request.url).pathname.split("/").filter(Boolean).at(-1) ??
							"";
						const parsed = idSchema.safeParse(segment);
						if (!parsed.success) return jsonError("That is not a user id", 400);
						const userId = parsed.data;

						const [row] = await db
							.select({
								id: users.id,
								online: users.online,
								lastActiveAt: users.lastActiveAt,
								hideOnline: users.hideOnline,
								hideLastOnline: users.hideLastOnline,
								status: users.status,
								isSuspended: users.isSuspended,
								hidden: users.hidden,
								visible: users.visible,
							})
							.from(users)
							.where(eq(users.id, userId))
							.limit(1);

						const invisible =
							!row ||
							row.isSuspended === true ||
							row.hidden === true ||
							row.visible === false ||
							(userId !== user.id && (await hiddenFromViewer(user.id, userId)));
						if (invisible) return jsonError("Profile not found", 404);

						const until = onlineUntil(row.lastActiveAt, row.online);
						const published = until !== null && row.hideOnline !== true;

						return json(
							{
								userId: row.id,
								// The key `useIsUserOnline()` reads.
								isOnline: published,
								status: published ? "online" : "offline",
								/** When this answer stops being true, so a client can re-poll then. */
								onlineUntil: until,
								lastSeen: row.hideLastOnline
									? null
									: (row.lastActiveAt?.toISOString() ?? null),
								message: row.status ?? null,
								// Polling every 30s for a state that changes on a 5-minute window
								// is 10 requests for one fact; the client can use this instead.
								recheckAfterMs: published
									? Math.max(0, until - Date.now())
									: 60_000,
								checkedAt: new Date().toISOString(),
							},
							{ cache: "private" },
						);
					} catch (error) {
						return unexpected("presence/read", error);
					}
				},
				{
					auth: "required",
					rateLimit: {
						// One poll per open chat, per half minute, plus a margin for a
						// screen that mounts two of them.
						limit: 120,
						key: ({ caller }) => `presence:${caller?.id ?? "anon"}`,
					},
				},
			),

			POST: methodNotAllowed("GET"),
			PUT: methodNotAllowed("GET"),
			PATCH: methodNotAllowed("GET"),
			DELETE: methodNotAllowed("GET"),
		},
	},
});
