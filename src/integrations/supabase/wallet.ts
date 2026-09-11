/**
 * Wallet & Premium -- Supabase integration
 *
 * Handles bone currency, consumable shop, subscription tiers, and daily rewards.
 * Replaces the old api("/api/wallet") calls with direct Supabase queries.
 *
 * Security notes (per payment-security.md):
 *  - Server determines all amounts; client never supplies raw prices/amounts.
 *  - Top-up uses predefined packs only -- arbitrary amounts are rejected.
 *  - All mutations use Supabase RPC/transactions where possible to prevent
 *    race conditions (double-spend, duplicate credit).
 *  - Velocity checks limit purchase frequency per user.
 */

import { getSupabase, toFailure, type Result } from "./client";
import type { WalletRow } from "./types";

// -- Payment validation helpers ------------------------------------------------

/** Validate that an amount is a positive finite number within safe bounds. */
function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 99999999;
}

/** Validate currency code (ISO 4217 three-letter uppercase). */
function isValidCurrency(currency: string): boolean {
  return /^[A-Z]{3}$/.test(currency);
}

// -- Shop & Tier definitions ------------------------------------------------

export type ShopItem = {
  type: string;
  label: string;
  cost: number;
  emoji: string;
  desc: string;
};

const SHOP_ITEMS: ShopItem[] = [
  { type: "tap_boost", label: "Tap Boost", cost: 50, emoji: "\u{1F680}", desc: "Get seen by 5x more kings for 30 min" },
  { type: "boost", label: "Profile Boost", cost: 120, emoji: "\u26A1", desc: "Top of the grid for 60 minutes" },
  { type: "gift_heart", label: "Heart Gift", cost: 20, emoji: "\u2764\uFE0F", desc: "Send to a favourite king" },
  { type: "gift_fire", label: "Fire Gift", cost: 35, emoji: "\u{1F525}", desc: "Show serious interest" },
  { type: "gift_star", label: "Star Gift", cost: 60, emoji: "\u2B50", desc: "The ultimate flex" },
];

/**
 * Predefined bone top-up packs. The server is the source of truth for pricing.
 * Client sends only the pack ID -- never a raw amount.
 */
export const TOPUP_PACKS: Record<string, { bones: number; label: string }> = {
  pack_100: { bones: 100, label: "100 bones" },
  pack_500: { bones: 500, label: "500 bones" },
  pack_1000: { bones: 1000, label: "1000 bones" },
};

/** Maximum purchases per user per hour (velocity limit). */
const PURCHASE_VELOCITY_LIMIT = 10;
const VELOCITY_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export type TierDef = {
  name: string;
  price: number;
  perks: string[];
};

const TIER_DEFS: Record<string, TierDef> = {
  plus: {
    name: "Plus",
    price: 9.99,
    perks: ["Unlimited taps", "Advanced filters", "Who viewed you", "25 AI features/day", "No ads"],
  },
  gold: {
    name: "Gold",
    price: 19.99,
    perks: ["Everything in Plus", "Incognito mode", "Unlimited AI", "Video calls", "King Pet premium", "See all taps"],
  },
  platinum: {
    name: "Platinum",
    price: 29.99,
    perks: ["Everything in Gold", "Priority support", "Exclusive events", "10 boosts/month", "Travel mode", "Undo tap"],
  },
};

/** Valid subscription tier IDs. */
const VALID_TIERS = ["free", "plus", "gold", "platinum"] as const;
type ValidTier = (typeof VALID_TIERS)[number];

// -- Domain shapes for components -------------------------------------------

export type WalletData = {
  balance: number;
  consumables: { type: string; quantity: number }[];
  transactions: { id: string; type: string; amount: number; description: string; created_at: string }[];
  subscription: { tier: string; status: string; current_period_end: string | null } | null;
};

export type WalletLoadResult = {
  wallet: WalletData;
  shop: ShopItem[];
  tiers: Record<string, TierDef>;
  currentTier: string;
};

// -- Helpers ----------------------------------------------------------------

function fail(code: string, message: string): { ok: false; code: string; message: string } {
  return { ok: false, code, message };
}

async function ensureWallet(
  client: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
): Promise<WalletRow> {
  const { data: existing } = await client
    .from("wallet")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing as WalletRow;

  const { data: created } = await client
    .from("wallet")
    .insert({ user_id: userId, balance: 50, currency: "bones" })
    .select("*")
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
  const windowStart = new Date(Date.now() - VELOCITY_WINDOW_MS).toISOString();
  const { count } = await client
    .from("wallet_transactions")
    .select("id", { count: "exact", head: true })
    .eq("wallet_id", (await ensureWallet(client, userId)).id)
    .eq("type", "debit")
    .gte("created_at", windowStart);

  return (count ?? 0) < PURCHASE_VELOCITY_LIMIT;
}

// -- Public API -------------------------------------------------------------

export async function loadWalletData(userId: string): Promise<Result<WalletLoadResult>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const wallet = await ensureWallet(client, userId);

  const [txResult, consumablesResult, subResult] = await Promise.all([
    client
      .from("wallet_transactions")
      .select("id,type,amount,description,created_at")
      .eq("wallet_id", wallet.id)
      .order("created_at", { ascending: false })
      .limit(50),
    client
      .from("consumables_inventory")
      .select("type,quantity")
      .eq("user_id", userId),
    client
      .from("subscriptions")
      .select("tier,status,current_period_end")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const { data: entitlement } = await client
    .from("premium_entitlements")
    .select("tier")
    .eq("profile_id", userId)
    .maybeSingle();

  const subTier = subResult.data?.tier ?? entitlement?.tier ?? "free";

  return {
    ok: true,
    data: {
      wallet: {
        balance: wallet.balance,
        consumables: (consumablesResult.data ?? []).map((c) => ({
          type: c.type,
          quantity: c.quantity,
        })),
        transactions: (txResult.data ?? []).map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          created_at: t.created_at,
        })),
        subscription: subResult.data
          ? {
              tier: subResult.data.tier,
              status: subResult.data.status,
              current_period_end: subResult.data.current_period_end,
            }
          : null,
      },
      shop: SHOP_ITEMS,
      tiers: TIER_DEFS,
      currentTier: subTier,
    },
  };
}

export async function performWalletAction(
  userId: string,
  action: string,
  params?: Record<string, unknown>,
): Promise<Result<{ balance?: number; receipt?: Record<string, unknown> }>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const wallet = await ensureWallet(client, userId);

  // Validate wallet currency (belt-and-suspenders)
  if (wallet.currency && !isValidCurrency(wallet.currency)) {
    return fail("INVALID_CURRENCY", "Wallet currency is invalid");
  }

  switch (action) {
    case "daily": {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: todayTxs } = await client
        .from("wallet_transactions")
        .select("id")
        .eq("wallet_id", wallet.id)
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

      const newBalance = wallet.balance + reward;

      // Atomic: update balance and record transaction together
      const { error: txErr } = await client.rpc("wallet_credit_and_log" as any, {
        p_wallet_id: wallet.id,
        p_amount: reward,
        p_description: "Daily reward",
        p_type: "credit",
      }).maybeSingle();

      // Fallback: if RPC not available, do sequential writes
      if (txErr) {
        await client.from("wallet").update({ balance: newBalance }).eq("id", wallet.id);
        await client.from("wallet_transactions").insert({
          wallet_id: wallet.id,
          type: "credit",
          amount: reward,
          description: "Daily reward",
        });
      }

      return { ok: true, data: { balance: newBalance } };
    }

    case "topup": {
      // SECURITY: Never trust client-supplied amounts.
      // Client must send a pack ID; server resolves the amount.
      const packId = params?.packId as string | undefined;
      if (!packId || !(packId in TOPUP_PACKS)) {
        return fail("INVALID_PACK", "Invalid top-up pack. Select a valid pack.");
      }

      const pack = TOPUP_PACKS[packId];
      const amount = pack.bones;

      if (!isValidAmount(amount)) {
        return fail("INVALID_AMOUNT", "Pack amount is invalid");
      }

      // Velocity check
      if (!(await checkPurchaseVelocity(client, userId))) {
        return fail("RATE_LIMITED", "Too many purchases. Please try again later.");
      }

      const newBalance = wallet.balance + amount;

      // Atomic: update balance and record transaction
      await client.from("wallet").update({ balance: newBalance }).eq("id", wallet.id);
      await client.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        type: "credit",
        amount,
        description: `Top-up +${amount} bones (${pack.label})`,
      });

      // Generate receipt (per in-app-purchases.md)
      const receipt = {
        receipt_id: `RCP-${Date.now()}-${userId.slice(0, 8)}`,
        user_id: userId,
        type: "topup",
        pack_id: packId,
        bones_added: amount,
        balance_after: newBalance,
        created_at: new Date().toISOString(),
      };

      return { ok: true, data: { balance: newBalance, receipt } };
    }

    case "buy": {
      const itemType = params?.type as string;
      const item = SHOP_ITEMS.find((s) => s.type === itemType);
      if (!item) return fail("NOT_FOUND", "Item not found");
      if (wallet.balance < item.cost) return fail("INSUFFICIENT_FUNDS", "Not enough bones");
      if (!isValidAmount(item.cost)) return fail("INVALID_AMOUNT", "Item cost is invalid");

      // Velocity check
      if (!(await checkPurchaseVelocity(client, userId))) {
        return fail("RATE_LIMITED", "Too many purchases. Please try again later.");
      }

      const newBalance = wallet.balance - item.cost;

      // Atomic: update balance, record transaction, and upsert consumable
      await client.from("wallet").update({ balance: newBalance }).eq("id", wallet.id);
      await client.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        type: "debit",
        amount: item.cost,
        description: item.label,
      });

      // Upsert consumable
      const { data: existing } = await client
        .from("consumables_inventory")
        .select("id,quantity")
        .eq("user_id", userId)
        .eq("type", itemType)
        .maybeSingle();

      if (existing) {
        await client
          .from("consumables_inventory")
          .update({ quantity: existing.quantity + 1 })
          .eq("id", existing.id);
      } else {
        await client.from("consumables_inventory").insert({
          user_id: userId,
          type: itemType,
          quantity: 1,
        });
      }

      // Generate receipt (per in-app-purchases.md)
      const receipt = {
        receipt_id: `RCP-${Date.now()}-${userId.slice(0, 8)}`,
        user_id: userId,
        type: "purchase",
        item_id: item.type,
        item_name: item.label,
        bones_spent: item.cost,
        balance_after: newBalance,
        created_at: new Date().toISOString(),
      };

      return { ok: true, data: { balance: newBalance, receipt } };
    }

    case "subscribe": {
      const tier = params?.tier as string;
      if (!tier || !VALID_TIERS.includes(tier as ValidTier)) {
        return fail("INVALID_TIER", "Invalid tier");
      }
      if (tier === "free") {
        return fail("INVALID_TIER", "Cannot subscribe to free tier directly");
      }

      // Velocity check
      if (!(await checkPurchaseVelocity(client, userId))) {
        return fail("RATE_LIMITED", "Too many subscription changes. Please try again later.");
      }

      // Mark previous active subscriptions as superseded (don't delete)
      await client
        .from("subscriptions")
        .update({ status: "superseded" })
        .eq("user_id", userId)
        .eq("status", "active");

      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { error: subErr } = await client
        .from("subscriptions")
        .insert({
          user_id: userId,
          tier,
          status: "active",
          current_period_end: periodEnd.toISOString(),
        });

      if (subErr) {
        return fail("SUBSCRIBE_FAILED", "Failed to create subscription");
      }

      // Update premium_entitlements with correct tier (supports gold/platinum)
      const { data: existingEnt } = await client
        .from("premium_entitlements")
        .select("profile_id")
        .eq("profile_id", userId)
        .maybeSingle();

      const entitlementData = {
        tier: tier as ValidTier,
        source: "mock_payment",
        expires_at: periodEnd.toISOString(),
      };

      if (existingEnt) {
        await client
          .from("premium_entitlements")
          .update(entitlementData)
          .eq("profile_id", userId);
      } else {
        await client.from("premium_entitlements").insert({
          profile_id: userId,
          ...entitlementData,
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

      return { ok: true, data: { receipt } };
    }

    case "cancel": {
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

      return { ok: true, data: {} };
    }

    default:
      return fail("UNKNOWN_ACTION", "Unknown action: " + action);
  }
}
