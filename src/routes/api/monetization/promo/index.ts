import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { promoCodes, promoRedemptions } from "#/schema";

const redeemSchema = z.object({ code: z.string().min(3).max(20) });

export const Route = createFileRoute("/api/monetization/promo/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const redemptions = await db.select().from(promoRedemptions).where(eq(promoRedemptions.userId, user.id)).orderBy(desc(promoRedemptions.redeemedAt)).limit(20);
        // Canonical professional codes — legacy divine codes kept as aliases for compatibility
        return json({ redemptions, count: redemptions.length, available: ["WELCOME15","PREMIUM20","ELITE30","WELCOME10","FYKFREE7"], legacyAliases: ["DIVINE15","TRANSCEND20","GODMODE30"] });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `promo:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, redeemSchema, 2*1024);
        const [promo] = await db.select().from(promoCodes).where(eq(promoCodes.code, body.code.toUpperCase())).limit(1);
        if (!promo) return jsonError("Invalid promo code", 404);
        if (new Date(promo.expiresAt).getTime() < Date.now()) return jsonError("Promo expired", 400);
        if (promo.usedCount >= promo.maxUses) return jsonError("Promo max uses reached", 400);
        const existing = await db.select().from(promoRedemptions).where(eq(promoRedemptions.userId, user.id)).limit(20);
        if (existing.some(r => r.promoId === promo.id)) return jsonError("Already redeemed", 400);
        const [redemption] = await db.insert(promoRedemptions).values({ promoId: promo.id, userId: user.id }).returning();
        await db.update(promoCodes).set({ usedCount: promo.usedCount + 1 }).where(eq(promoCodes.id, promo.id));
        return json({ ok: true, redemption, promo: { code: promo.code, discountPercent: promo.discountPercent, freeDays: promo.freeDays, freeCoins: promo.freeCoins, tier: promo.tier }, message: promo.freeDays ? `Redeemed ${promo.freeDays} free days!` : `Redeemed ${promo.discountPercent}% off!` }, { status: 201 });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `promo:POST:${caller?.id}` } }),
    },
  },
});

