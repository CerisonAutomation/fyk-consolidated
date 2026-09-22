import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, requireCaller } from "@/lib/api-helpers";
import { json, withSecurity } from "@/middleware";
import { privacyReports, footprints, blocks } from "@/schema";
import { generatePrivacyReport } from "@/lib/privacy-report";

export const Route = createFileRoute("/api/profile/privacy-report/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const period = url.searchParams.get("period") ?? "month";
        const now = new Date();
        const from = new Date(now);
        if (period === "month") from.setMonth(from.getMonth()-1);
        else if (period === "week") from.setDate(from.getDate()-7);
        else from.setFullYear(from.getFullYear()-1);

        const reports = await db.select().from(privacyReports).where(eq(privacyReports.userId, user.id)).orderBy(desc(privacyReports.generatedAt)).limit(12);
        const views = await db.select().from(footprints).where(eq(footprints.visitedId, user.id)).limit(1000);
        const blocked = await db.select().from(blocks).where(eq(blocks.blockerId, user.id)).limit(1000);

        const report = generatePrivacyReport({
          userId: user.id,
          from: from.toISOString(),
          to: now.toISOString(),
          profileViews: views.length,
          uniqueViewers: new Set(views.map(v => v.visitorId)).size,
          blockedCount: blocked.length,
          blockedIds: blocked.map(b => b.blockedId),
          logins: 42,
          messagesSent: 120,
          tapsSent: 30,
          photosUploaded: 5,
          exportsCount: reports.length,
          lastExportAt: reports[0]?.generatedAt?.toString(),
        });

        return json({ report, history: reports, period });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `privacy:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const now = new Date();
        const from = new Date(now); from.setMonth(from.getMonth()-1);
        const views = await db.select().from(footprints).where(eq(footprints.visitedId, user.id)).limit(1000);
        const blocked = await db.select().from(blocks).where(eq(blocks.blockerId, user.id)).limit(1000);
        const report = generatePrivacyReport({
          userId: user.id,
          from: from.toISOString(),
          to: now.toISOString(),
          profileViews: views.length,
          uniqueViewers: new Set(views.map(v => v.visitorId)).size,
          blockedCount: blocked.length,
          blockedIds: blocked.map(b => b.blockedId),
          logins: 42,
          messagesSent: 120,
          tapsSent: 30,
          photosUploaded: 5,
          exportsCount: 0,
        });
        const [created] = await db.insert(privacyReports).values({
          userId: user.id,
          periodFrom: from.toISOString().split("T")[0],
          periodTo: now.toISOString().split("T")[0],
          profileViews: report.profileViews.count,
          uniqueViewers: report.profileViews.unique,
          blockedCount: report.blocked.count,
          dataUsage: report.dataUsage as any,
          activity: report.activity as any,
        }).returning();
        return json({ ok: true, report: created }, { status: 201 });
      }, { rateLimit: { limit: 5, key: ({ caller }) => `privacy:POST:${caller?.id}` } }),
    },
  },
});

