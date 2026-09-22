import { createFileRoute } from "@tanstack/react-router";
import { eq, and, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { offlineQueue } from "#/schema";

const enqueueSchema = z.object({ action: z.enum(["send_message","react","tap","favorite","block","hide","rsvp","view"]), payload: z.record(z.string(), z.any()) });

export const Route = createFileRoute("/api/offline/queue/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const queue = await db.select().from(offlineQueue).where(eq(offlineQueue.userId, user.id)).orderBy(desc(offlineQueue.createdAt)).limit(50);
        return json({ queue, pending: queue.filter(q => q.status === "pending"), count: queue.length, pendingCount: queue.filter(q => q.status === "pending").length });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `oq:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "enqueue";
        if (action === "enqueue") {
          const body = await readJson(request, enqueueSchema, 8*1024);
          const [item] = await db.insert(offlineQueue).values({ userId: user.id, action: body.action, payload: body.payload as any, status: "pending" }).returning();
          return json({ ok: true, item }, { status: 201 });
        }
        if (action === "flush") {
          const pending = await db.select().from(offlineQueue).where(and(eq(offlineQueue.userId, user.id), eq(offlineQueue.status, "pending"))).limit(20);
          for (const item of pending) {
            try {
              await db.update(offlineQueue).set({ status: "done", processedAt: new Date() }).where(eq(offlineQueue.id, item.id));
            } catch {
              await db.update(offlineQueue).set({ status: "failed", attempts: item.attempts + 1 }).where(eq(offlineQueue.id, item.id));
            }
          }
          return json({ ok: true, flushed: pending.length, message: `Flushed ${pending.length} items` });
        }
        return jsonError("Invalid action", 400);
      }, { rateLimit: { limit: 30, key: ({ caller }) => `oq:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (id) {
          await db.delete(offlineQueue).where(eq(offlineQueue.id, id));
          return json({ ok: true, deleted: id });
        }
        await db.delete(offlineQueue).where(and(eq(offlineQueue.userId, user.id), eq(offlineQueue.status, "done")));
        return json({ ok: true, cleared: "done" });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `oq:DELETE:${caller?.id}` } }),
    },
  },
});

