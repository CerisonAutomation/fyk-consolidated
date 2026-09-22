import { createFileRoute } from "@tanstack/react-router";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { conversationMembers, messages, scheduledMessages } from "@/schema";

const scheduleSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().min(1).max(4000),
  scheduledAt: z.string().datetime(),
  type: z.enum(["text","image","location"]).default("text"),
});

export const Route = createFileRoute("/api/chat/scheduled/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const conversationId = url.searchParams.get("conversationId");

        let query = db.select().from(scheduledMessages).where(eq(scheduledMessages.senderId, user.id)).orderBy(desc(scheduledMessages.scheduledAt)).limit(50);
        const all = await query;

        let filtered = all;
        if (conversationId) filtered = all.filter(m => m.conversationId === conversationId);

        // Check due and auto-send
        const now = new Date();
        const due = filtered.filter(m => m.status === "scheduled" && new Date(m.scheduledAt).getTime() <= now.getTime());
        for (const msg of due) {
          try {
            await db.insert(messages).values({ conversationId: msg.conversationId, senderId: msg.senderId, type: msg.type as any, body: msg.body });
            await db.update(scheduledMessages).set({ status: "sent", sentAt: now }).where(eq(scheduledMessages.id, msg.id));
          } catch {
            await db.update(scheduledMessages).set({ status: "failed" }).where(eq(scheduledMessages.id, msg.id));
          }
        }

        const updated = await db.select().from(scheduledMessages).where(eq(scheduledMessages.senderId, user.id)).orderBy(desc(scheduledMessages.scheduledAt)).limit(50);
        const finalFiltered = conversationId ? updated.filter(m => m.conversationId === conversationId) : updated;

        return json({
          scheduled: finalFiltered.filter(m => m.status === "scheduled"),
          sent: finalFiltered.filter(m => m.status === "sent"),
          count: finalFiltered.length,
          dueCount: due.length,
        });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `scheduled:GET:${caller?.id}` } }),

      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, scheduleSchema, 8*1024);
        const scheduledDate = new Date(body.scheduledAt);
        if (isNaN(scheduledDate.getTime())) return jsonError("Invalid date", 400);
        if (scheduledDate.getTime() <= Date.now()) return jsonError("Must be in future", 400);
        if (scheduledDate.getTime() > Date.now() + 30*24*60*60*1000) return jsonError("Max 30 days", 400);

        const [member] = await db.select().from(conversationMembers).where(and(eq(conversationMembers.conversationId, body.conversationId), eq(conversationMembers.profileId, user.id))).limit(1);
        if (!member) return jsonError("Not a member", 403);

        const [scheduled] = await db.insert(scheduledMessages).values({
          conversationId: body.conversationId,
          senderId: user.id,
          body: body.body,
          type: body.type,
          scheduledAt: scheduledDate,
          status: "scheduled",
        }).returning();

        return json({ ok: true, scheduled }, { status: 201 });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `scheduled:POST:${caller?.id}` } }),

      DELETE: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return jsonError("id required", 400);
        const [msg] = await db.select().from(scheduledMessages).where(eq(scheduledMessages.id, id)).limit(1);
        if (!msg) return jsonError("Not found", 404);
        if (msg.senderId !== user.id) return jsonError("Not your message", 403);
        if (msg.status !== "scheduled") return jsonError("Cannot cancel sent", 400);
        await db.update(scheduledMessages).set({ status: "cancelled" }).where(eq(scheduledMessages.id, id));
        return json({ ok: true, cancelled: id });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `scheduled:DELETE:${caller?.id}` } }),
    },
  },
});
