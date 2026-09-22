import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { photoScores, photoEnhancements, aiConversations } from "@/schema";
import { scorePhoto, enhancePhoto, suggestPhotoOrder } from "@/domains/ai/heuristic/photo-enhance";

const scoreSchema = z.object({ urls: z.array(z.string().url()).min(1).max(10) });
const enhanceSchema = z.object({ url: z.string().url(), adjustments: z.object({ brightness: z.number().min(-100).max(100).optional(), contrast: z.number().min(-100).max(100).optional(), crop: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional() }) });

export const Route = createFileRoute("/api/ai/photo-enhance/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "scores";
        if (action === "scores") {
          const scores = await db.select().from(photoScores).where(eq(photoScores.userId, user.id)).orderBy(desc(photoScores.createdAt)).limit(20);
          return json({ scores, count: scores.length });
        }
        if (action === "order") {
          const photosParam = url.searchParams.get("photos");
          const urls = photosParam ? JSON.parse(photosParam) : [];
          if (!Array.isArray(urls) || urls.length === 0) return jsonError("photos required", 400);
          const result = suggestPhotoOrder(urls);
          return json(result);
        }
        return jsonError("Invalid action", 400);
      }, { rateLimit: { limit: 30, key: ({ caller }) => `photo-enhance:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "score";
        if (action === "score") {
          const body = await readJson(request, scoreSchema, 4*1024);
          const scores = body.urls.map(u => scorePhoto(u));
          for (const s of scores) {
            await db.insert(photoScores).values({ userId: user.id, url: s.url, quality: s.quality, lighting: s.lighting, blur: s.blur, smile: s.smile, background: s.background, appeal: s.appeal, issues: s.issues as any, suggestions: s.suggestions as any });
          }
          await db.insert(aiConversations).values({ userId: user.id, type: "photo_enhance", input: { urls: body.urls }, output: { scores }, model: "heuristic" });
          const ordered = suggestPhotoOrder(body.urls);
          return json({ ok: true, scores, ordered, explainability: "Scored by lighting, blur, smile, background — ordered by predicted appeal" });
        }
        if (action === "enhance") {
          const body = await readJson(request, enhanceSchema, 4*1024);
          const result = enhancePhoto(body.url, body.adjustments);
          const [saved] = await db.insert(photoEnhancements).values({ userId: user.id, originalUrl: result.originalUrl, enhancedUrl: result.enhancedUrl, adjustments: result.adjustments as any, allowed: result.allowed, blockedReason: result.blockedReason }).returning();
          if (!result.allowed) return jsonError(result.blockedReason ?? "Blocked alteration", 400);
          return json({ ok: true, enhancement: saved, explainability: "Only safe adjustments: brightness, contrast, crop — identity features blocked" });
        }
        return jsonError("Invalid action", 400);
      }, { rateLimit: { limit: 20, key: ({ caller }) => `photo-enhance:POST:${caller?.id}` } }),
    },
  },
});

