/**
 * SubscriptionService — Application layer for wallet & subscription operations.
 *
 * Now backed by Supabase directly via the integration modules.
 * The repository ports are retained for any server-side consumers but the
 * primary flow goes through the Supabase client.
 */

import { getSupabase } from "../../integrations/supabase/client";
import { canAfford } from "../domain/wallet";
import { ok, fail, type Result as DomainResult } from "../domain/errors";
import type { Wallet, Subscription, ShopItem } from "../domain/types";

// ── Shop catalog ─────────────────────────────────────────────────────────────

const SHOP_ITEMS: ShopItem[] = [
  { id: "tap_boost", name: "Tap Boost", emoji: "🚀", description: "Get seen by 5x more kings for 30 min", boneCost: 50, type: "boost" },
  { id: "boost", name: "Profile Boost", emoji: "⚡", description: "Top of the grid for 60 minutes", boneCost: 120, type: "boost" },
  { id: "gift_heart", name: "Heart Gift", emoji: "❤️", description: "Send to a favourite king", boneCost: 20, type: "gift" },
  { id: "gift_fire", name: "Fire Gift", emoji: "🔥", description: "Show serious interest", boneCost: 35, type: "gift" },
  { id: "gift_star", name: "Star Gift", emoji: "⭐", description: "The ultimate flex", boneCost: 60, type: "gift" },
];

const TIER_DEFS = [
  { tier: "plus" as const, name: "Plus", price: "$9.99/mo", perks: ["Unlimited taps", "Advanced filters", "Who viewed you", "25 AI features/day", "No ads"] },
  { tier: "gold" as const, name: "Gold", price: "$19.99/mo", perks: ["Everything in Plus", "Incognito mode", "Unlimited AI", "Video calls", "King Pet premium", "See all taps"] },
  { tier: "platinum" as const, name: "Platinum", price: "$29.99/mo", perks: ["Everything in Gold", "Priority support", "Exclusive events", "10 boosts/month", "Travel mode", "Undo tap"] },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

type WalletRow = { id: string; balance: number; currency: string; created_at: string; updated_at: string };

async function ensureWallet(
  client: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
): Promise<WalletRow> {
  const { data: existing } = await client
    .from("wallet")
    .select("id,balance,currency,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing as WalletRow;

  const { data: created } = await client
    .from("wallet")
    .insert({ user_id: userId, balance: 50, currency: "bones" })
    .select("id,balance,currency,created_at,updated_at")
    .single();

  return created as WalletRow;
}

// ── Service methods ──────────────────────────────────────────────────────────

export class SubscriptionService {
  /**
   * Load wallet data, shop items, tier definitions, and current subscription.
   */
  async getWallet(userId: string): Promise<DomainResult<{
    wallet: Wallet;
    shop: ShopItem[];
    tiers: typeof TIER_DEFS;
    consumables: any[];
    subscription: Subscription | null;
  }>> {
    const client = getSupabase();
    if (!client) return fail("SUPABASE_UNAVAILABLE", "Supabase is not configured");

    try {
      const walletRow = await ensureWallet(client, userId);

      const [, consumablesResult, subResult] = await Promise.all([
        client
          .from("wallet_transactions")
          .select("id,wallet_id,type,amount,description,created_at")
          .eq("wallet_id", walletRow.id)
          .order("created_at", { ascending: false })
          .limit(20),
        client
          .from("consumables_inventory")
          .select("id,user_id,type,quantity,expires_at,created_at")
          .eq("user_id", userId),
        client
          .from("subscriptions")
          .select("id,user_id,tier,stripe_subscription_id,status,current_period_end,created_at,updated_at")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      const wallet: Wallet = {
        id: walletRow.id,
        userId,
        balance: walletRow.balance,
        currency: walletRow.currency,
        createdAt: walletRow.created_at,
        updatedAt: walletRow.updated_at,
      };

      const consumables = (consumablesResult.data ?? []).map((c: any) => ({
        id: c.id,
        userId: c.user_id,
        type: c.type,
        quantity: c.quantity,
        expiresAt: c.expires_at,
        createdAt: c.created_at,
      }));

      const subscription: Subscription | null = subResult.data
        ? {
            id: subResult.data.id,
            userId,
            tier: subResult.data.tier,
            stripeSubscriptionId: subResult.data.stripe_subscription_id ?? undefined,
            status: subResult.data.status,
            currentPeriodEnd: subResult.data.current_period_end ?? undefined,
            createdAt: subResult.data.created_at,
          }
        : null;

      return ok({ wallet, shop: SHOP_ITEMS, tiers: TIER_DEFS, consumables, subscription });
    } catch (e) {
      return fail("WALLET_LOAD_FAILED", e instanceof Error ? e.message : "Failed to load wallet");
    }
  }

  /**
   * Purchase an item from the shop.
   */
  async buyItem(userId: string, itemId: string): Promise<DomainResult<{ balance: number }>> {
    const client = getSupabase();
    if (!client) return fail("SUPABASE_UNAVAILABLE", "Supabase is not configured");

    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) return fail("NOT_FOUND", "Item not found");

    try {
      const walletRow = await ensureWallet(client, userId);
      if (!canAfford(walletRow.balance, item.boneCost)) {
        return fail("INSUFFICIENT_FUNDS", "Not enough bones");
      }

      const newBalance = walletRow.balance - item.boneCost;
      await client
        .from("wallet")
        .update({ balance: newBalance })
        .eq("id", walletRow.id);

      await client.from("wallet_transactions").insert({
        wallet_id: walletRow.id,
        type: "debit",
        amount: item.boneCost,
        description: item.name,
      });

      // Upsert consumable
      const { data: existing } = await client
        .from("consumables_inventory")
        .select("id,quantity")
        .eq("user_id", userId)
        .eq("type", item.type)
        .maybeSingle();

      if (existing) {
        await client
          .from("consumables_inventory")
          .update({ quantity: existing.quantity + 1 })
          .eq("id", existing.id);
      } else {
        await client.from("consumables_inventory").insert({
          user_id: userId,
          type: item.type,
          quantity: 1,
        });
      }

      return ok({ balance: newBalance });
    } catch (e) {
      return fail("PURCHASE_FAILED", e instanceof Error ? e.message : "Failed to purchase");
    }
  }

  /**
   * Claim the daily bone reward (once per day).
   */
  async claimDailyReward(userId: string): Promise<DomainResult<{ balance: number }>> {
    const client = getSupabase();
    if (!client) return fail("SUPABASE_UNAVAILABLE", "Supabase is not configured");

    try {
      const walletRow = await ensureWallet(client, userId);

      // Check if already claimed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: todayTxs } = await client
        .from("wallet_transactions")
        .select("id")
        .eq("wallet_id", walletRow.id)
        .eq("description", "Daily reward")
        .gte("created_at", today.toISOString())
        .limit(1);

      if (todayTxs && todayTxs.length > 0) {
        return fail("ALREADY_CLAIMED", "Already claimed today");
      }

      const reward = 15;
      const newBalance = walletRow.balance + reward;

      await client
        .from("wallet")
        .update({ balance: newBalance })
        .eq("id", walletRow.id);

      await client.from("wallet_transactions").insert({
        wallet_id: walletRow.id,
        type: "credit",
        amount: reward,
        description: "Daily reward",
      });

      return ok({ balance: newBalance });
    } catch (e) {
      return fail("DAILY_REWARD_FAILED", e instanceof Error ? e.message : "Failed to claim daily reward");
    }
  }

  /**
   * Subscribe to a premium tier.
   */
  async subscribe(userId: string, tier: string): Promise<DomainResult<{ tier: string }>> {
    const client = getSupabase();
    if (!client) return fail("SUPABASE_UNAVAILABLE", "Supabase is not configured");

    const def = TIER_DEFS.find((t) => t.tier === tier);
    if (!def) return fail("INVALID_TIER", "Invalid tier");

    try {
      // Delete existing
      await client.from("subscriptions").delete().eq("user_id", userId);

      // Create new (mock payment)
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await client.from("subscriptions").insert({
        user_id: userId,
        tier,
        status: "active",
        current_period_end: periodEnd.toISOString(),
      });

      // Update premium_entitlements
      const { data: existing } = await client
        .from("premium_entitlements")
        .select("profile_id")
        .eq("profile_id", userId)
        .maybeSingle();

      const entitlementUpdate = {
        tier: tier as "free" | "plus",
        source: "mock_payment",
        expires_at: periodEnd.toISOString(),
      };

      if (existing) {
        await client
          .from("premium_entitlements")
          .update(entitlementUpdate)
          .eq("profile_id", userId);
      } else {
        await client.from("premium_entitlements").insert({
          profile_id: userId,
          ...entitlementUpdate,
        });
      }

      return ok({ tier });
    } catch (e) {
      return fail("SUBSCRIBE_FAILED", e instanceof Error ? e.message : "Failed to subscribe");
    }
  }

  /**
   * Cancel the current subscription.
   */
  async cancelSubscription(userId: string): Promise<DomainResult<void>> {
    const client = getSupabase();
    if (!client) return fail("SUPABASE_UNAVAILABLE", "Supabase is not configured");

    try {
      await client.from("subscriptions").delete().eq("user_id", userId);
      await client
        .from("premium_entitlements")
        .update({ tier: "free" as "free" | "plus", source: "cancelled" })
        .eq("profile_id", userId);

      return ok(undefined as void);
    } catch (e) {
      return fail("CANCEL_FAILED", e instanceof Error ? e.message : "Failed to cancel subscription");
    }
  }
}
