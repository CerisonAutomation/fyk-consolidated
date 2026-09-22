import { createFileRoute } from "@tanstack/react-router";
import { eq, and } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { translationCache, aiConversations } from "#/schema";
import { translateText, detectLanguage, SUPPORTED_LANGUAGES } from "#/domains/ai/heuristic/translation-realtime";

const translateSchema = z.object({ text: z.string().min(1).max(5000), targetLang: z.string().min(2).max(10), sourceLang: z.string().min(2).max(10).optional() });
const batchSchema = z.object({ messages: z.array(z.object({ id: z.string(), text: z.string().min(1).max(5000) })).min(1).max(20), targetLang: z.string().min(2).max(10) });

export const Route = createFileRoute("/api/ai/translation/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller }) => {
        requireCaller(caller);
        return json({ supported: SUPPORTED_LANGUAGES, count: SUPPORTED_LANGUAGES.length });
      }, { rateLimit: { limit: 60, key: ({ caller }) => `trans:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "translate";
        if (action === "detect") {
          const body = await readJson(request, z.object({ text: z.string().min(1).max(5000) }), 8*1024);
          const detected = detectLanguage(body.text);
          return json({ detected, explainability: "Heuristic detection: charset + keywords — production uses fasttext/cld3" });
        }
        if (action === "batch") {
          const body = await readJson(request, batchSchema, 16*1024);
          const results = body.messages.map(m => translateText(m.text, body.targetLang));
          for (const r of results) {
            const existing = await db.select().from(translationCache).where(and(eq(translationCache.sourceText, r.original), eq(translationCache.sourceLang, r.sourceLang), eq(translationCache.targetLang, r.targetLang))).limit(1);
            if (existing.length === 0) {
              await db.insert(translationCache).values({ sourceText: r.original, sourceLang: r.sourceLang, targetLang: r.targetLang, translatedText: r.translated, model: r.model, confidence: r.confidence });
            }
          }
          return json({ results, count: results.length, explainability: "On-device for top 8 langs, server fallback for others" });
        }
        const body = await readJson(request, translateSchema, 8*1024);
        const cached = await db.select().from(translationCache).where(and(eq(translationCache.sourceText, body.text), eq(translationCache.targetLang, body.targetLang))).limit(1);
        if (cached.length > 0) {
          return json({ result: { original: cached[0].sourceText, translated: cached[0].translatedText, sourceLang: cached[0].sourceLang, targetLang: cached[0].targetLang, confidence: cached[0].confidence, model: cached[0].model }, cached: true });
        }
        const result = translateText(body.text, body.targetLang);
        await db.insert(translationCache).values({ sourceText: result.original, sourceLang: result.sourceLang, targetLang: result.targetLang, translatedText: result.translated, model: result.model, confidence: result.confidence });
        await db.insert(aiConversations).values({ userId: user.id, type: "translation", input: { text: body.text, targetLang: body.targetLang }, output: result as any, model: result.model });
        return json({ result, cached: false, explainability: "In-line per bubble, auto source detection, see original toggle" });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `trans:POST:${caller?.id}` } }),
    },
  },
});

