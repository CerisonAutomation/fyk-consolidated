import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, requireCaller } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { profileStats, profileAnalyticsEvents, footprints, taps, matches, messages } from "#/schema";

export const Route = createFileRoute("/api/profile/stats/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const [stats] = await db.select().from(profileStats).where(eq(profileStats.userId, user.id)).limit(1);
        const views = await db.select().from(footprints).where(eq(footprints.visitedId, user.id)).limit(1000);
        const likesSent = await db.select().from(taps).where(eq(taps.tapperId, user.id)).limit(1000);
        const likesReceived = await db.select().from(taps).where(eq(taps.tappedId, user.id)).limit(1000);
        const matchList = await db.select().from(matches).limit(100);
        const myMatches = matchList.filter(m => m.userA === user.id || m.userB === user.id);
        const msgs = await db.select().from(messages).where(eq(messages.senderId, user.id)).limit(1000);
        const events = await db.select().from(profileAnalyticsEvents).where(eq(profileAnalyticsEvents.userId, user.id)).orderBy(desc(profileAnalyticsEvents.createdAt)).limit(50);
        const replyRate = stats?.replyRate ?? (likesReceived.length > 0 ? Math.min(1, msgs.length / likesReceived.length) : 0);
        const bestHour = stats?.bestReplyHour ?? 19;
        return json({
          stats: stats ?? { viewsTotal: views.length, viewsUnique: new Set(views.map(v => v.visitorId)).size, likesSent: likesSent.length, likesReceived: likesReceived.length, matchesTotal: myMatches.length, messagesSent: msgs.length, replyRate, bestReplyHour: bestHour, updatedAt: new Date().toISOString() },
          analytics: { views, likesSent: likesSent.length, likesReceived: likesReceived.length, matches: myMatches.length, replyRate, bestPhoto: stats?.bestPhotoUrl, bestHour },
          events,
          insights: [
            `${views.length} profile views, ${new Set(views.map(v => v.visitorId)).size} unique`,
            `${likesReceived.length} likes received, ${likesSent.length} sent`,
            `${myMatches.length} matches`,
            `Reply rate: ${Math.round(replyRate*100)}%`,
            `Best time to be active: ${bestHour}:00`,
          ],
          explainability: "Private analytics: views, like/match rate, reply rate, best photo, best reply time"
        });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `stats:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const views = await db.select().from(footprints).where(eq(footprints.visitedId, user.id)).limit(1000);
        const likesSent = await db.select().from(taps).where(eq(taps.tapperId, user.id)).limit(1000);
        const likesReceived = await db.select().from(taps).where(eq(taps.tappedId, user.id)).limit(1000);
        const matchList = await db.select().from(matches).limit(100);
        const myMatches = matchList.filter(m => m.userA === user.id || m.userB === user.id);
        const msgs = await db.select().from(messages).where(eq(messages.senderId, user.id)).limit(1000);
        const [existing] = await db.select().from(profileStats).where(eq(profileStats.userId, user.id)).limit(1);
        const newStats = { viewsTotal: views.length, viewsUnique: new Set(views.map(v => v.visitorId)).size, likesSent: likesSent.length, likesReceived: likesReceived.length, matchesTotal: myMatches.length, messagesSent: msgs.length, replyRate: likesReceived.length > 0 ? Math.min(1, msgs.length / likesReceived.length) : 0, updatedAt: new Date() };
        if (!existing) {
          const [created] = await db.insert(profileStats).values({ userId: user.id, ...newStats }).returning();
          return json({ ok: true, stats: created }, { status: 201 });
        }
        const [updated] = await db.update(profileStats).set(newStats).where(eq(profileStats.userId, user.id)).returning();
        return json({ ok: true, stats: updated });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `stats:POST:${caller?.id}` } }),
    },
  },
});

