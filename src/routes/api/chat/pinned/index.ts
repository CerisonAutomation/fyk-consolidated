import { createFileRoute } from "@tanstack/react-router";
import { eq, and, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { chatPinned, conversationMembers, messages } from "#/schema";

const pinSchema = z.object({ conversationId: z.string().uuid(), messageId: z.string().uuid() });

export const Route = createFileRoute("/api/chat/pinned/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const conversationId = url.searchParams.get("conversationId");
        if (!conversationId) return jsonError("conversationId required", 400);
        const [member] = await db.select().from(conversationMembers).where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.profileId, user.id))).limit(1);
        if (!member) return jsonError("Not a member", 403);
        const pinned = await db.select().from(chatPinned).where(eq(chatPinned.conversationId, conversationId)).orderBy(desc(chatPinned.pinnedAt)).limit(20);
        return json({ pinned, count: pinned.length });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `pinned:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, pinSchema, 2*1024);
        const [member] = await db.select().from(conversationMembers).where(and(eq(conversationMembers.conversationId, body.conversationId), eq(conversationMembers.profileId, user.id))).limit(1);
        if (!member) return jsonError("Not a member", 403);
        const [msg] = await db.select().from(messages).where(eq(messages.id, body.messageId)).limit(1);
        if (!msg || msg.conversationId !== body.conversationId) return jsonError("Message not in conversation", 400);
        const existing = await db.select().from(chatPinned).where(and(eq(chatPinned.conversationId, body.conversationId), eq(chatPinned.messageId, body.messageId))).limit(1);
        if (existing.length > 0) return json({ ok: true, pinned: existing[0], alreadyPinned: true });
        const count = await db.select().from(chatPinned).where(eq(chatPinned.conversationId, body.conversationId)).limit(10);
        if (count.length >= 10) return jsonError("Max 10 pinned per conversation", 400);
        const [created] = await db.insert(chatPinned).values({ conversationId: body.conversationId, messageId: body.messageId, pinnedBy: user.id }).returning();
        return json({ ok: true, pinned: created }, { status: 201 });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `pinned:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const url = new URL(request.url);
        const conversationId = url.searchParams.get("conversationId");
        const messageId = url.searchParams.get("messageId");
        if (!conversationId || !messageId) return jsonError("conversationId and messageId required", 400);
        await db.delete(chatPinned).where(and(eq(chatPinned.conversationId, conversationId), eq(chatPinned.messageId, messageId)));
        return json({ ok: true, unpinned: messageId });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `pinned:DELETE:${caller?.id}` } }),
    },
  },
});

