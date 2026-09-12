import { createFileRoute } from "@tanstack/react-router";
import { and, eq, or, sql } from "drizzle-orm";
import { db } from "#/db";
import {
	asStringArray,
	methodNotAllowed,
	profileDetailSelection,
	requireCaller,
	toProfileCard,
	z,
} from "#/lib/api-helpers";
import { onlineUntil } from "#/lib/compatibility";
import { json, jsonError, withSecurity } from "#/middleware";
import {
	blocks,
	favorites,
	footprints,
	hides as hidesTable,
	taps,
	userNotes,
	users,
} from "#/schema";

/**
 * `GET /api/profile/{profileId}` — one public profile, shaped for the sheet.
 *
 * `/profile/$profileId` used to fetch this from the inherited REST client
 * (`/v7/profiles/{id}`) with a *numeric* profile id, while every id in this
 * project is a uuid — so the page requested `/v7/profiles/NaN` and rendered
 * nothing. It now reads the canonical row and returns only what a viewer may
 * see:
 *
 *   - suspended, self-hidden or blocked-in-either-direction profiles answer `404`,
 *     not `403`: someone who decided not to meet you should not announce that
 *     their profile exists;
 *   - `lat`/`lng` are never selected — distance comes from the coarsened pair on
 *     both sides and is `null` when either person opted out;
 *   - no email, phone, `profile_complete`, `role` or `tier`;
 *   - `isFavorite` / `tapped` / `likedYou` / `note` are the *caller's* state about
 *     this row, computed here rather than trusted from a client that can edit its
 *     own store.
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
				// Hiding is softer than blocking, but it still means "do not show me
				// this person" — in one direction only.
				and(
					eq(hidesTable.hiddenId, viewerId),
					eq(hidesTable.hiderId, targetId),
				),
			),
		)
		.limit(1);
	return Boolean(row);
}

export const Route = createFileRoute("/api/profile/$profileId/")({
	server: {
		handlers: {
			/* Every verb this route does not implement is answered in JSON (405 +
			 * Allow). Without a declaration TanStack Start treats the request as
			 * unmatched-by-path-and-method and falls through to the document handler,
			 * which answers `200 text/html` with the SPA bundle — a client parsing
			 * JSON then blames the server instead of its own verb. AUDIT §3.10. */
			POST: methodNotAllowed("GET"),
			PUT: methodNotAllowed("GET"),
			PATCH: methodNotAllowed("GET"),
			DELETE: methodNotAllowed("GET"),

			GET: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					// `withSecurity` hands handlers `{ request, caller, ip }`; the dynamic
					// segment is the last path component. Same convention as
					// `/api/interest/$tab`, so no route-specific plumbing leaks into the
					// middleware.
					const segment = decodeURIComponent(
						new URL(request.url).pathname.split("/").filter(Boolean).at(-1) ??
							"",
					);
					const parsed = idSchema.safeParse(segment);
					if (!parsed.success)
						return jsonError("Profile id must be a uuid", 400);
					const profileId = parsed.data;

					const [row] = await db
						.select(profileDetailSelection)
						.from(users)
						.where(eq(users.id, profileId))
						.limit(1);
					if (!row) return jsonError("Profile not found", 404);

					const invisible =
						row.isSuspended === true ||
						row.hidden === true ||
						row.visible === false ||
						(await hiddenFromViewer(user.id, profileId));
					// Your own row is always readable: `/profile` and the edit flow use
					// the same endpoint and must not 404 on yourself.
					if (invisible && profileId !== user.id)
						return jsonError("Profile not found", 404);

					const [me, saved, myTap, theirTap, note] = await Promise.all([
						db
							.select({ lat: users.latCoarse, lng: users.lngCoarse })
							.from(users)
							.where(eq(users.id, user.id))
							.limit(1),
						db
							.select({ id: favorites.id })
							.from(favorites)
							.where(
								and(
									eq(favorites.userId, user.id),
									eq(favorites.targetId, profileId),
								),
							)
							.limit(1),
						db
							.select({ id: taps.id })
							.from(taps)
							.where(
								and(eq(taps.tapperId, user.id), eq(taps.tappedId, profileId)),
							)
							.limit(1),
						db
							.select({ id: taps.id })
							.from(taps)
							.where(
								and(eq(taps.tapperId, profileId), eq(taps.tappedId, user.id)),
							)
							.limit(1),
						db
							.select({ content: userNotes.content })
							.from(userNotes)
							.where(
								and(
									eq(userNotes.noteOwnerId, user.id),
									eq(userNotes.targetUserId, profileId),
								),
							)
							.limit(1),
						// "Seen by" is a fact, so it is written here rather than by a second client
						// call that a buggy screen could skip — never on yourself, and never for a
						// visitor in ghost mode.
						//
						// The `incognito` test lives *inside* the statement (`insert … select … where`)
						// rather than being a read followed by a write, so toggling ghost mode while this
						// request is in flight cannot smuggle a footprint through: the people listed as
						// visitors are exactly the people who were not invisible at that instant.
						// `is distinct from` instead of `= false` because the column is nullable — a row
						// with no recorded preference must record its visit, not lose it.
						profileId === user.id
							? Promise.resolve(undefined)
							: db.insert(footprints).select(
									db
										.select({
											visitorId: users.id,
											visitedId: sql`${profileId}::uuid`.as("visited_id"),
										})
										.from(users)
										.where(
											and(
												eq(users.id, user.id),
												sql`${users.incognito} is distinct from true`,
											),
										)
										.limit(1),
								),
					]);

					const point = me[0];
					const viewer =
						point?.lat != null && point.lng != null
							? { lat: point.lat, lng: point.lng }
							: null;

					const photos = Array.isArray(row.photos) ? row.photos : [];
					return json(
						{
							profile: {
								...toProfileCard(row, viewer),
								// The sheet's own vocabulary, so the screen never has to invent
								// keys out of a `Record<string, unknown>`.
								profileId: row.id,
								aboutMe: row.bio ?? null,
								bodyType: row.bodyType ?? null,
								height: row.height ?? null,
								weight: row.weight ?? null,
								sexualPosition: asStringArray(row.position)[0] ?? null,
								grindrTribes: asStringArray(row.tribes),
								lookingFor: asStringArray(row.lookingFor),
								// The stored references *are* paths or public URLs, so they come
								// back under the name the profile editor writes them with.
								// Labelling them `medias: [{ mediaHash }]` is what taught every
								// client to treat a real upload as a demo seed.
								photos: photos.map((photo) => String(photo)),
								pronouns: row.pronouns ?? null,
								occupation: row.occupation ?? null,
								relationshipStatus: row.relationshipStatus ?? null,
								isVerified: (row.verification ?? 0) >= 2,
								showAge: row.age != null,
								isFavorite: saved.length > 0,
								tapped: myTap.length > 0,
								likedYou: theirTap.length > 0,
								note: note[0]?.content ?? null,
								// Presence expires when the activity window does, using the same
								// rule the server cards use — the sheet reads `onlineUntil` to
								// decide whether to draw the dot at all.
								onlineUntil: onlineUntil(row.lastActiveAt, row.online),
							},
						},
						{ cache: "private" },
					);
				},
				{
					rateLimit: {
						limit: 240,
						key: ({ caller }) => `profile:one:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
