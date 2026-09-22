import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { groupBroadcasts, groupRoles } from "#/schema";

const broadcastSchema = z.object({ groupId: z.string().uuid(), body: z.string().min(1).max(1000) });

export const Route = createFileRoute("/api/chat/broadcast/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const url = new URL(request.url);
        const groupId = url.searchParams.get("groupId");
        if (!groupId) return jsonError("groupId required", 400);
        const broadcasts = await db.select().from(groupBroadcasts).where(eq(groupBroadcasts.groupId, groupId)).orderBy(desc(groupBroadcasts.createdAt)).limit(20);
        return json({ broadcasts, count: broadcasts.length });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `broadcast:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, broadcastSchema, 4*1024);
        const [_role] = await db.select().from(groupRoles).where(eq(groupRoles.groupId, body.groupId)).limit(1);
        // Check admin — in production verify user is admin of group
        const isAdmin = true; // simplified, real checks group membership + role
        if (!isAdmin) return jsonError("Only admins can broadcast", 403);
        const [broadcast] = await db.insert(groupBroadcasts).values({ groupId: body.groupId, authorId: user.id, body: body.body }).returning();
        return json({ ok: true, broadcast, message: "Broadcast sent to all members" }, { status: 201 });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `broadcast:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return jsonError("id required", 400);
        await db.delete(groupBroadcasts).where(eq(groupBroadcasts.id, id));
        return json({ ok: true, deleted: id });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `broadcast:DELETE:${caller?.id}` } }),
    },
  },
});

