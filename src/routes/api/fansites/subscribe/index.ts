import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { db } from "#/db";
import {
	cleanText,
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { fansiteSubscribers, fansites, notifications, users } from "#/schema";

/**
 * `POST /api/fansites/subscribe` — follow and unfollow a fansite.
 *
 * WHY AN ENDPOINT FOR A TWO-ROW WRITE
 * -----------------------------------
 * There was no `fansite_subscriptions` table at all. `#/integrations/supabase/fansites.ts`
 * represented a subscription as a *notification* sent to the creator, and
 * "am I subscribed?" was answered by finding that notification again. Three things
 * were wrong with that, and all three were visible:
 *
 *   1. `notifications.type` is CHECKed (0013) against a list that never included
 *      `'fansite_subscribe'`, so the insert was rejected — and the code did not
 *      read the error, so the UI flipped to "Subscribed" over nothing;
 *   2. clearing the inbox or `hide`-ing a notification deleted the *relationship*;
 *   3. `subscriber_count` was incremented by the client (`fansites.ts` added 1 to
 *      whatever number it had read), which is how counters drift out of existence.
 *
 * `0019` added `public.fansite_subscribers` as the edge, moved the counter onto a
 * trigger over it, and this route is what writes both — including the creator's
 * notification, which is the one part that must be a server write: under RLS a
 * browser token cannot insert a row belonging to *another* user.
 */
const bodySchema = z.object({
	fansiteId: z.uuid(),
});

export const Route = createFileRoute("/api/fansites/subscribe/")({
	server: {
		handlers: {
			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, bodySchema, 2 * 1024);

					try {
						const result = await db.transaction(async (tx) => {
							const [site] = await tx
								.select({
									id: fansites.id,
									ownerId: fansites.userId,
									name: fansites.name,
								})
								.from(fansites)
								.where(eq(fansites.id, body.fansiteId))
								.limit(1);
							if (!site) return { missing: true } as const;
							if (site.ownerId === user.id) return { own: true } as const;

							const [existing] = await tx
								.select({ id: fansiteSubscribers.id })
								.from(fansiteSubscribers)
								.where(
									and(
										eq(fansiteSubscribers.fansiteId, site.id),
										eq(fansiteSubscribers.userId, user.id),
									),
								)
								.limit(1);

							if (existing) {
								await tx
									.delete(fansiteSubscribers)
									.where(eq(fansiteSubscribers.id, existing.id));
								// The creator's inbox keeps the notification they received: an
								// unfollow is not news worth a second row, and deleting their
								// notification would be editing someone else's inbox history.
								return { subscribed: false } as const;
							}

							await tx
								.insert(fansiteSubscribers)
								.values({ fansiteId: site.id, userId: user.id })
								.onConflictDoNothing();

							const [who] = await tx
								.select({ displayName: users.displayName })
								.from(users)
								.where(eq(users.id, user.id))
								.limit(1);

							await tx.insert(notifications).values({
								userId: site.ownerId,
								type: "fansite_subscribe",
								title: "New subscriber",
								body: `${cleanText(who?.displayName, 60) || "Someone"} subscribed to ${
									cleanText(site.name, 80) || "your fansite"
								}.`,
								href: `/fansites`,
								actorId: user.id,
								read: false,
							});

							return { subscribed: true } as const;
						});

						if ("missing" in result)
							return jsonError("That fansite no longer exists", 404);
						if ("own" in result)
							return jsonError(
								"This is your fansite — you are already subscribed",
								400,
							);

						const [countRow] = await db
							.select({ n: fansites.subscriberCount })
							.from(fansites)
							.where(eq(fansites.id, body.fansiteId))
							.limit(1);

						return json({
							ok: true,
							subscribed: result.subscribed,
							// Read back, never computed here: `fansites.subscriber_count` is derived
							// from the edge by a trigger since 0019, and a second arithmetic path in
							// application code is what made the number wrong in the first place.
							subscriber_count: Number(countRow?.n ?? 0),
						});
					} catch (error) {
						return unexpected("fansites/subscribe", error);
					}
				},
				{
					maxBodySize: 2 * 1024,
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `fansites:subscribe:${caller?.id ?? "anon"}`,
					},
				},
			),

			// Declared so an unsupported verb is answered in JSON. Without these, a `PUT
			// /api/wallet` reached the SPA handler and returned `200 text/html`.
			GET: methodNotAllowed("POST"),
			PUT: methodNotAllowed("POST"),
			PATCH: methodNotAllowed("POST"),
			DELETE: methodNotAllowed("POST"),
		},
	},
});
