import { createFileRoute } from "@tanstack/react-router";
import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { stories } from "@/schema";

const createSchema = z.object({
  type: z.enum(["image", "video", "text"]),
  mediaUrl: z.string().url().max(2048).optional(),
  text: z.string().max(500).optional(),
  viewOnce: z.boolean().default(false),
});

const viewSchema = z.object({ storyId: z.string().uuid() });

export const Route = createFileRoute("/api/stories/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const authorId = url.searchParams.get("authorId");

        // Clean expired
        await db.delete(stories).where(eq(stories.expiresAt, new Date(0) as any)).catch(() => {});

        if (authorId) {
          const authorStories = await db.select().from(stories).where(and(eq(stories.authorId, authorId), gt(stories.expiresAt, new Date()))).orderBy(desc(stories.createdAt)).limit(20);
          return json({ stories: authorStories, count: authorStories.length, authorId });
        }

        const allStories = await db.select().from(stories).where(gt(stories.expiresAt, new Date())).orderBy(desc(stories.createdAt)).limit(100);

        // Group by author
        const grouped = new Map<string, any[]>();
        for (const story of allStories) {
          if (!grouped.has(story.authorId)) grouped.set(story.authorId, []);
          grouped.get(story.authorId)!.push(story);
        }

        const selfStories = grouped.get(user.id) ?? [];
        grouped.delete(user.id);

        const rings = [
          ...(selfStories.length > 0 ? [{ authorId: user.id, stories: selfStories, isSelf: true }] : []),
          ...Array.from(grouped.entries()).map(([authorId, stories]) => ({
            authorId,
            stories: stories.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
            isSelf: false,
          })),
        ];

        return json({ rings, count: allStories.length, expiresIn: "24h", grouped: rings.length });
      }, { rateLimit: { limit: 60, key: ({ caller }) => `stories:GET:${caller?.id}` } }),

      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "create";

        if (action === "create") {
          const body = await readJson(request, createSchema, 4 * 1024);
          if (!body.mediaUrl && !body.text) return jsonError("mediaUrl or text required", 400);

          const today = new Date(); today.setHours(0,0,0,0);
          const userStoriesToday = await db.select().from(stories).where(and(eq(stories.authorId, user.id), gt(stories.createdAt, today))).limit(21);
          if (userStoriesToday.length >= 20) return jsonError("Max 20 stories per day", 400);

          const [story] = await db.insert(stories).values({
            authorId: user.id,
            type: body.type,
            mediaUrl: body.mediaUrl,
            text: body.text,
            viewOnce: body.viewOnce,
            expiresAt: new Date(Date.now() + 24*60*60*1000),
          }).returning();

          return json({ ok: true, story }, { status: 201 });
        }

        if (action === "view") {
          const body = await readJson(request, viewSchema, 2*1024);
          const [story] = await db.select().from(stories).where(eq(stories.id, body.storyId)).limit(1);
          if (!story) return jsonError("Story not found", 404);
          if (new Date(story.expiresAt).getTime() < Date.now()) return jsonError("Story expired", 410);

          const viewers = (story.viewers as any[]) ?? [];
          if (!viewers.includes(user.id)) {
            viewers.push(user.id);
            await db.update(stories).set({ viewers: viewers as any, viewCount: viewers.length }).where(eq(stories.id, story.id));
          }

          if (story.viewOnce && viewers.includes(user.id) && story.authorId !== user.id) {
            // View-once: delete after view for non-author
            await db.delete(stories).where(eq(stories.id, story.id)).catch(() => {});
          }

          return json({ ok: true, viewed: story.id, viewCount: viewers.length });
        }

        return jsonError("Invalid action", 400);
      }, { rateLimit: { limit: 30, key: ({ caller }) => `stories:POST:${caller?.id}` } }),

      DELETE: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return jsonError("id required", 400);
        const [story] = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
        if (!story) return jsonError("Not found", 404);
        if (story.authorId !== user.id) return jsonError("Not your story", 403);
        await db.delete(stories).where(eq(stories.id, id));
        return json({ ok: true, deleted: id });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `stories:DELETE:${caller?.id}` } }),
    },
  },
});
