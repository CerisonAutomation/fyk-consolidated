import { createFileRoute } from "@tanstack/react-router";
import { eq, and, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { hotPicsRequests } from "#/schema";

const requestSchema = z.object({ ownerId: z.string().uuid() });
const responseSchema = z.object({ requestId: z.string().uuid(), action: z.enum(["accept","decline"]) });

export const Route = createFileRoute("/api/profile/hot-pics/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const ownerId = url.searchParams.get("ownerId");
        const type = url.searchParams.get("type") ?? "received";

        if (type === "received") {
          const received = await db.select().from(hotPicsRequests).where(eq(hotPicsRequests.ownerId, user.id)).orderBy(desc(hotPicsRequests.createdAt)).limit(20);
          return json({ requests: received, count: received.length, type: "received" });
        }
        if (type === "sent") {
          const sent = await db.select().from(hotPicsRequests).where(eq(hotPicsRequests.requesterId, user.id)).orderBy(desc(hotPicsRequests.createdAt)).limit(20);
          return json({ requests: sent, count: sent.length, type: "sent" });
        }
        if (ownerId) {
          const [req] = await db.select().from(hotPicsRequests).where(and(eq(hotPicsRequests.requesterId, user.id), eq(hotPicsRequests.ownerId, ownerId))).orderBy(desc(hotPicsRequests.createdAt)).limit(1);
          const canView = req ? req.status === "accepted" && new Date(req.expiresAt).getTime() > Date.now() : false;
          const expired = req ? new Date(req.expiresAt).getTime() <= Date.now() : false;
          return json({ request: req ?? null, canView, expired });
        }
        return json({ requests: [], count: 0 });
      }, { rateLimit: { limit: 60, key: ({ caller }) => `hot-pics:GET:${caller?.id}` } }),

      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "request";

        if (action === "request") {
          const body = await readJson(request, requestSchema, 2*1024);
          if (body.ownerId === user.id) return jsonError("Cannot request own hot pics", 400);
          const [existing] = await db.select().from(hotPicsRequests).where(and(eq(hotPicsRequests.requesterId, user.id), eq(hotPicsRequests.ownerId, body.ownerId), eq(hotPicsRequests.status, "pending"))).limit(1);
          if (existing) return jsonError("Already requested", 400);
          const [req] = await db.insert(hotPicsRequests).values({ requesterId: user.id, ownerId: body.ownerId, status: "pending", expiresAt: new Date(Date.now()+24*60*60*1000) }).returning();
          return json({ ok: true, request: req }, { status: 201 });
        }

        if (action === "respond") {
          const body = await readJson(request, responseSchema, 2*1024);
          const [req] = await db.select().from(hotPicsRequests).where(eq(hotPicsRequests.id, body.requestId)).limit(1);
          if (!req) return jsonError("Request not found", 404);
          if (req.ownerId !== user.id) return jsonError("Not your request", 403);
          if (req.status !== "pending") return jsonError("Already resolved", 400);
          const [updated] = await db.update(hotPicsRequests).set({ status: body.action === "accept" ? "accepted" : "declined", resolvedAt: new Date() }).where(eq(hotPicsRequests.id, req.id)).returning();
          return json({ ok: true, request: updated });
        }

        return jsonError("Invalid action", 400);
      }, { rateLimit: { limit: 20, key: ({ caller }) => `hot-pics:POST:${caller?.id}` } }),

      DELETE: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return jsonError("id required", 400);
        const [req] = await db.select().from(hotPicsRequests).where(eq(hotPicsRequests.id, id)).limit(1);
        if (!req) return jsonError("Not found", 404);
        if (req.requesterId !== user.id && req.ownerId !== user.id) return jsonError("Not authorized", 403);
        await db.delete(hotPicsRequests).where(eq(hotPicsRequests.id, id));
        return json({ ok: true, deleted: id });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `hot-pics:DELETE:${caller?.id}` } }),
    },
  },
});
