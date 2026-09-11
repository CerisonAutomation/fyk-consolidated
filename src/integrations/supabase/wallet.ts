/**
 * Wallet & Premium -- Supabase integration
 *
 * Handles bone currency, consumable shop, subscription tiers, and daily rewards.
 * Replaces the old api("/api/wallet") calls with direct Supabase queries.
 */

import { getSupabase, toFailure, type Result } from "./client";
import type { WalletRow } from "./types";

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
): Promise<Result<{ balance?: number }>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const wallet = await ensureWallet(client, userId);

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
      const newBalance = wallet.balance + reward;
      await client.from("wallet").update({ balance: newBalance }).eq("id", wallet.id);
      await client.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        type: "credit",
        amount: reward,
        description: "Daily reward",
      });
      return { ok: true, data: { balance: newBalance } };
    }

    case "topup": {
      const amount = (params?.amount as number) ?? 0;
      if (amount <= 0) return fail("INVALID", "Invalid amount");
      const newBalance = wallet.balance + amount;
      await client.from("wallet").update({ balance: newBalance }).eq("id", wallet.id);
      await client.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        type: "credit",
        amount,
        description: "Top-up +" + amount + " bones",
      });
      return { ok: true, data: { balance: newBalance } };
    }

    case "buy": {
      const itemType = params?.type as string;
      const item = SHOP_ITEMS.find((s) => s.type === itemType);
      if (!item) return fail("NOT_FOUND", "Item not found");
      if (wallet.balance < item.cost) return fail("INSUFFICIENT_FUNDS", "Not enough bones");
      const newBalance = wallet.balance - item.cost;
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
      return { ok: true, data: { balance: newBalance } };
    }

    case "subscribe": {
      const tier = params?.tier as string;
      const def = TIER_DEFS[tier];
      if (!def) return fail("INVALID_TIER", "Invalid tier");

      await client.from("subscriptions").delete().eq("user_id", userId);
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await client.from("subscriptions").insert({
        user_id: userId,
        tier,
        status: "active",
        current_period_end: periodEnd.toISOString(),
      });

      const { data: existingEnt } = await client
        .from("premium_entitlements")
        .select("profile_id")
        .eq("profile_id", userId)
        .maybeSingle();

      if (existingEnt) {
        await client
          .from("premium_entitlements")
          .update({ tier: tier as "free" | "plus", source: "mock_payment", expires_at: periodEnd.toISOString() })
          .eq("profile_id", userId);
      } else {
        await client.from("premium_entitlements").insert({
          profile_id: userId,
          tier: tier as "free" | "plus",
          source: "mock_payment",
          expires_at: periodEnd.toISOString(),
        });
      }
      return { ok: true, data: {} };
    }

    case "cancel": {
      await client.from("subscriptions").delete().eq("user_id", userId);
      await client
        .from("premium_entitlements")
        .update({ tier: "free" as "free" | "plus", source: "cancelled" })
        .eq("profile_id", userId);
      return { ok: true, data: {} };
    }

    default:
      return fail("UNKNOWN_ACTION", "Unknown action: " + action);
  }
}
