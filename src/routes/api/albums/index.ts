import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { privateAlbumItems, privateAlbums } from "@/schema";

/**
 * Photo Albums / Quick-Share — 2.5
 * Albums with state machine: empty → granted → requested → revoked/expired
 * Content rating policy: neutral / erotic / hardcore
 */

const createAlbumSchema = z.object({
  name: z.string().min(1).max(60).default("Private album"),
  defaultAccessPolicy: z.enum(["standard", "timed", "view_once", "open_count"]).default("standard"),
  defaultDurationSeconds: z.number().int().min(60).max(604800).optional(),
  defaultMaxOpens: z.number().int().min(1).max(20).optional(),
});

const addItemSchema = z.object({
  albumId: z.string().uuid().optional(),
  storagePath: z.string().min(1).max(500),
  mediaKind: z.enum(["image", "video"]).default("image"),
  caption: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/albums/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),

      GET: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const url = new URL(request.url);
          const albumId = url.searchParams.get("albumId");

          if (albumId) {
            const [album] = await db.select().from(privateAlbums).where(eq(privateAlbums.id, albumId)).limit(1);
            if (!album) return jsonError("Album not found", 404);
            if (album.ownerId !== user.id) return jsonError("Not your album", 403);

            const items = await db
              .select()
              .from(privateAlbumItems)
              .where(eq(privateAlbumItems.albumId, albumId))
              .orderBy(privateAlbumItems.position);

            return json({ album, items, count: items.length });
          }

          const albums = await db
            .select()
            .from(privateAlbums)
            .where(eq(privateAlbums.ownerId, user.id))
            .orderBy(desc(privateAlbums.createdAt));

          // Get item counts
          const albumsWithCounts = await Promise.all(
            albums.map(async (album) => {
              const items = await db.select().from(privateAlbumItems).where(eq(privateAlbumItems.albumId, album.id));
              return { ...album, itemCount: items.length };
            }),
          );

          return json({ albums: albumsWithCounts, count: albums.length });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `albums:GET:${caller?.id}` } },
      ),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const url = new URL(request.url);
          const action = url.searchParams.get("action") ?? "create_album";

          if (action === "create_album") {
            const body = await readJson(request, createAlbumSchema, 4 * 1024);

            const [album] = await db
              .insert(privateAlbums)
              .values({
                ownerId: user.id,
                name: body.name,
                defaultAccessPolicy: body.defaultAccessPolicy,
                defaultDurationSeconds: body.defaultDurationSeconds,
                defaultMaxOpens: body.defaultMaxOpens,
              })
              .returning();

            return json({ ok: true, album }, { status: 201 });
          }

          if (action === "add_item") {
            const body = await readJson(request, addItemSchema, 4 * 1024);

            if (body.albumId) {
              const [album] = await db.select().from(privateAlbums).where(eq(privateAlbums.id, body.albumId)).limit(1);
              if (!album) return jsonError("Album not found", 404);
              if (album.ownerId !== user.id) return jsonError("Not your album", 403);
            }

            const [item] = await db
              .insert(privateAlbumItems)
              .values({
                ownerId: user.id,
                albumId: body.albumId ?? null,
                storagePath: body.storagePath,
                mediaKind: body.mediaKind,
                caption: body.caption,
              })
              .returning();

            return json({ ok: true, item }, { status: 201 });
          }

          return jsonError("Invalid action", 400);
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `albums:POST:${caller?.id}` } },
      ),

      DELETE: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const url = new URL(request.url);
          const albumId = url.searchParams.get("albumId");
          const itemId = url.searchParams.get("itemId");

          if (itemId) {
            const [item] = await db.select().from(privateAlbumItems).where(eq(privateAlbumItems.id, itemId)).limit(1);
            if (!item) return jsonError("Item not found", 404);
            if (item.ownerId !== user.id) return jsonError("Not your item", 403);

            await db.delete(privateAlbumItems).where(eq(privateAlbumItems.id, itemId));
            return json({ ok: true, deleted: itemId });
          }

          if (albumId) {
            const [album] = await db.select().from(privateAlbums).where(eq(privateAlbums.id, albumId)).limit(1);
            if (!album) return jsonError("Album not found", 404);
            if (album.ownerId !== user.id) return jsonError("Not your album", 403);

            await db.delete(privateAlbums).where(eq(privateAlbums.id, albumId));
            return json({ ok: true, deleted: albumId });
          }

          return jsonError("albumId or itemId required", 400);
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `albums:DELETE:${caller?.id}` } },
      ),
    },
  },
});
