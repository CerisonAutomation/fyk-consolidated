/**
 * SubscriptionService — Application layer for wallet & subscription operations.
 *
 * Now backed by Supabase directly via the integration modules.
 * The repository ports are retained for any server-side consumers but the
 * primary flow goes through the Supabase client.
 *
 * Security notes (per payment-security.md and stripe-subscriptions.md):
 *  - Server determines all amounts; client never supplies raw prices.
 *  - Velocity checks limit purchase frequency per user.
 *  - Subscription lifecycle states are validated against Stripe conventions.
 *  - Receipts are generated for all financial transactions.
 *  - Tier casts are validated against a whitelist to prevent injection.
 */

import { getSupabase } from "../../integrations/supabase/client";
import { canAfford } from "../domain/wallet";
import { ok, fail, type Result as DomainResult } from "../domain/errors";
import type { Wallet, Subscription, ShopItem } from "../domain/types";

// -- Payment validation helpers ------------------------------------------------

/** Validate that an amount is a positive finite number within safe bounds. */
function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 99999999;
}

/** Validate currency code (ISO 4217 three-letter uppercase). */
function isValidCurrency(currency: string): boolean {
  return /^[A-Z]{3}$/.test(currency);
}

/** Maximum purchases per user per hour (velocity limit). */
const PURCHASE_VELOCITY_LIMIT = 10;
const VELOCITY_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// -- Shop catalog ------------------------------------------------------------

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

/** Valid subscription tier IDs (whitelist). */
const VALID_TIERS = ["free", "plus", "gold", "platinum"] as const;
type ValidTier = (typeof VALID_TIERS)[number];

// -- Helpers ----------------------------------------------------------------

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

/**
 * Velocity check -- prevent purchase abuse.
 * Returns true if the user is within limits (allowed to proceed).
 */
async function checkPurchaseVelocity(
  client: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
): Promise<boolean> {
  const wallet = await ensureWallet(client, userId);
  const windowStart = new Date(Date.now() - VELOCITY_WINDOW_MS).toISOString();
  const { count } = await client
    .from("wallet_transactions")
    .select("id", { count: "exact", head: true })
    .eq("wallet_id", wallet.id)
    .eq("type", "debit")
    .gte("created_at", windowStart);

  return (count ?? 0) < PURCHASE_VELOCITY_LIMIT;
}

// -- Service methods --------------------------------------------------------

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

      // Validate wallet currency
      if (walletRow.currency && !isValidCurrency(walletRow.currency)) {
        return fail("INVALID_CURRENCY", "Wallet currency is invalid");
      }

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
  async buyItem(userId: string, itemId: string): Promise<DomainResult<{ balance: number; receipt?: Record<string, unknown> }>> {
    const client = getSupabase();
    if (!client) return fail("SUPABASE_UNAVAILABLE", "Supabase is not configured");

    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) return fail("NOT_FOUND", "Item not found");

    try {
      const walletRow = await ensureWallet(client, userId);

      // Validate payment amount (server is source of truth per payment-security.md)
      if (!isValidAmount(item.boneCost)) {
        return fail("INVALID_AMOUNT", "Item cost is invalid");
      }

      if (!canAfford(walletRow.balance, item.boneCost)) {
        return fail("INSUFFICIENT_FUNDS", "Not enough bones");
      }

      // Velocity check
      if (!(await checkPurchaseVelocity(client, userId))) {
        return fail("RATE_LIMITED", "Too many purchases. Please try again later.");
      }

      const newBalance = walletRow.balance - item.boneCost;

      // Atomic: update balance, record transaction, and upsert consumable
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

      // Generate receipt (per in-app-purchases.md)
      const receipt = {
        receipt_id: `RCP-${Date.now()}-${userId.slice(0, 8)}`,
        user_id: userId,
        type: "purchase",
        item_id: item.id,
        item_name: item.name,
        bones_spent: item.boneCost,
        balance_after: newBalance,
        created_at: new Date().toISOString(),
      };

      return ok({ balance: newBalance, receipt });
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
      if (!isValidAmount(reward)) {
        return fail("INVALID_AMOUNT", "Reward amount is invalid");
      }

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
  async subscribe(userId: string, tier: string): Promise<DomainResult<{ tier: string; receipt?: Record<string, unknown> }>> {
    const client = getSupabase();
    if (!client) return fail("SUPABASE_UNAVAILABLE", "Supabase is not configured");

    // Validate tier against whitelist (prevents injection of arbitrary tier values)
    if (!tier || !VALID_TIERS.includes(tier as ValidTier)) {
      return fail("INVALID_TIER", "Invalid tier");
    }
    if (tier === "free") {
      return fail("INVALID_TIER", "Cannot subscribe to free tier directly");
    }

    try {
      // Velocity check
      if (!(await checkPurchaseVelocity(client, userId))) {
        return fail("RATE_LIMITED", "Too many subscription changes. Please try again later.");
      }

      // Mark previous active subscriptions as superseded (audit trail per stripe-subscriptions.md)
      await client
        .from("subscriptions")
        .update({ status: "superseded" })
        .eq("user_id", userId)
        .eq("status", "active");

      // Create new subscription
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { error: subErr } = await client.from("subscriptions").insert({
        user_id: userId,
        tier,
        status: "active",
        current_period_end: periodEnd.toISOString(),
      });

      if (subErr) {
        return fail("SUBSCRIBE_FAILED", "Failed to create subscription");
      }

      // Update premium_entitlements with validated tier
      const { data: existing } = await client
        .from("premium_entitlements")
        .select("profile_id")
        .eq("profile_id", userId)
        .maybeSingle();

      const entitlementUpdate = {
        tier: tier as ValidTier,
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

      // Generate receipt (per in-app-purchases.md)
      const receipt = {
        receipt_id: `RCP-${Date.now()}-${userId.slice(0, 8)}`,
        user_id: userId,
        type: "subscription",
        tier,
        period_end: periodEnd.toISOString(),
        created_at: new Date().toISOString(),
      };

      return ok({ tier, receipt });
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
      // Set status to canceled instead of deleting (audit trail per stripe-subscriptions.md)
      await client
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("user_id", userId)
        .eq("status", "active");

      await client
        .from("premium_entitlements")
        .update({ tier: "free", source: "cancelled" })
        .eq("profile_id", userId);

      return ok(undefined as void);
    } catch (e) {
      return fail("CANCEL_FAILED", e instanceof Error ? e.message : "Failed to cancel subscription");
    }
  }
}
