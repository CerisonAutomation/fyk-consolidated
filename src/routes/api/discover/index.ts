import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, gt, ne, or } from "drizzle-orm";
import { db } from "#/db";
import {
	cardSelection,
	readJson,
	readPagination,
	requireCaller,
	toProfileCard,
	z,
} from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { matches, notifications, taps, users } from "#/schema";

/**
 * Discovery deck: `GET /api/discover` and the tap that follows it.
 *
 * This route did not exist — `/discover`, `/profile/$profileId` and the
 * candidate rail all fetched it and got a `404` into a failed query, which is
 * why the app's main screen rendered an empty deck with a console error.
 *
 * Rules encoded here:
 *   - Only `visible AND NOT hidden AND NOT is_suspended` people are discoverable,
 *     and the caller never appears in their own deck.
 *   - Rows already tapped are excluded, so swiping cannot re-offer a decision
 *     (the client kept no local memory of taps either — the deck looped).
 *   - Distances come from `lat_coarse`/`lng_coarse` on both sides (~250 m). A
 *     precise distance from a list endpoint would disclose a home address.
 *   - `hide_distance` / `hide_online` are honoured, not overwritten.
 *   - A mutual tap writes one `matches` row (canonical `user_a < user_b`, the
 *     check that stops duplicate pairs) and notifies the other person once.
 */
const MAX_PAGE = 50;

const tapSchema = z.object({
	targetId: z.uuid(),
	// Optional so the deck can post "pass" without creating anything.
	type: z.enum(["like", "pass", "woof"]).default("like"),
});

export const Route = createFileRoute("/api/discover/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const { limit } = readPagination(new URL(request.url));

					const [me] = await db
						.select({
							lat: users.latCoarse,
							lng: users.lngCoarse,
							age: users.age,
						})
						.from(users)
						.where(eq(users.id, user.id))
						.limit(1);
					if (!me) return jsonError("Finish onboarding before browsing", 409);

					const rows = await db
						.select(cardSelection)
						.from(users)
						.where(
							and(
								eq(users.visible, true),
								eq(users.hidden, false),
								eq(users.isSuspended, false),
								ne(users.id, user.id),
								// An adult-only app must not serve a profile whose age
								// is missing *or* under the floor, whatever the UI says.
								or(gt(users.age, 17), eq(users.age, 18)),
							),
						)
						.orderBy(desc(users.lastActiveAt))
						.limit(MAX_PAGE * 2);

					const ids = rows.map((row) => row.id);
					const [myTaps, tappedMe] = await Promise.all([
						ids.length
							? db
									.select({ targetId: taps.tappedId, type: taps.type })
									.from(taps)
									.where(eq(taps.tapperId, user.id))
							: Promise.resolve([]),
						ids.length
							? db
									.select({ tapperId: taps.tapperId })
									.from(taps)
									.where(eq(taps.tappedId, user.id))
							: Promise.resolve([]),
					]);
					const alreadyTapped = new Set(myTaps.map((tap) => tap.targetId));
					const likedBy = new Set(tappedMe.map((tap) => tap.tapperId));

					const viewer =
						me.lat != null && me.lng != null
							? { lat: me.lat, lng: me.lng }
							: null;

					const candidates = rows
						.filter((row) => !alreadyTapped.has(row.id))
						.slice(0, Math.min(limit, MAX_PAGE))
						.map((row) => ({
							...toProfileCard(row, viewer),
							likedYou: likedBy.has(row.id),
							isFavourite: false,
							tapped: false,
						}));

					return json(
						{
							candidates,
							count: candidates.length,
							exhausted: candidates.length === 0,
						},
						{ cache: "private" },
					);
				},
				{
					rateLimit: {
						limit: 120,
						key: ({ caller }) => `discover:GET:${caller?.id ?? "anon"}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, tapSchema, 4 * 1024);

					if (body.targetId === user.id)
						return jsonError("Cannot tap yourself", 400);

					const [target] = await db
						.select({ id: users.id })
						.from(users)
						.where(
							and(eq(users.id, body.targetId), eq(users.isSuspended, false)),
						)
						.limit(1);
					if (!target) return jsonError("Profile not found", 404);

					if (body.type === "pass") {
						await db
							.delete(taps)
							.where(
								and(eq(taps.tapperId, user.id), eq(taps.tappedId, target.id)),
							);
						return json({ ok: true, tapped: false, matched: false });
					}

					const result = await db.transaction(async (tx) => {
						const inserted = await tx
							.insert(taps)
							.values({
								tapperId: user.id,
								tappedId: target.id,
								type: body.type,
							})
							.onConflictDoNothing({ target: [taps.tapperId, taps.tappedId] })
							.returning({ id: taps.id });

						// Mutual? Look for their tap on me inside the same transaction,
						// so two people tapping at once cannot both miss the match.
						const [reverse] = await tx
							.select({ id: taps.id })
							.from(taps)
							.where(
								and(eq(taps.tapperId, target.id), eq(taps.tappedId, user.id)),
							)
							.limit(1);
						if (!reverse)
							return { matched: false, firstTap: inserted.length > 0 };

						const [a, b] =
							user.id < target.id ? [user.id, target.id] : [target.id, user.id];
						const created = await tx
							.insert(matches)
							.values({ userA: a, userB: b })
							.onConflictDoNothing()
							.returning({ id: matches.id });
						if (created.length > 0) {
							await tx.insert(notifications).values([
								{
									userId: user.id,
									type: "match",
									title: "It's a match",
									body: "You and someone new both tapped. Say hi.",
									href: `/chat`,
									read: false,
								},
								{
									userId: target.id,
									type: "match",
									title: "It's a match",
									body: "You and someone new both tapped. Say hi.",
									href: `/chat`,
									read: false,
								},
							]);
						}
						return { matched: true, firstTap: inserted.length > 0 };
					});

					return json({ ok: true, tapped: true, ...result }, { status: 201 });
				},
				{
					maxBodySize: 4 * 1024,
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `discover:POST:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
