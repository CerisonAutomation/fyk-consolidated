"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, Check, Gift, Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useSupabaseSession } from "@/integrations/supabase/session-provider";
import {
  loadWalletData,
  performWalletAction,
} from "@/integrations/supabase/wallet";
import { Button, Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function PremiumClient() {
  const qc = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const [tab, setTab] = useState<"tiers" | "wallet">("tiers");

  const { data, isLoading } = useQuery({
    queryKey: ["wallet", userId],
    queryFn: async () => {
      if (!userId) throw new Error("Not authenticated");
      const result = await loadWalletData(userId);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    enabled: !!userId,
  });

  const act = useMutation({
    mutationFn: async (vars: { action: string; tier?: string; type?: string; amount?: number }) => {
      if (!userId) throw new Error("Not authenticated");
      const result = await performWalletAction(userId, vars.action, vars);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (_res, vars) => {
      const a = vars.action;
      pushToast(
        a === "subscribe" ? "Subscription active 👑 Welcome to premium." :
        a === "daily" ? "Daily reward claimed! +15 🦴" :
        a === "topup" ? "Bones added" :
        a === "buy" ? "Purchased! Check your inventory." :
        "Subscription cancelled", "success"
      );
      qc.invalidateQueries({ queryKey: ["wallet", userId] });
      qc.invalidateQueries({ queryKey: ["pet", userId] });
      if (a === "subscribe" || a === "cancel") qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => pushToast(e instanceof Error ? e.message : "Failed", "error"),
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="mb-4 h-40 rounded-3xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const { wallet, shop, tiers, currentTier } = data;
  const tierOrder = ["free", "plus", "gold", "platinum"];
  const currentIdx = tierOrder.indexOf(currentTier);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center gap-2">
        <Crown className="h-5 w-5 text-gold" />
        <h1 className="text-xl font-bold text-white">Premium</h1>
      </div>
      <p className="mb-4 text-sm text-muted">
        Unlock the full FYK experience — unlimited taps, 48 AI features, incognito and more.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1">
        <button
          onClick={() => setTab("tiers")}
          className={cn("rounded-lg py-2 text-sm font-medium", tab === "tiers" ? "bg-gold text-ink" : "text-muted")}
        >
          Membership
        </button>
        <button
          onClick={() => setTab("wallet")}
          className={cn("rounded-lg py-2 text-sm font-medium", tab === "wallet" ? "bg-gold text-ink" : "text-muted")}
        >
          Wallet · {wallet.balance} 🦴
        </button>
      </div>

      {tab === "tiers" ? (
        <>
          {/* current plan */}
          <div className="mb-4 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/12 to-transparent p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold text-ink">
                <Crown className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold capitalize text-white">{currentTier} plan</p>
                <p className="text-xs text-muted">
                  {wallet.subscription
                    ? `Renews ${wallet.subscription.current_period_end
                        ? new Date(wallet.subscription.current_period_end).toLocaleDateString()
                        : "soon"}`
                    : "Free forever. Upgrade any time."}
                </p>
              </div>
              {currentTier !== "free" && (
                <Button variant="ghost" size="sm" onClick={() => act.mutate({ action: "cancel" })}>
                  Cancel
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(tiers).map(([key, t]) => {
              const isCurrent = currentTier === key;
              const isDowngrade = tierOrder.indexOf(key) <= currentIdx;
              return (
                <div
                  key={key}
                  className={cn(
                    "flex flex-col rounded-2xl border p-4",
                    key === "gold" && !isCurrent ? "border-gold/40 bg-gold/[0.06]" : "border-line bg-surface",
                    isCurrent && "border-gold/60 bg-gold/10"
                  )}
                >
                  {key === "gold" && (
                    <span className="mb-2 w-fit rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase text-ink">
                      Most popular
                    </span>
                  )}
                  <p className="text-sm font-bold text-white">{t.name}</p>
                  <p className="mt-0.5 text-2xl font-bold text-gradient-gold">
                    ${t.price}
                    <span className="text-xs font-normal text-muted">/mo</span>
                  </p>
                  <ul className="mt-3 flex-1 space-y-1.5">
                    {t.perks.map((p) => (
                      <li key={p} className="flex items-start gap-1.5 text-[11px] text-white/80">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-gold" /> {p}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-4 w-full"
                    size="sm"
                    variant={isCurrent ? "secondary" : "primary"}
                    disabled={isCurrent}
                    onClick={() => act.mutate({ action: "subscribe", tier: key })}
                  >
                    {isCurrent ? "Current plan" : isDowngrade ? "Switch" : "Upgrade"}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-line bg-surface p-4">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <p className="text-xs leading-relaxed text-muted">
              <span className="text-white">Cancel any time.</span> Premium is billed through Stripe.
              Bones are a separate consumable currency used for boosts, gifts and your King Pet.
            </p>
          </div>
        </>
      ) : (
        <>
          {/* balance */}
          <div className="mb-4 rounded-2xl border border-line bg-gradient-to-br from-gold/10 to-transparent p-5 text-center">
            <p className="text-4xl font-bold text-gradient-gold">{wallet.balance}</p>
            <p className="mt-0.5 text-xs uppercase tracking-widest text-muted">Bones</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={() => act.mutate({ action: "daily" })}>
                <Gift className="h-3.5 w-3.5" /> Daily reward
              </Button>
              <Button size="sm" variant="secondary" onClick={() => act.mutate({ action: "topup", amount: 100 })}>
                +100 bones
              </Button>
              <Button size="sm" variant="secondary" onClick={() => act.mutate({ action: "topup", amount: 500 })}>
                +500 bones
              </Button>
            </div>
          </div>

          {/* inventory */}
          {wallet.consumables.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Your inventory</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {wallet.consumables.map((c) => (
                  <div key={c.type} className="rounded-xl border border-line bg-surface p-3 text-center">
                    <p className="text-lg">{shop.find((s) => s.type === c.type)?.emoji ?? "🎁"}</p>
                    <p className="text-sm font-bold text-white">{c.quantity}</p>
                    <p className="truncate text-[10px] text-muted">
                      {shop.find((s) => s.type === c.type)?.label ?? c.type}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* shop */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Spend bones</p>
          <div className="mb-4 space-y-2">
            {shop.map((s) => (
              <div key={s.type} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-xl">
                  {s.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{s.label}</p>
                  <p className="truncate text-xs text-muted">{s.desc}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={wallet.balance < s.cost}
                  onClick={() => act.mutate({ action: "buy", type: s.type })}
                >
                  {s.cost} 🦴
                </Button>
              </div>
            ))}
          </div>

          {/* transactions */}
          {wallet.transactions.length > 0 && (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">History</p>
              <div className="space-y-1">
                {wallet.transactions.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl border border-line/60 bg-surface/60 px-3 py-2">
                    <span className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                      t.type === "credit" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                    )}>
                      {t.type === "credit" ? "+" : "-"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-white">{t.description}</p>
                      <p className="text-[10px] text-muted">{new Date(t.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className="text-xs font-semibold text-white">{t.amount} 🦴</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
