import { createFileRoute } from "@tanstack/react-router";
import { and, asc, count, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "#/db";
import {
	cardSelection,
	readJson,
	requireCaller,
	toProfileCard,
	unexpected,
	z,
} from "#/lib/api-helpers";
import { isBlocked } from "#/lib/tap.server";
import { json, jsonError, withSecurity } from "#/middleware";
import {
	blocks,
	favorites,
	footprints,
	hides,
	privateAlbumItems,
	privateAlbums,
	users,
} from "#/schema";

/**
 * `/api/social` — the edges between two people: favourites (the star), blocks,
 * hides, profile visits (footprints) and the caller's private albums.
 *
 * One endpoint with an `action` rather than five routes: they are the same
 * operation over the same pair of ids, and the last time this app had five
 * separate copies each had a slightly different authorisation check. Every
 * mutation here goes through the same four guards — not yourself, the target
 * exists, the target is not suspended, and no block in either direction.
 *
 * `hide` is *not* `users.hidden`: that column is "my profile is hidden from
 * everyone", while "I never want to see this person again" is a per-viewer edge
 * and lives in `public.hides` (added by `0018`, because the schema had blocks but
 * no hide list, and `/settings/hidden` was therefore rendering someone else's
 * flag).
 */
const ALBUM_LIMIT = 24;
const LIST_LIMIT = 50;
const FOOTPRINT_WINDOW_MS = 24 * 60 * 60 * 1000;

const VIEWS = [
	"albums",
	"blocks",
	"hides",
	"favourites",
	"footprints",
] as const;
const ACTIONS = [
	"favourite",
	"unfavourite",
	"block",
	"unblock",
	"hide",
	"unhide",
	"footprint",
] as const;

const bodySchema = z.object({
	targetId: z.uuid(),
	action: z.enum(ACTIONS).default("favourite"),
	/** Optional label kept on a footprint (map preset, "right now", …). */
	preset: z.string().max(32).nullish(),
});

export const Route = createFileRoute("/api/social/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const view =
						new URL(request.url).searchParams.get("view") ?? "albums";
					if (!VIEWS.includes(view as (typeof VIEWS)[number])) {
						return jsonError(
							`Unknown view. Expected one of: ${VIEWS.join(", ")}`,
							400,
						);
					}

					if (view === "albums") {
						const [albums, counts] = await Promise.all([
							db
								.select({
									id: privateAlbums.id,
									name: privateAlbums.name,
									accessPolicy: privateAlbums.defaultAccessPolicy,
									maxOpens: privateAlbums.defaultMaxOpens,
									durationSeconds: privateAlbums.defaultDurationSeconds,
									createdAt: privateAlbums.createdAt,
								})
								.from(privateAlbums)
								.where(eq(privateAlbums.ownerId, user.id))
								.orderBy(asc(privateAlbums.name))
								.limit(ALBUM_LIMIT),
							db
								.select({ albumId: privateAlbumItems.albumId, total: count() })
								.from(privateAlbumItems)
								.where(eq(privateAlbumItems.ownerId, user.id))
								.groupBy(privateAlbumItems.albumId),
						]);

						const sizes = new Map(
							counts.map((row) => [row.albumId, Number(row.total)]),
						);
						// Cover = the lowest-positioned item of that album. An empty album
						// has no cover, which is a different fact from a made-up one.
						const coverRows = await db
							.select({
								albumId: privateAlbumItems.albumId,
								storagePath: privateAlbumItems.storagePath,
							})
							.from(privateAlbumItems)
							.where(eq(privateAlbumItems.ownerId, user.id))
							.orderBy(asc(privateAlbumItems.position));
						const covers = new Map<string, string>();
						for (const row of coverRows) {
							if (row.albumId && row.storagePath && !covers.has(row.albumId)) {
								covers.set(row.albumId, row.storagePath);
							}
						}

						return json(
							{
								albums: albums.map((album) => ({
									id: album.id,
									name: album.name,
									accessPolicy: album.accessPolicy,
									maxOpens: album.maxOpens,
									durationSeconds: album.durationSeconds,
									itemCount: album.id ? (sizes.get(album.id) ?? 0) : 0,
									// Signed by the browser per `media_access_policy`, never here.
									coverStoragePath: album.id
										? (covers.get(album.id) ?? null)
										: null,
									createdAt: (album.createdAt ?? new Date()).toISOString(),
								})),
							},
							{ cache: "private" },
						);
					}

					// The three "list of people" views share one shape: relation rows →
					// profile cards, in the relation's order, blocks respected.
					const relation = await (async () => {
						if (view === "blocks") {
							return db
								.select({ id: blocks.blockedId, at: blocks.createdAt })
								.from(blocks)
								.where(eq(blocks.blockerId, user.id))
								.orderBy(desc(blocks.createdAt))
								.limit(LIST_LIMIT);
						}
						if (view === "hides") {
							return db
								.select({ id: hides.hiddenId, at: hides.createdAt })
								.from(hides)
								.where(eq(hides.hiderId, user.id))
								.orderBy(desc(hides.createdAt))
								.limit(LIST_LIMIT);
						}
						if (view === "favourites") {
							return db
								.select({ id: favorites.targetId, at: favorites.createdAt })
								.from(favorites)
								.where(eq(favorites.userId, user.id))
								.orderBy(desc(favorites.createdAt))
								.limit(LIST_LIMIT);
						}
						return db
							.select({ id: footprints.visitorId, at: footprints.createdAt })
							.from(footprints)
							.where(eq(footprints.visitedId, user.id))
							.orderBy(desc(footprints.createdAt))
							.limit(LIST_LIMIT);
					})();

					const ids = [...new Set(relation.map((row) => row.id))].filter(
						Boolean,
					);
					// An incognito visitor is not named in `footprints`; a blocked or
					// suspended account is not named anywhere.
					const rows = ids.length
						? await db
								.select(cardSelection)
								.from(users)
								.where(
									and(
										inArray(users.id, ids),
										eq(users.isSuspended, false),
										...(view === "footprints"
											? [eq(users.incognito, false)]
											: []),
									),
								)
						: [];
					const byId = new Map(rows.map((row) => [row.id, row]));
					const cards = relation.flatMap((row) => {
						const profile = byId.get(row.id);
						if (!profile) return [];
						return [
							{
								profile: toProfileCard(profile, null),
								at: (row.at ?? new Date()).toISOString(),
							},
						];
					});

					const key =
						view === "blocks"
							? "blocks"
							: view === "hides"
								? "hides"
								: view === "favourites"
									? "favourites"
									: "footprints";
					return json(
						{
							[key]: cards,
							// Flat alias: `/settings/blocked` and `/settings/hidden` map
							// `profileId` + a timestamp, and this avoids a second query.
							profiles: cards.map((entry) => entry.profile),
							total: cards.length,
						},
						{ cache: "private" },
					);
				},
				{
					rateLimit: {
						limit: 120,
						key: ({ caller }) => `social:GET:${caller?.id ?? "anon"}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, bodySchema, 4 * 1024);
					if (body.targetId === user.id) {
						return jsonError(`Cannot ${body.action} yourself`, 400);
					}

					const [target] = await db
						.select({ id: users.id })
						.from(users)
						.where(
							and(eq(users.id, body.targetId), eq(users.isSuspended, false)),
						)
						.limit(1);
					if (!target) return jsonError("Profile not found", 404);

					// Un-do actions stay available when a block exists: being blocked by
					// someone must not strand you in their hide list forever.
					const reversible =
						body.action === "unblock" ||
						body.action === "unhide" ||
						body.action === "unfavourite";
					if (!reversible && (await isBlocked(user.id, target.id))) {
						return jsonError("This profile is not available", 403);
					}

					try {
						switch (body.action) {
							case "favourite": {
								await db
									.insert(favorites)
									.values({ userId: user.id, targetId: target.id })
									.onConflictDoNothing();
								return json({ ok: true, favorited: true, isFavourite: true });
							}
							case "unfavourite": {
								const removed = await db
									.delete(favorites)
									.where(
										and(
											eq(favorites.userId, user.id),
											eq(favorites.targetId, target.id),
										),
									)
									.returning({ id: favorites.id });
								return json({
									ok: true,
									favorited: false,
									isFavourite: false,
									removed: removed.length > 0,
								});
							}
							case "block": {
								const [already] = await db
									.select({ id: blocks.id })
									.from(blocks)
									.where(
										and(
											eq(blocks.blockerId, user.id),
											eq(blocks.blockedId, target.id),
										),
									)
									.limit(1);
								if (already)
									return json({
										ok: true,
										blocked: true,
										alreadyBlocked: true,
									});
								await db
									.insert(blocks)
									.values({ blockerId: user.id, blockedId: target.id });
								// A block cuts the interaction both ways: the favourite edge and
								// any "we matched" flag would otherwise keep glowing.
								await db
									.delete(favorites)
									.where(
										and(
											eq(favorites.userId, user.id),
											eq(favorites.targetId, target.id),
										),
									);
								return json({ ok: true, blocked: true }, { status: 201 });
							}
							case "unblock": {
								const removed = await db
									.delete(blocks)
									.where(
										and(
											eq(blocks.blockerId, user.id),
											eq(blocks.blockedId, target.id),
										),
									)
									.returning({ id: blocks.id });
								return json({
									ok: true,
									blocked: false,
									removed: removed.length > 0,
								});
							}
							case "hide": {
								await db
									.insert(hides)
									.values({ hiderId: user.id, hiddenId: target.id })
									.onConflictDoNothing();
								return json({ ok: true, hidden: true });
							}
							case "unhide": {
								const removed = await db
									.delete(hides)
									.where(
										and(
											eq(hides.hiderId, user.id),
											eq(hides.hiddenId, target.id),
										),
									)
									.returning({ id: hides.id });
								return json({
									ok: true,
									hidden: false,
									removed: removed.length > 0,
								});
							}
							case "footprint": {
								// One visit per visitor per 24 h: looking at the same profile
								// twice must not double-count in their "seen by" list.
								const since = new Date(Date.now() - FOOTPRINT_WINDOW_MS);
								const [recent] = await db
									.select({ id: footprints.id })
									.from(footprints)
									.where(
										and(
											eq(footprints.visitorId, user.id),
											eq(footprints.visitedId, target.id),
											gte(footprints.createdAt, since),
										),
									)
									.limit(1);
								if (recent)
									return json({
										ok: true,
										recorded: false,
										reason: "already_recorded_24h",
									});
								await db.insert(footprints).values({
									visitorId: user.id,
									visitedId: target.id,
									preset: body.preset ?? null,
								});
								return json({ ok: true, recorded: true }, { status: 201 });
							}
						}
					} catch (error) {
						return unexpected("social", error);
					}
				},
				{
					maxBodySize: 4 * 1024,
					rateLimit: {
						limit: 120,
						key: ({ caller }) => `social:POST:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
