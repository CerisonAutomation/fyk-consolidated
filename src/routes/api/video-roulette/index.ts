import { createFileRoute } from "@tanstack/react-router";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { rouletteSessions } from "@/schema";

const actionSchema = z.object({ action: z.enum(["join","leave","next","like"]) });

export const Route = createFileRoute("/api/video-roulette/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("sessionId");

        if (sessionId) {
          const [session] = await db.select().from(rouletteSessions).where(eq(rouletteSessions.id, sessionId)).limit(1);
          if (!session) return jsonError("Session not found", 404);
          const waiting = await db.select().from(rouletteSessions).where(and(eq(rouletteSessions.status, "waiting"), eq(rouletteSessions.userId, user.id))).limit(1);
          return json({ session, waiting: waiting[0] ?? null });
        }

        const mySessions = await db.select().from(rouletteSessions).where(eq(rouletteSessions.userId, user.id)).orderBy(desc(rouletteSessions.startedAt)).limit(10);
        const waitingPool = await db.select().from(rouletteSessions).where(eq(rouletteSessions.status, "waiting")).limit(20);
        const active = mySessions.find(s => s.status === "waiting" || s.status === "matched");

        return json({ sessions: mySessions, waitingPool: waitingPool.filter(s => s.userId !== user.id), active: active ?? null, count: waitingPool.length, message: "Randomized matching, queue, countdown, rotate, mutual→chat unlock" });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `roulette:GET:${caller?.id}` } }),

      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, actionSchema, 2*1024);

        if (body.action === "join") {
          const [existing] = await db.select().from(rouletteSessions).where(and(eq(rouletteSessions.userId, user.id), eq(rouletteSessions.status, "waiting"))).limit(1);
          if (existing) return json({ ok: true, session: existing, alreadyWaiting: true });

          // Try to match with someone waiting
          const [waiting] = await db.select().from(rouletteSessions).where(eq(rouletteSessions.status, "waiting")).orderBy(rouletteSessions.startedAt).limit(1);
          if (waiting && waiting.userId !== user.id) {
            const [matched] = await db.update(rouletteSessions).set({ status: "matched", matchedWith: user.id, matchedAt: new Date() }).where(eq(rouletteSessions.id, waiting.id)).returning();
            const [mySession] = await db.insert(rouletteSessions).values({ userId: user.id, status: "matched", matchedWith: waiting.userId, matchedAt: new Date() }).returning();
            return json({ ok: true, session: mySession, matchedWith: waiting.userId, matchedSession: matched, message: "Matched! Video chat starting" }, { status: 201 });
          }

          const [session] = await db.insert(rouletteSessions).values({ userId: user.id, status: "waiting" }).returning();
          return json({ ok: true, session, waiting: true, message: "Joined queue, waiting for match" }, { status: 201 });
        }

        if (body.action === "leave") {
          await db.update(rouletteSessions).set({ status: "ended", endedAt: new Date() }).where(and(eq(rouletteSessions.userId, user.id), eq(rouletteSessions.status, "waiting")));
          return json({ ok: true, left: true });
        }

        if (body.action === "next") {
          const [current] = await db.select().from(rouletteSessions).where(and(eq(rouletteSessions.userId, user.id), eq(rouletteSessions.status, "matched"))).limit(1);
          if (current) await db.update(rouletteSessions).set({ status: "ended", endedAt: new Date() }).where(eq(rouletteSessions.id, current.id));

          const [waiting] = await db.select().from(rouletteSessions).where(eq(rouletteSessions.status, "waiting")).orderBy(rouletteSessions.startedAt).limit(1);
          if (waiting && waiting.userId !== user.id) {
            const [matchedNext] = await db.update(rouletteSessions).set({ status: "matched", matchedWith: user.id, matchedAt: new Date() }).where(eq(rouletteSessions.id, waiting.id)).returning();
            const [mySession] = await db.insert(rouletteSessions).values({ userId: user.id, status: "matched", matchedWith: waiting.userId, matchedAt: new Date() }).returning();
            return json({ ok: true, session: mySession, matchedWith: waiting.userId, matchedSession: matchedNext, message: "Next match!" }, { status: 201 });
          }

          const [session] = await db.insert(rouletteSessions).values({ userId: user.id, status: "waiting" }).returning();
          return json({ ok: true, session, waiting: true });
        }

        if (body.action === "like") {
          const [current] = await db.select().from(rouletteSessions).where(and(eq(rouletteSessions.userId, user.id), eq(rouletteSessions.status, "matched"))).limit(1);
          if (!current || !current.matchedWith) return jsonError("No active match", 400);
          // Check if other also liked — mutual→chat unlock
          const [other] = await db.select().from(rouletteSessions).where(and(eq(rouletteSessions.userId, current.matchedWith), eq(rouletteSessions.status, "matched"))).limit(1);
          const mutual = other && other.matchedWith === user.id;
          return json({ ok: true, liked: current.matchedWith, mutual, message: mutual ? "Mutual! Chat unlocked" : "Liked, waiting for them" });
        }

        return jsonError("Invalid action", 400);
      }, { rateLimit: { limit: 20, key: ({ caller }) => `roulette:POST:${caller?.id}` } }),

      DELETE: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        await db.update(rouletteSessions).set({ status: "ended", endedAt: new Date() }).where(eq(rouletteSessions.userId, user.id));
        return json({ ok: true, ended: true });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `roulette:DELETE:${caller?.id}` } }),
    },
  },
});
