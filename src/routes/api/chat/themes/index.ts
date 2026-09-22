import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { chatThemes, conversationMembers } from "@/schema";

/**
 * Chat Themes & Customization — 19.5
 * Per-thread background color/wallpaper and bubble color, stored locally per conversation.
 */

const themeSchema = z.object({
  conversationId: z.string().uuid(),
  background: z.string().max(100).optional(),
  bubbleColor: z.string().max(50).optional(),
  wallpaper: z.string().url().max(2048).optional(),
});

export const Route = createFileRoute("/api/chat/themes/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),

      GET: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const url = new URL(request.url);
          const conversationId = url.searchParams.get("conversationId");
          if (!conversationId) return jsonError("conversationId required", 400);

          const [theme] = await db
            .select()
            .from(chatThemes)
            .where(and(eq(chatThemes.conversationId, conversationId), eq(chatThemes.userId, user.id)))
            .limit(1);

          return json({ theme: theme ?? null, conversationId });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `chat-themes:GET:${caller?.id}` } },
      ),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, themeSchema, 4 * 1024);

          const [member] = await db
            .select()
            .from(conversationMembers)
            .where(and(eq(conversationMembers.conversationId, body.conversationId), eq(conversationMembers.profileId, user.id)))
            .limit(1);

          if (!member) return jsonError("Not a member", 403);

          const [theme] = await db
            .insert(chatThemes)
            .values({
              conversationId: body.conversationId,
              userId: user.id,
              background: body.background,
              bubbleColor: body.bubbleColor,
              wallpaper: body.wallpaper,
            })
            .onConflictDoUpdate({
              target: [chatThemes.conversationId, chatThemes.userId],
              set: {
                background: body.background,
                bubbleColor: body.bubbleColor,
                wallpaper: body.wallpaper,
                updatedAt: new Date() as any,
              },
            })
            .returning();

          return json({ ok: true, theme });
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `chat-themes:POST:${caller?.id}` } },
      ),

      DELETE: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const url = new URL(request.url);
          const conversationId = url.searchParams.get("conversationId");
          if (!conversationId) return jsonError("conversationId required", 400);

          await db.delete(chatThemes).where(and(eq(chatThemes.conversationId, conversationId), eq(chatThemes.userId, user.id)));

          return json({ ok: true, cleared: conversationId });
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `chat-themes:DELETE:${caller?.id}` } },
      ),
    },
  },
});
