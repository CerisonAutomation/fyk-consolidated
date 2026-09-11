import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Prisma Mock Factory ────────────────────────────────────────────────────

function createMockDb() {
  const walletStore = new Map<string, { id: string; userId: string; balance: number; lifetime: number }>();
  const txStore: Array<{ walletId: string; userId: string; type: string; amount: number; balance: number; description: string; referenceId?: string; createdAt: Date }> = [];
  const consumablesStore = new Map<string, { userId: string; itemKey: string; quantity: number; expiresAt: Date | null }>();
  const subscriptionStore = new Map<string, { id: string; userId: string; plan: string; tier: string; status: string; expiresAt: Date | null; canceledAt?: Date; autoRenew?: boolean }>();

  let txIdCounter = 0;
  let walletIdCounter = 0;
  let subIdCounter = 0;

  const db = {
    wallet: {
      findUnique: vi.fn(async ({ where }: { where: { userId: string } }) => {
        return walletStore.get(where.userId) ?? null;
      }),
      create: vi.fn(async ({ data }: { data: { userId: string; balance: number; lifetime: number } }) => {
        const id = `wallet_${++walletIdCounter}`;
        const wallet = { id, ...data };
        walletStore.set(data.userId, wallet);
        return wallet;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        for (const w of walletStore.values()) {
          if (w.id === where.id) {
            if (typeof data.balance === "number") w.balance = data.balance;
            if (typeof data.lifetime === "number") w.lifetime = data.lifetime;
            return w;
          }
        }
        throw new Error("Wallet not found");
      }),
    },
    walletTransaction: {
      findFirst: vi.fn(async ({ where }: { where: { walletId: string; type: string; description: string; createdAt: { gte: Date } } }) => {
        return txStore.find(
          (tx) =>
            tx.walletId === where.walletId &&
            tx.type === where.type &&
            tx.description === where.description &&
            tx.createdAt >= where.createdAt.gte,
        ) ?? null;
      }),
      create: vi.fn(async ({ data }: { data: Omit<typeof txStore[number], "id" | "createdAt"> }) => {
        const tx = { id: `tx_${++txIdCounter}`, ...data, createdAt: new Date() };
        txStore.push(tx);
        return tx;
      }),
    },
    consumablesInventory: {
      upsert: vi.fn(async ({ where, create, update }: { where: { userId_itemKey: { userId: string; itemKey: string } }; create: { userId: string; itemKey: string; quantity: number }; update: { quantity: { increment: number } } }) => {
        const key = `${where.userId_itemKey.userId}:${where.userId_itemKey.itemKey}`;
        const existing = consumablesStore.get(key);
        if (existing) {
          existing.quantity += update.quantity.increment;
          return existing;
        }
        const item = { ...create, expiresAt: null };
        consumablesStore.set(key, item);
        return item;
      }),
    },
    subscription: {
      findFirst: vi.fn(async ({ where }: { where: { userId: string; status: string } }) => {
        for (const sub of subscriptionStore.values()) {
          if (sub.userId === where.userId && sub.status === where.status) return sub;
        }
        return null;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { userId: string; status: string }; data: Record<string, unknown> }) => {
        let count = 0;
        for (const sub of subscriptionStore.values()) {
          if (sub.userId === where.userId && sub.status === where.status) {
            Object.assign(sub, data);
            count++;
          }
        }
        return { count };
      }),
      create: vi.fn(async ({ data }: { data: { userId: string; plan: string; tier: string; status: string; expiresAt: Date } }) => {
        const id = `sub_${++subIdCounter}`;
        const sub = { id, ...data };
        subscriptionStore.set(id, sub);
        return sub;
      }),
    },
    user: {
      update: vi.fn(async () => ({})),
    },
    // Prisma $transaction receives an array of already-invoked promises
    $transaction: vi.fn(async (promises: Promise<unknown>[]) => {
      const results: unknown[] = [];
      for (const p of promises) {
        results.push(await p);
      }
      return results;
    }),
  };

  return db as unknown as import("@prisma/client").PrismaClient;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("wallet", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  describe("buyItem (canAfford check)", () => {
    it("deducts bones when balance is sufficient", async () => {
      const { buyItem, ensureWallet } = await import("../../../domains/economy/wallet");

      await ensureWallet(db, "user1");
      const wallet = await (db as any).wallet.findUnique({ where: { userId: "user1" } });
      wallet.balance = 100;

      // tap_boost costs 50 bones
      const result = await buyItem(db, "user1", "tap_boost");

      expect(result.success).toBe(true);
      expect(result.balance).toBe(50);
    });

    it("rejects purchase when balance is insufficient", async () => {
      const { ensureWallet, buyItem } = await import("../../../domains/economy/wallet");

      await ensureWallet(db, "user2");
      const wallet = await (db as any).wallet.findUnique({ where: { userId: "user2" } });
      wallet.balance = 10; // boost costs 120

      const result = await buyItem(db, "user2", "boost");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Insufficient bones");
      expect(result.balance).toBe(10);
    });

    it("returns error for nonexistent item", async () => {
      const { buyItem } = await import("../../../domains/economy/wallet");

      const result = await buyItem(db, "user3", "nonexistent_item");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Item not found");
    });
  });

  describe("dailyReward (calculateDailyReward)", () => {
    it("returns 15 bones on first daily claim", async () => {
      const { ensureWallet, dailyReward } = await import("../../../domains/economy/wallet");

      await ensureWallet(db, "user_daily");
      const wallet = await (db as any).wallet.findUnique({ where: { userId: "user_daily" } });
      wallet.balance = 50;

      const result = await dailyReward(db, "user_daily");

      expect(result.success).toBe(true);
      expect(result.balance).toBe(65); // 50 + 15
    });

    it("prevents double-claiming on the same day", async () => {
      const { ensureWallet, dailyReward } = await import("../../../domains/economy/wallet");

      await ensureWallet(db, "user_double");
      const wallet = await (db as any).wallet.findUnique({ where: { userId: "user_double" } });
      wallet.balance = 50;

      const first = await dailyReward(db, "user_double");
      expect(first.success).toBe(true);

      const second = await dailyReward(db, "user_double");
      expect(second.success).toBe(false);
      expect(second.error).toBe("Already claimed today");
    });
  });

  describe("subscription tiers (calculateTierBenefits)", () => {
    it("free tier has no perks and costs 0", async () => {
      const { SUBSCRIPTION_TIERS } = await import("../../../domains/economy/subscriptions");

      const free = SUBSCRIPTION_TIERS.free;
      expect(free.price).toBe(0);
      expect(free.perks).toHaveLength(0);
    });

    it("plus tier has 5 perks and costs 9.99", async () => {
      const { SUBSCRIPTION_TIERS } = await import("../../../domains/economy/subscriptions");

      const plus = SUBSCRIPTION_TIERS.plus;
      expect(plus.price).toBe(9.99);
      expect(plus.perks.length).toBeGreaterThanOrEqual(5);
      expect(plus.perks.some((p: { key: string }) => p.key === "unlimited_likes")).toBe(true);
    });

    it("gold tier adds extras over plus", async () => {
      const { SUBSCRIPTION_TIERS } = await import("../../../domains/economy/subscriptions");

      const gold = SUBSCRIPTION_TIERS.gold;
      expect(gold.price).toBe(19.99);
      expect(gold.perks.length).toBeGreaterThan(SUBSCRIPTION_TIERS.plus.perks.length);
      expect(gold.perks.some((p: { key: string }) => p.key === "travel_mode")).toBe(true);
    });

    it("platinum tier has all perks", async () => {
      const { SUBSCRIPTION_TIERS } = await import("../../../domains/economy/subscriptions");

      const platinum = SUBSCRIPTION_TIERS.platinum;
      expect(platinum.price).toBe(29.99);
      expect(platinum.perks.length).toBeGreaterThanOrEqual(10);
      expect(platinum.perks.some((p: { key: string }) => p.key === "concierge")).toBe(true);
    });
  });
});
