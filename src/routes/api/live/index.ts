import { createFileRoute } from "@tanstack/react-router";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { liveRooms, users } from "@/schema";

const createSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(["video","audio"]).default("video"),
});

const joinSchema = z.object({ roomId: z.string().uuid() });

export const Route = createFileRoute("/api/live/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const type = url.searchParams.get("type") ?? "all";
        const hostId = url.searchParams.get("hostId");

        if (hostId) {
          const [room] = await db.select().from(liveRooms).where(and(eq(liveRooms.hostId, hostId), eq(liveRooms.status, "live"))).limit(1);
          return json({ room: room ?? null, isLive: !!room });
        }

        const rooms = await db.select().from(liveRooms).where(eq(liveRooms.status, "live")).orderBy(desc(liveRooms.viewerCount)).limit(20);
        const myRoom = rooms.find(r => r.hostId === user.id);

        if (type === "my") return json({ room: myRoom ?? null, isHost: !!myRoom });

        // Enrich with host info
        const hostIds = rooms.map(r => r.hostId);
        const hosts = hostIds.length > 0 ? await db.select().from(users).where(eq(users.id, hostIds[0] as any)).limit(20).catch(() => []) : [];

        return json({ rooms, count: rooms.length, myRoom, hosts: hosts.length });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `live:GET:${caller?.id}` } }),

      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "create";

        if (action === "create") {
          const body = await readJson(request, createSchema, 4*1024);
          const [existing] = await db.select().from(liveRooms).where(and(eq(liveRooms.hostId, user.id), eq(liveRooms.status, "live"))).limit(1);
          if (existing) return jsonError("Already live", 400);

          const [room] = await db.insert(liveRooms).values({
            hostId: user.id,
            title: body.title,
            description: body.description,
            type: body.type,
            status: "live",
          }).returning();

          return json({ ok: true, room }, { status: 201 });
        }

        if (action === "join") {
          const body = await readJson(request, joinSchema, 2*1024);
          const [room] = await db.select().from(liveRooms).where(eq(liveRooms.id, body.roomId)).limit(1);
          if (!room || room.status !== "live") return jsonError("Room not live", 404);
          if (room.hostId === user.id) return jsonError("Cannot join own room", 400);

          await db.update(liveRooms).set({
            viewerCount: (room.viewerCount ?? 0) + 1,
            peakViewers: Math.max(room.peakViewers ?? 0, (room.viewerCount ?? 0) + 1)
          }).where(eq(liveRooms.id, room.id));

          return json({ ok: true, roomId: room.id, hostId: room.hostId, joined: true });
        }

        if (action === "leave") {
          const body = await readJson(request, joinSchema, 2*1024);
          const [room] = await db.select().from(liveRooms).where(eq(liveRooms.id, body.roomId)).limit(1);
          if (!room) return jsonError("Room not found", 404);
          await db.update(liveRooms).set({ viewerCount: Math.max(0, (room.viewerCount ?? 1) - 1) }).where(eq(liveRooms.id, room.id));
          return json({ ok: true, left: room.id });
        }

        if (action === "end") {
          const [room] = await db.select().from(liveRooms).where(and(eq(liveRooms.hostId, user.id), eq(liveRooms.status, "live"))).limit(1);
          if (!room) return jsonError("Not live", 404);
          const [ended] = await db.update(liveRooms).set({ status: "ended", endedAt: new Date() }).where(eq(liveRooms.id, room.id)).returning();
          return json({ ok: true, room: ended, message: `Live ended: ${ended.viewerCount} viewers, peak ${ended.peakViewers}, ${ended.totalCoins} coins` });
        }

        return jsonError("Invalid action", 400);
      }, { rateLimit: { limit: 20, key: ({ caller }) => `live:POST:${caller?.id}` } }),

      DELETE: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        await db.update(liveRooms).set({ status: "ended", endedAt: new Date() }).where(and(eq(liveRooms.hostId, user.id), eq(liveRooms.status, "live")));
        return json({ ok: true, ended: true });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `live:DELETE:${caller?.id}` } }),
    },
  },
});
