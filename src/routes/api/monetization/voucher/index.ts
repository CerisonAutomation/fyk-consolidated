import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { vouchers } from "#/schema";

const redeemSchema = z.object({ code: z.string().min(3).max(50) });

export const Route = createFileRoute("/api/monetization/voucher/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller }) => {
        requireCaller(caller);
        const all = await db.select().from(vouchers).orderBy(desc(vouchers.createdAt)).limit(20);
        return json({ vouchers: all, count: all.length, valid: all.filter(v => new Date(v.expiresAt).getTime() > Date.now() && v.usedCount < v.maxUses) });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `voucher:GET:${caller?.id}` } }),

      POST: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const body = await readJson(request, redeemSchema, 2*1024);
        const [voucher] = await db.select().from(vouchers).where(eq(vouchers.code, body.code.toUpperCase())).limit(1);
        if (!voucher) return jsonError("Invalid voucher code", 404);
        if (new Date(voucher.expiresAt).getTime() < Date.now()) return jsonError("Voucher expired", 400);
        if (voucher.usedCount >= voucher.maxUses) return jsonError("Voucher max uses reached", 400);
        const [updated] = await db.update(vouchers).set({ usedCount: voucher.usedCount + 1 }).where(eq(vouchers.id, voucher.id)).returning();
        return json({ ok: true, voucher: updated, discount: voucher.discountPercent, freeDays: voucher.freeDays, message: voucher.freeDays ? `Redeemed ${voucher.freeDays} free days!` : `Redeemed ${voucher.discountPercent}% off!` }, { status: 201 });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `voucher:POST:${caller?.id}` } }),
    },
  },
});
