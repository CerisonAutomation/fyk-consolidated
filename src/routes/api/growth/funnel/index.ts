import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { analyticsFunnel } from "#/schema";
import { trackFunnelStep, getFunnelProgress, FUNNEL_STEPS } from "#/lib/growth";

const stepSchema = z.object({ step: z.string().min(1).max(50), metadata: z.record(z.string(), z.any()).optional() });

export const Route = createFileRoute("/api/growth/funnel/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const steps = await db.select().from(analyticsFunnel).where(eq(analyticsFunnel.userId, user.id));
        const progress = getFunnelProgress(steps as any);
        return json({ steps, progress, count: steps.length, funnel: [...FUNNEL_STEPS] });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `funnel:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, stepSchema, 2*1024);
        const existing = await db.select().from(analyticsFunnel).where(eq(analyticsFunnel.userId, user.id));
        if (existing.some(s => s.step === body.step)) return json({ ok: true, alreadyTracked: true, step: body.step });
        const event = trackFunnelStep(user.id, body.step as any, body.metadata);
        const [created] = await db.insert(analyticsFunnel).values({ userId: user.id, step: body.step, metadata: body.metadata as any }).returning();
        return json({ ok: true, step: created, event }, { status: 201 });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `funnel:POST:${caller?.id}` } }),
    },
  },
});
