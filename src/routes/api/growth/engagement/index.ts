import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, requireCaller } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { engagementNudges, notifications } from "#/schema";
import { shouldSendNudge } from "#/lib/growth";

export const Route = createFileRoute("/api/growth/engagement/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const nudges = await db.select().from(engagementNudges).where(eq(engagementNudges.userId, user.id)).orderBy(desc(engagementNudges.sentAt)).limit(20);
        const unread = await db.select().from(notifications).where(eq(notifications.userId, user.id)).limit(100);
        return json({ nudges, count: nudges.length, unreadCount: unread.filter(n => !n.read).length, shouldNudge: shouldSendNudge(nudges as any, { maxPerDay: 3, quietHours: { start: 22, end: 8 } }) });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `eng:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await request.json();
        const existing = await db.select().from(engagementNudges).where(eq(engagementNudges.userId, user.id)).limit(20);
        const canSend = shouldSendNudge(existing as any, { maxPerDay: 3, quietHours: { start: 22, end: 8 } });
        if (!canSend) return json({ ok: false, reason: "Rate limited or quiet hours" });
        const [nudge] = await db.insert(engagementNudges).values({ userId: user.id, type: body.type ?? "new_admirers", title: body.title ?? "3 new admirers", body: body.body ?? "You have new admirers waiting!", href: body.href ?? "/likes-you" }).returning();
        return json({ ok: true, nudge }, { status: 201 });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `eng:POST:${caller?.id}` } }),
    },
  },
});
