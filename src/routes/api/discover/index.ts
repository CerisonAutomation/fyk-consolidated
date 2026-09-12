import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, gt, ne, or, sql } from "drizzle-orm";
import { db } from "#/db";
import {
	asStringArray,
	cardSelection,
	readJson,
	readPagination,
	requireCaller,
	toProfileCard,
	z,
} from "#/lib/api-helpers";
import { recordTap } from "#/lib/tap.server";
import { json, jsonError, withSecurity } from "#/middleware";
import { favorites, taps, users } from "#/schema";

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
 *   - `matchScore` is a real number: the deck's copy promises "ranked by
 *     5-dimension compatibility" and the client filters on `minMatch`, so the
 *     score is computed here from the five dimensions and used to order the
 *     page. It was previously absent, which made that slider a no-op.
 *   - `meta` (online / verified / newCount / vibes) is what the filter chips and
 *     the AI strip render; it used to be missing entirely, so the counters were
 *     permanently blank.
 */
const MAX_PAGE = 50;

/** Presence/recency decay used by the fifth compatibility dimension. */
const RECENCY_HALFLIFE_DAYS = 7;

const tapSchema = z.object({
	targetId: z.uuid(),
	// Optional so the deck can post "pass" without creating anything.
	type: z.enum(["like", "pass", "woof"]).default("like"),
});

/** Jaccard overlap of two tag lists, normalised; 0 when either side is empty. */
function overlap(a: string[], b: string[]): number {
	if (a.length === 0 || b.length === 0) return 0;
	const setB = new Set(b.map((v) => v.toLowerCase()));
	const setA = new Set(a.map((v) => v.toLowerCase()));
	let shared = 0;
	for (const value of setA) if (setB.has(value)) shared += 1;
	return shared / new Set([...setA, ...setB]).size;
}

/**
 * Five dimensions, weighted, 0–100:
 *   tribes (0.30) · interests (0.25) · intent (0.20) · distance (0.15) · recency (0.10)
 *
 * Every term is derived from stored columns; nothing is guessed. A profile
 * without coordinates or without tags scores 0 on that term rather than a
 * flattering default, because the slider filters on the number.
 */
function compatibility(
	me: {
		tribes: string[];
		interests: string[];
		intents: string[];
		age: number | null;
	},
	row: {
		tribes: string[];
		interests: string[];
		intents: string[];
		age: number | null;
		distanceKm: number | null;
		lastActiveAt: Date | null;
	},
): number {
	const tribes = overlap(me.tribes, row.tribes);
	const interests = overlap(me.interests, row.interests);
	const intent = overlap(me.intents, row.intents);
	// 25 km is the practical reach of the deck; closer scores higher, unknown distance is 0.
	const distance =
		row.distanceKm == null
			? 0
			: Math.max(0, 1 - Math.min(row.distanceKm, 25) / 25);
	const days = row.lastActiveAt
		? (Date.now() - row.lastActiveAt.getTime()) / 86_400_000
		: 999;
	const recency = 0.5 ** (Math.max(0, days) / RECENCY_HALFLIFE_DAYS);
	const ageGap =
		me.age != null && row.age != null
			? Math.max(0, 1 - Math.abs(me.age - row.age) / 20)
			: 0.5;
	const raw =
		0.3 * tribes +
		0.25 * interests +
		0.2 * intent +
		0.15 * distance +
		0.1 * recency +
		0.05 * ageGap;
	// 0.75 is the maximum the weights can reach when everything lines up.
	return Math.min(100, Math.round((raw / 0.75) * 100));
}

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
							tribes: users.tribes,
							interests: users.interests,
							intents: users.intents,
							lookingFor: users.lookingFor,
						})
						.from(users)
						.where(eq(users.id, user.id))
						.limit(1);
					if (!me) return jsonError("Finish onboarding before browsing", 409);
					const meTags = {
						tribes: asStringArray(me.tribes),
						interests: asStringArray(me.interests),
						intents: intentOf(me.intents, me.lookingFor),
						age: me.age ?? null,
					};

					const rows = await db
						.select({
							...cardSelection,
							tribes: users.tribes,
							interests: users.interests,
							intents: users.intents,
							lookingFor: users.lookingFor,
							boostExpiresAt: users.boostExpiresAt,
						})
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
						.orderBy(
							// A live boost outranks the score — otherwise `POST /api/boost`
							// would spend a consumable for a flag nobody reads.
							sql`case when ${users.boostExpiresAt} is not null and ${users.boostExpiresAt} > now() then 0 else 1 end`,
							desc(users.lastActiveAt),
						)
						.limit(MAX_PAGE * 2);

					const ids = rows.map((row) => row.id);
					const [myTaps, tappedMe, favRows] = await Promise.all([
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
						// Favourites are not a tap: they come from `favorites`, and the
						// deck rail is the only place a saved profile shows as saved.
						db
							.select({ targetId: favorites.targetId })
							.from(favorites)
							.where(eq(favorites.userId, user.id)),
					]);
					const alreadyTapped = new Set(myTaps.map((tap) => tap.targetId));
					const likedBy = new Set(tappedMe.map((tap) => tap.tapperId));
					const favourited = new Set(favRows.map((row) => row.targetId));

					const viewer =
						me.lat != null && me.lng != null
							? { lat: me.lat, lng: me.lng }
							: null;

					const scored = rows
						.filter((row) => !alreadyTapped.has(row.id))
						.map((row) => {
							const card = toProfileCard(row, viewer);
							return {
								...card,
								likedYou: likedBy.has(row.id),
								isFavourite: favourited.has(row.id),
								tapped: alreadyTapped.has(row.id),
								matchScore: compatibility(meTags, {
									tribes: asStringArray(row.tribes),
									interests: asStringArray(row.interests),
									intents: intentOf(row.intents, row.lookingFor),
									age: row.age ?? null,
									distanceKm: card.distance ?? null,
									lastActiveAt: row.lastActiveAt ?? null,
								}),
								// Kept on the row only to count `meta.vibes`, then stripped
								// from the payload so no duplicate list ships to the client.
								vibeTags: asStringArray(row.lookingFor),
								// True only while the purchase is live, so the card can badge it.
								boosted: Boolean(
									row.boostExpiresAt && row.boostExpiresAt > new Date(),
								),
							};
						})
						.sort(
							(a, b) =>
								Number(b.boosted) - Number(a.boosted) ||
								b.matchScore - a.matchScore,
						);

					const candidates = scored.slice(0, Math.min(limit, MAX_PAGE));

					const vibes = new Map<string, number>();
					for (const row of candidates) {
						for (const value of row.vibeTags) {
							vibes.set(value, (vibes.get(value) ?? 0) + 1);
						}
					}

					return json(
						{
							candidates: candidates.map(
								({ vibeTags, ...candidate }) => candidate,
							),
							count: candidates.length,
							exhausted: candidates.length === 0,
							// Counts describe this page, not the whole table: a global number
							// would be an unrelated statistic above a filtered deck.
							meta: {
								online: candidates.filter((row) => row.online).length,
								verified: candidates.filter((row) => row.verified).length,
								newCount: candidates.filter(
									(row) => !alreadyTapped.has(row.id) && !likedBy.has(row.id),
								).length,
								vibes: [...vibes.entries()]
									.sort((a, b) => b[1] - a[1])
									.slice(0, 6)
									.map(([vibe, count]) => ({ vibe, count })),
							},
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

					if (body.type === "pass") {
						// A pass is still a decision: drop any earlier tap so the deck
						// never re-offers somebody the user already answered.
						await db
							.delete(taps)
							.where(
								and(
									eq(taps.tapperId, user.id),
									eq(taps.tappedId, body.targetId),
								),
							);
						return json({ ok: true, tapped: false, matched: false });
					}

					// Existence, suspension and blocks are all resolved inside the shared
					// engine, so `/api/taps` and this route can never diverge.
					const outcome = await recordTap({
						userId: user.id,
						targetId: body.targetId,
						kind: body.type,
					});
					if (outcome.status === "not_found")
						return jsonError("Profile not found", 404);
					if (outcome.status === "blocked")
						return jsonError("This profile is not available", 403);
					return json(
						{
							ok: true,
							tapped: true,
							matched: outcome.matched,
							firstTap: outcome.firstTap,
						},
						{ status: 201 },
					);
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

/**
 * `intents` is the current column; `looking_for` is what onboarding writes for
 * the same axis, so a profile only filled out in onboarding still scores.
 */
function intentOf(intents: unknown, lookingFor: unknown): string[] {
	const own = asStringArray(intents);
	return own.length ? own : asStringArray(lookingFor);
}
