import { createFileRoute } from "@tanstack/react-router";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "#/db";
import { readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { favorites, privateAlbumItems, privateAlbums, users } from "#/schema";

/**
 * `/api/social` — favourites toggle (the star on a card) and the private-album
 * list a profile sheet shows.
 *
 * The toggle is derived from a delete-then-insert pair rather than a read/write
 * flag: the client sends no `add`/`remove`, so the server has to flip whatever
 * state exists, and the `UNIQUE(user_id, target_id)` constraint makes the insert
 * race-safe (two tabs cannot create two rows).
 */
const bodySchema = z.object({
	targetId: z.uuid(),
	action: z.enum(["add", "remove"]).optional(),
});

const ALBUM_LIMIT = 24;

export const Route = createFileRoute("/api/social/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const view =
						new URL(request.url).searchParams.get("view") ?? "albums";
					if (view !== "albums") return jsonError("Unsupported view", 400);

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
					// Real cover = the lowest-positioned item of each album. Nothing is
					// invented when an album is empty.
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
								// First item by position — an album with no items has no
								// cover, which is different from a made-up one.
								coverUrl: covers.get(album.id) ?? null,
								createdAt: (album.createdAt ?? new Date()).toISOString(),
							})),
						},
						{ cache: "private" },
					);
				},
				{
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `social:GET:${caller?.id ?? "anon"}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, bodySchema, 4 * 1024);
					if (body.targetId === user.id)
						return jsonError("Cannot favourite yourself", 400);

					const [target] = await db
						.select({ id: users.id })
						.from(users)
						.where(eq(users.id, body.targetId))
						.limit(1);
					if (!target) return jsonError("Profile not found", 404);

					const existing = await db
						.delete(favorites)
						.where(
							and(
								eq(favorites.userId, user.id),
								eq(favorites.targetId, target.id),
							),
						)
						.returning({ id: favorites.id });

					let favorited = true;
					if (existing.length > 0 && body.action !== "add") {
						favorited = false;
					} else if (body.action === "remove") {
						favorited = false;
					} else {
						await db
							.insert(favorites)
							.values({ userId: user.id, targetId: target.id })
							.onConflictDoNothing();
					}

					return json({ ok: true, favorited });
				},
				{
					maxBodySize: 4 * 1024,
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `social:POST:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
