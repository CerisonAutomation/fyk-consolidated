import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { consumablesCatalog, consumablesInventory, wallet, walletTransactions } from "#/schema";
import { CONSUMABLE_PRICES } from "#/lib/monetization";

const purchaseSchema = z.object({ sku: z.string().min(1).max(50), quantity: z.number().int().min(1).max(10).default(1), idempotencyKey: z.string().uuid().optional() });

export const Route = createFileRoute("/api/monetization/consumables/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const catalog = await db.select().from(consumablesCatalog);
        const inventory = await db.select().from(consumablesInventory).where(eq(consumablesInventory.userId, user.id));
        return json({ catalog: catalog.length > 0 ? catalog : Object.entries(CONSUMABLE_PRICES).map(([sku, price]) => ({ sku, name: sku, priceCoins: price, type: sku.split("_")[0], quantity: 1, active: true })), inventory, count: catalog.length });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `cons:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, purchaseSchema, 2*1024);
        const [item] = await db.select().from(consumablesCatalog).where(eq(consumablesCatalog.sku, body.sku)).limit(1);
        const price = item?.priceCoins ?? (CONSUMABLE_PRICES as any)[body.sku] ?? 100;
        const totalCost = price * body.quantity;
        const [userWallet] = await db.select().from(wallet).where(eq(wallet.userId, user.id)).limit(1);
        if (!userWallet || userWallet.balance < totalCost) return jsonError(`Need ${totalCost} coins`, 402);
        if (body.idempotencyKey) {
          const existing = await db.select().from(walletTransactions).where(eq(walletTransactions.idempotencyKey, body.idempotencyKey)).limit(1);
          if (existing.length > 0) return json({ ok: true, alreadyProcessed: true, transaction: existing[0] });
        }
        await db.insert(consumablesInventory).values({ userId: user.id, type: body.sku, quantity: body.quantity });
        const [tx] = await db.insert(walletTransactions).values({ walletId: userWallet.id, type: "purchase", amount: -totalCost, description: `Purchased ${body.quantity}x ${body.sku}`, source: "consumables", idempotencyKey: body.idempotencyKey }).returning();
        return json({ ok: true, transaction: tx, cost: totalCost, remaining: userWallet.balance - totalCost }, { status: 201 });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `cons:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const sku = url.searchParams.get("sku");
        if (!sku) return jsonError("sku required", 400);
        const [inv] = await db.select().from(consumablesInventory).where(eq(consumablesInventory.userId, user.id)).limit(1);
        if (!inv || (inv.quantity ?? 0) <= 0) return jsonError("Not enough inventory", 400);
        await db.update(consumablesInventory).set({ quantity: (inv.quantity ?? 1) - 1 }).where(eq(consumablesInventory.id, inv.id));
        return json({ ok: true, consumed: sku, remaining: (inv.quantity ?? 1) - 1 });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `cons:DELETE:${caller?.id}` } }),
    },
  },
});

