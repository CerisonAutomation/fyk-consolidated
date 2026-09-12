import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "#/db";
import {
	cardSelection,
	methodNotAllowed,
	readPagination,
	requireCaller,
	toProfileCard,
	z,
} from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import {
	favorites,
	footprints,
	matches,
	taps,
	userNotes,
	users,
} from "#/schema";

/**
 * `GET /api/interest/{likes,matches,visitors,favourites,notes}` — the five tabs
 * under Likes.
 *
 * Each tab is the same three-step query with a different join, so they are one
 * route with a validated `tab` param rather than five copies that drift:
 *   1. the relation (who tapped me / who I saved / who visited / who I matched),
 *   2. the profile rows, narrowed to `cardSelection` (no email, phone,
 *      precise fix or `password_hash` — a list of people is the classic place
 *      those leak),
 *   3. the flags (`tapped`, `isFavourite`, `likedYou`, `note`).
 *
 * `notes` are the caller's own private annotations, so they are the only tab
 * that returns `note`; the subject of a note never sees it.
 */
const TABS = ["likes", "matches", "visitors", "favourites", "notes"] as const;
const tabSchema = z.enum(TABS);

export const Route = createFileRoute("/api/interest/$tab/")({
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
					// The wrapper hands handlers `{ request, caller, ip }`; the dynamic
					// segment is the last path component of the request URL. Reading it
					// here keeps `withSecurity` free of router-specific plumbing.
					const segment = decodeURIComponent(
						new URL(request.url).pathname.split("/").filter(Boolean).at(-1) ??
							"",
					);
					const parsedTab = tabSchema.safeParse(segment);
					if (!parsedTab.success) {
						return jsonError(
							`Unknown tab. Expected one of: ${TABS.join(", ")}`,
							404,
						);
					}
					const tab = parsedTab.data;
					const { limit } = readPagination(new URL(request.url));

					// Step 1: which profile ids belong in this tab, newest first.
					const relation = await (async () => {
						switch (tab) {
							case "likes":
								return db
									.select({ id: taps.tapperId, at: taps.createdAt })
									.from(taps)
									.where(and(eq(taps.tappedId, user.id), eq(taps.type, "like")))
									.orderBy(desc(taps.createdAt))
									.limit(limit);
							case "visitors":
								return db
									.select({
										id: footprints.visitorId,
										at: footprints.createdAt,
									})
									.from(footprints)
									.where(eq(footprints.visitedId, user.id))
									.orderBy(desc(footprints.createdAt))
									.limit(limit);
							case "favourites":
								return db
									.select({ id: favorites.targetId, at: favorites.createdAt })
									.from(favorites)
									.where(eq(favorites.userId, user.id))
									.orderBy(desc(favorites.createdAt))
									.limit(limit);
							case "notes":
								return db
									.select({
										id: userNotes.targetUserId,
										at: userNotes.updatedAt,
									})
									.from(userNotes)
									.where(eq(userNotes.noteOwnerId, user.id))
									.orderBy(desc(userNotes.updatedAt))
									.limit(limit);
							default:
								return db
									.select({
										id: sql<string>`case when ${matches.userA} = ${user.id} then ${matches.userB} else ${matches.userA} end`,
										at: matches.createdAt,
									})
									.from(matches)
									.where(
										and(
											or(
												eq(matches.userA, user.id),
												eq(matches.userB, user.id),
											),
											isNull(matches.unmatchedAt),
										),
									)
									.orderBy(desc(matches.createdAt))
									.limit(limit);
						}
					})();

					const ids = [...new Set(relation.map((row) => row.id))].filter(
						Boolean,
					);
					if (ids.length === 0)
						return json({ profiles: [] }, { cache: "private" });

					const [rows, notes, myTaps, tappedMe, savedByMe] = await Promise.all([
						db
							.select(cardSelection)
							.from(users)
							.where(and(inArray(users.id, ids), eq(users.isSuspended, false))),
						tab === "notes"
							? db
									.select({
										targetUserId: userNotes.targetUserId,
										content: userNotes.content,
									})
									.from(userNotes)
									.where(
										and(
											eq(userNotes.noteOwnerId, user.id),
											inArray(userNotes.targetUserId, ids),
										),
									)
							: Promise.resolve([]),
						tab === "likes"
							? db
									.select({ targetId: taps.tappedId })
									.from(taps)
									.where(
										and(
											eq(taps.tapperId, user.id),
											inArray(taps.tappedId, ids),
										),
									)
							: Promise.resolve([]),
						db
							.select({ tapperId: taps.tapperId })
							.from(taps)
							.where(
								and(eq(taps.tappedId, user.id), inArray(taps.tapperId, ids)),
							),
						db
							.select({ targetId: favorites.targetId })
							.from(favorites)
							.where(
								and(
									eq(favorites.userId, user.id),
									inArray(favorites.targetId, ids),
								),
							),
					]);

					const [me] = await db
						.select({ lat: users.latCoarse, lng: users.lngCoarse })
						.from(users)
						.where(eq(users.id, user.id))
						.limit(1);
					const viewer =
						me?.lat != null && me?.lng != null
							? { lat: me.lat, lng: me.lng }
							: null;

					const noteMap = new Map(
						notes.map((note) => [note.targetUserId, note.content]),
					);
					const tapped = new Set(myTaps.map((row) => row.targetId));
					const likedBy = new Set(tappedMe.map((row) => row.tapperId));
					const saved = new Set(savedByMe.map((row) => row.targetId));
					const byId = new Map(rows.map((row) => [row.id, row]));

					// Keep the relation's order rather than the profile table's.
					const cards = ids.flatMap((id) => {
						const row = byId.get(id);
						if (!row) return [];
						const card = toProfileCard(row, viewer);
						return [
							{
								...card,
								matched: tab === "matches",
								likedYou: likedBy.has(id),
								isFavourite: saved.has(id),
								tapped: tapped.has(id),
								note: noteMap.get(id),
								incognito: row.incognito === true,
							},
						];
					});
					const profiles = cards.map(({ incognito, ...card }) => card);

					// Visitors is the one tab with two audiences: a normal visitor is listed
					// with their card, while someone browsing incognito becomes a
					// "secret admirer" preview — counted, but with no id, no handle and no
					// distance, because their privacy setting outranks the list.
					if (tab !== "visitors")
						return json({ profiles, previews: [] }, { cache: "private" });
					const previews = cards
						.filter((card) => card.incognito)
						.map((card) => ({
							age: card.age ?? null,
							city: card.city ?? null,
							photo: card.photo ?? "",
						}));
					return json(
						{
							profiles: cards
								.filter((card) => !card.incognito)
								.map(({ incognito, ...card }) => card),
							previews,
							anonymousCount: previews.length,
						},
						{ cache: "private" },
					);
				},
				{
					rateLimit: {
						limit: 120,
						key: ({ caller }) => `interest:tab:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
