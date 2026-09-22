import { createFileRoute } from "@tanstack/react-router";
import { eq, and, or, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { wishlists, wishlistItems } from "#/schema";

const createSchema = z.object({ participantId: z.string().uuid() });
const addItemSchema = z.object({ wishlistId: z.string().uuid(), text: z.string().min(1).max(200), category: z.string().max(50).default("general") });
const voteSchema = z.object({ wishlistId: z.string().uuid(), itemId: z.string().uuid() });

export const Route = createFileRoute("/api/profile/wishlist/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const wishlistId = url.searchParams.get("id");
        const participantId = url.searchParams.get("participantId");

        if (wishlistId) {
          const [wishlist] = await db.select().from(wishlists).where(eq(wishlists.id, wishlistId)).limit(1);
          if (!wishlist) return jsonError("Wishlist not found", 404);
          if (wishlist.ownerId !== user.id && wishlist.participantId !== user.id) return jsonError("Not a participant", 403);
          const items = await db.select().from(wishlistItems).where(eq(wishlistItems.wishlistId, wishlistId)).orderBy(desc(wishlistItems.voteCount)).limit(50);
          return json({ wishlist: { ...wishlist, items }, topItems: items.slice(0,5), count: items.length });
        }

        if (participantId) {
          const [wishlist] = await db.select().from(wishlists).where(or(and(eq(wishlists.ownerId, user.id), eq(wishlists.participantId, participantId)), and(eq(wishlists.ownerId, participantId), eq(wishlists.participantId, user.id)))).limit(1);
          if (!wishlist) return json({ wishlist: null, exists: false });
          const items = await db.select().from(wishlistItems).where(eq(wishlistItems.wishlistId, wishlist.id)).orderBy(desc(wishlistItems.voteCount)).limit(50);
          return json({ wishlist: { ...wishlist, items }, topItems: items.slice(0,5), exists: true });
        }

        const myWishlists = await db.select().from(wishlists).where(or(eq(wishlists.ownerId, user.id), eq(wishlists.participantId, user.id))).orderBy(desc(wishlists.updatedAt)).limit(20);
        return json({ wishlists: myWishlists, count: myWishlists.length });
      }, { rateLimit: { limit: 60, key: ({ caller }) => `wishlist:GET:${caller?.id}` } }),

      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "create";

        if (action === "create") {
          const body = await readJson(request, createSchema, 2*1024);
          if (body.participantId === user.id) return jsonError("Cannot create wishlist with yourself", 400);
          const [existing] = await db.select().from(wishlists).where(or(and(eq(wishlists.ownerId, user.id), eq(wishlists.participantId, body.participantId)), and(eq(wishlists.ownerId, body.participantId), eq(wishlists.participantId, user.id)))).limit(1);
          if (existing) return json({ ok: true, wishlist: existing, exists: true });
          const [wishlist] = await db.insert(wishlists).values({ ownerId: user.id, participantId: body.participantId }).returning();
          return json({ ok: true, wishlist }, { status: 201 });
        }

        if (action === "add_item") {
          const body = await readJson(request, addItemSchema, 4*1024);
          const [wishlist] = await db.select().from(wishlists).where(eq(wishlists.id, body.wishlistId)).limit(1);
          if (!wishlist) return jsonError("Wishlist not found", 404);
          if (wishlist.ownerId !== user.id && wishlist.participantId !== user.id) return jsonError("Not a participant", 403);
          const [item] = await db.insert(wishlistItems).values({ wishlistId: body.wishlistId, text: body.text, category: body.category, addedBy: user.id }).returning();
          await db.update(wishlists).set({ updatedAt: new Date() }).where(eq(wishlists.id, body.wishlistId));
          return json({ ok: true, item }, { status: 201 });
        }

        if (action === "vote") {
          const body = await readJson(request, voteSchema, 2*1024);
          const [wishlist] = await db.select().from(wishlists).where(eq(wishlists.id, body.wishlistId)).limit(1);
          if (!wishlist) return jsonError("Wishlist not found", 404);
          const [item] = await db.select().from(wishlistItems).where(eq(wishlistItems.id, body.itemId)).limit(1);
          if (!item) return jsonError("Item not found", 404);
          const votes = (item.votes as string[]) ?? [];
          const newVotes = votes.includes(user.id) ? votes.filter(v => v !== user.id) : [...votes, user.id];
          const [updated] = await db.update(wishlistItems).set({ votes: newVotes as any, voteCount: newVotes.length }).where(eq(wishlistItems.id, item.id)).returning();
          return json({ ok: true, item: updated, voted: newVotes.includes(user.id) });
        }

        return jsonError("Invalid action", 400);
      }, { rateLimit: { limit: 30, key: ({ caller }) => `wishlist:POST:${caller?.id}` } }),

      DELETE: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return jsonError("id required", 400);
        const [wishlist] = await db.select().from(wishlists).where(eq(wishlists.id, id)).limit(1);
        if (!wishlist) return jsonError("Not found", 404);
        if (wishlist.ownerId !== user.id && wishlist.participantId !== user.id) return jsonError("Not authorized", 403);
        await db.delete(wishlists).where(eq(wishlists.id, id));
        return json({ ok: true, deleted: id });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `wishlist:DELETE:${caller?.id}` } }),
    },
  },
});
