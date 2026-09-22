import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, gt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	asStringArray,
	cardSelection,
	methodNotAllowed,
	readJson,
	readPagination,
	requireCaller,
	toProfileCard,
	z,
} from "@/lib/api-helpers";
import { compatibilityScore } from "@/lib/compatibility";
import { recordTap } from "@/lib/tap.server";
import { json, jsonError, withSecurity } from "@/middleware";
import { favorites, taps, users } from "@/schema";

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

const tapSchema = z.object({
	targetId: z.uuid(),
	// Optional so the deck can post "pass" without creating anything.
	type: z.enum(["like", "pass", "woof"]).default("like"),
});

export const Route = createFileRoute("/api/discover/")({
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
								// "Appear in discovery" off really means off: an
								// incognito profile must not be in anyone's deck.
								eq(users.incognito, false),
								eq(users.isSuspended, false),
								ne(users.id, user.id),
								// A block or a hide in either direction removes the
								// person from the deck entirely — not just the match.
								sql`not exists (
									select 1 from public.blocks b
									 where (b.blocker_id = ${users.id} and b.blocked_id = ${user.id})
									    or (b.blocker_id = ${user.id} and b.blocked_id = ${users.id})
								)`,
								sql`not exists (
									select 1 from public.hides h
									 where (h.hidden_id = ${user.id} and h.hider_id = ${users.id})
								)`,
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
								matchScore: compatibilityScore(meTags, {
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
					if (outcome.status === "quota")
						return jsonError(
							`${outcome.limit} taps a day on Free — you have used all ${outcome.used}. Upgrade for unlimited taps.`,
							429,
						);
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
