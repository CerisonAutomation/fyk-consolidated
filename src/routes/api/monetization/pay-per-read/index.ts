import { createFileRoute } from "@tanstack/react-router";
import { eq, and } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { payPerReadUnlocks, users, wallet, walletTransactions } from "#/schema";

const unlockSchema = z.object({ messageId: z.string().uuid(), idempotencyKey: z.string().uuid().optional() });

export const Route = createFileRoute("/api/monetization/pay-per-read/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const unlocked = await db.select().from(payPerReadUnlocks).where(eq(payPerReadUnlocks.userId, user.id)).limit(50);
        return json({ unlocked, count: unlocked.length, cost: 10 });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `ppr:GET:${caller?.id}` } }),

      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, unlockSchema, 2*1024);

        const [existing] = await db.select().from(payPerReadUnlocks).where(and(eq(payPerReadUnlocks.userId, user.id), eq(payPerReadUnlocks.messageId, body.messageId))).limit(1);
        if (existing) return json({ ok: true, alreadyUnlocked: true, unlock: existing });

        if (body.idempotencyKey) {
          const [tx] = await db.select().from(walletTransactions).where(eq(walletTransactions.idempotencyKey, body.idempotencyKey)).limit(1);
          if (tx) return json({ ok: true, alreadyProcessed: true, transaction: tx });
        }

        const [me] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
        const balance = (me as any)?.coins ?? 0;
        if (balance < 10) return jsonError("Need 10 coins", 402);

        const [userWallet] = await db.select().from(wallet).where(eq(wallet.userId, user.id)).limit(1);
        if (userWallet) {
          await db.insert(walletTransactions).values({ walletId: userWallet.id, type: "purchase", amount: -10, description: `Unlocked message ${body.messageId}`, source: "pay_per_read", idempotencyKey: body.idempotencyKey }).returning();
        }

        const [unlock] = await db.insert(payPerReadUnlocks).values({ userId: user.id, messageId: body.messageId, cost: 10 }).returning();
        return json({ ok: true, unlock, message: "Message unlocked" }, { status: 201 });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `ppr:POST:${caller?.id}` } }),
    },
  },
});
