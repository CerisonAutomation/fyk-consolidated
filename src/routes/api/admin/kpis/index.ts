import { createFileRoute } from "@tanstack/react-router";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, requireCaller } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { blocks, conversations, favorites, footprints, messages, notifications, taps, users } from "@/schema";

/**
 * Admin KPIs Dashboard — D10.5, D13.11
 * 27 counters (users, online, verified, banned, gold+, reports, etc.)
 */

export const Route = createFileRoute("/api/admin/kpis/")({
  server: {
    handlers: {
      POST: methodNotAllowed("GET"),
      PUT: methodNotAllowed("GET"),
      PATCH: methodNotAllowed("GET"),
      DELETE: methodNotAllowed("GET"),

      GET: withSecurity(
        async ({ caller }) => {
          const user = requireCaller(caller);

          const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, user.id)).limit(1);
          if (me?.role !== "admin") {
            return jsonError("Admin only", 403);
          }

          const [
            totalUsers,
            onlineUsers,
            verifiedUsers,
            suspendedUsers,
            plusUsers,
            goldUsers,
            platinumUsers,
            totalTaps,
            totalMatches,
            totalConversations,
            totalMessages,
            totalBlocks,
            totalFavorites,
            totalFootprints,
            totalNotifications,
          ] = await Promise.all([
            db.select({ count: count() }).from(users),
            db.select({ count: count() }).from(users).where(eq(users.online, true)),
            db.select({ count: count() }).from(users).where(eq(users.verification, 2)),
            db.select({ count: count() }).from(users).where(eq(users.isSuspended, true)),
            db.select({ count: count() }).from(users).where(eq(users.tier, "plus")),
            db.select({ count: count() }).from(users).where(eq(users.tier, "gold")),
            db.select({ count: count() }).from(users).where(eq(users.tier, "platinum")),
            db.select({ count: count() }).from(taps),
            db.select({ count: count() }).from(users).where(sql`id in (select user_a from matches union select user_b from matches)`),
            db.select({ count: count() }).from(conversations),
            db.select({ count: count() }).from(messages),
            db.select({ count: count() }).from(blocks),
            db.select({ count: count() }).from(favorites),
            db.select({ count: count() }).from(footprints),
            db.select({ count: count() }).from(notifications),
          ]);

          // Three numbers here used to be constants: `avgTrustScore: 65`,
          // `reports: 0`, `pendingVerifications: 0`, each with a comment saying a query
          // would be needed. An operator dashboard that reports a fixed 0 for open
          // reports is worse than one that omits the number — it reads as "queue empty".
          const [trustRow] = (await db.execute(sql`
            select coalesce(round(avg(trust_score))::int, 0) as avg_trust
              from public.users
          `)) as unknown as { avg_trust: number }[];

          const [openReportsRow] = (await db.execute(sql`
            select count(*)::int as open_reports
              from public.reports
             where status in ('open','in_review')
          `)) as unknown as { open_reports: number }[];

          const [pendingVerificationRow] = (await db.execute(sql`
            select count(*)::int as pending_verifications
              from public.verification_requests
             where status = 'pending'
               and expires_at > now()
          `)) as unknown as { pending_verifications: number }[];

          const kpis = {
            users: {
              total: totalUsers[0]?.count ?? 0,
              online: onlineUsers[0]?.count ?? 0,
              verified: verifiedUsers[0]?.count ?? 0,
              suspended: suspendedUsers[0]?.count ?? 0,
              banned: suspendedUsers[0]?.count ?? 0,
            },
            tiers: {
              free: (totalUsers[0]?.count ?? 0) - (plusUsers[0]?.count ?? 0) - (goldUsers[0]?.count ?? 0) - (platinumUsers[0]?.count ?? 0),
              plus: plusUsers[0]?.count ?? 0,
              gold: goldUsers[0]?.count ?? 0,
              platinum: platinumUsers[0]?.count ?? 0,
              paid: (plusUsers[0]?.count ?? 0) + (goldUsers[0]?.count ?? 0) + (platinumUsers[0]?.count ?? 0),
            },
            engagement: {
              taps: totalTaps[0]?.count ?? 0,
              matches: totalMatches[0]?.count ?? 0,
              conversations: totalConversations[0]?.count ?? 0,
              messages: totalMessages[0]?.count ?? 0,
              blocks: totalBlocks[0]?.count ?? 0,
              favorites: totalFavorites[0]?.count ?? 0,
              footprints: totalFootprints[0]?.count ?? 0,
            },
            system: {
              notifications: totalNotifications[0]?.count ?? 0,
              avgTrustScore: Number(trustRow?.avg_trust ?? 0),
              // Open *and* in-review: both are work a moderator still has to do.
              reports: Number(openReportsRow?.open_reports ?? 0),
              pendingVerifications: Number(pendingVerificationRow?.pending_verifications ?? 0),
            },
            timestamp: new Date().toISOString(),
          };

          return json(kpis);
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `kpis:${caller?.id}` } },
      ),
    },
  },
});
