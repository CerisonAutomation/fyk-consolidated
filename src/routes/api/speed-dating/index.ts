import { createFileRoute } from "@tanstack/react-router";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { speedDatingEvents, speedDatingParticipants } from "@/schema";

const joinSchema = z.object({ eventId: z.string().uuid() });

export const Route = createFileRoute("/api/speed-dating/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const eventId = url.searchParams.get("eventId");
        if (eventId) {
          const [event] = await db.select().from(speedDatingEvents).where(eq(speedDatingEvents.id, eventId)).limit(1);
          if (!event) return jsonError("Event not found", 404);
          const participants = await db.select().from(speedDatingParticipants).where(eq(speedDatingParticipants.eventId, eventId));
          const myParticipation = participants.find(p => p.userId === user.id);
          return json({ event, participants, myParticipation, count: participants.length });
        }
        const events = await db.select().from(speedDatingEvents).orderBy(desc(speedDatingEvents.startsAt)).limit(20);
        const myParticipations = await db.select().from(speedDatingParticipants).where(eq(speedDatingParticipants.userId, user.id));
        return json({ events, myParticipations, count: events.length, upcoming: events.filter(e => e.status === "scheduled") });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `speed:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "join";
        if (action === "join") {
          const body = await readJson(request, joinSchema, 2*1024);
          const [event] = await db.select().from(speedDatingEvents).where(eq(speedDatingEvents.id, body.eventId)).limit(1);
          if (!event) return jsonError("Event not found", 404);
          if (event.status !== "scheduled" && event.status !== "live") return jsonError("Event not joinable", 400);
          const participants = await db.select().from(speedDatingParticipants).where(eq(speedDatingParticipants.eventId, body.eventId));
          if (participants.length >= event.maxParticipants) return jsonError("Event full", 400);
          if (participants.some(p => p.userId === user.id)) return jsonError("Already joined", 400);
          const [participation] = await db.insert(speedDatingParticipants).values({ eventId: body.eventId, userId: user.id, round: 1, status: "waiting" }).returning();
          return json({ ok: true, participation, message: `Joined ${event.title}, waiting for round` }, { status: 201 });
        }
        if (action === "next_round") {
          const body = await readJson(request, joinSchema, 2*1024);
          const [myPart] = await db.select().from(speedDatingParticipants).where(and(eq(speedDatingParticipants.eventId, body.eventId), eq(speedDatingParticipants.userId, user.id))).limit(1);
          if (!myPart) return jsonError("Not a participant", 404);
          const [updated] = await db.update(speedDatingParticipants).set({ round: myPart.round + 1, status: "in_round" }).where(eq(speedDatingParticipants.id, myPart.id)).returning();
          return json({ ok: true, participation: updated, message: `Round ${updated.round} started` });
        }
        return jsonError("Invalid action", 400);
      }, { rateLimit: { limit: 20, key: ({ caller }) => `speed:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const eventId = url.searchParams.get("eventId");
        if (!eventId) return jsonError("eventId required", 400);
        await db.delete(speedDatingParticipants).where(and(eq(speedDatingParticipants.eventId, eventId), eq(speedDatingParticipants.userId, user.id)));
        return json({ ok: true, left: eventId });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `speed:DELETE:${caller?.id}` } }),
    },
  },
});

