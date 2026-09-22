"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Check, Crown, Gift, Globe, Lock, Shield, Users, Zap } from "lucide-react";
import { useState } from "react";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { useSupabaseSession } from "@/integrations/supabase/session-provider";
import { loadWalletData, performWalletAction, type WalletAction } from "@/core/api/wallet";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// Design tokens — polished, detailed, subtle lighting, high-quality
const BONE = "\u{1F9B4}";
const CROWN = "\u{1F451}";

type TierKey = "free" | "xtra" | "unlimited" | "gold" | "platinum";
type Tab = "tiers" | "wallet" | "features";

interface Tier {
  key: TierKey;
  name: string;
  price: string;
  originalPrice?: string;
  badge?: string;
  description: string;
  perks: string[];
  highlight?: boolean;
  popular?: boolean;
  cta: string;
  features: {
    incognito: boolean;
    unsend: boolean;
    viewedMe: boolean;
    webAccess: boolean;
    privateAlbums: boolean;
    expiringPhotos: boolean;
    screenshotBlock: boolean;
    chatTranslation: boolean;
    boost: number;
    searchOptions: number;
    hideVisits: boolean;
    appearOffline: boolean;
    unlimitedContacts: boolean;
    unlimitedPhotos: boolean;
    visitorsDays: number;
    quickShare: boolean;
    gridViewOptions: boolean;
    favoriteStats: boolean;
    travelAdvanceDays: number;
    selfieVerification: boolean;
    voiceCalls: boolean;
    videoCalls: boolean;
    multiService: boolean;
  };
}

const TIERS: Record<TierKey, Tier> = {
  free: {
    key: "free",
    name: "Free",
    price: "0",
    description: "Core discovery and chat, forever free",
    perks: ["Nearby grid (100 profiles)", "Basic filters (online, photo)", "Unlimited messages", "Favorites & blocks", "1 boost/month"],
    cta: "Current",
    features: {
      incognito: false,
      unsend: false,
      viewedMe: false,
      webAccess: false,
      privateAlbums: false,
      expiringPhotos: false,
      screenshotBlock: false,
      chatTranslation: false,
      boost: 1,
      searchOptions: 10,
      hideVisits: false,
      appearOffline: false,
      unlimitedContacts: false,
      unlimitedPhotos: false,
      visitorsDays: 0,
      quickShare: false,
      gridViewOptions: false,
      favoriteStats: false,
      travelAdvanceDays: 0,
      selfieVerification: false,
      voiceCalls: false,
      videoCalls: false,
      multiService: false,
    },
  },
  xtra: {
    key: "xtra",
    name: "XTRA",
    price: "9.99",
    originalPrice: "14.99",
    badge: "Most Popular",
    description: "More profiles, more filters, no ads",
    perks: [
      "600 profiles, 3x grid",
      "Advanced filters (30+ options)",
      "No third-party ads",
      "Read receipts",
      "5 boosts/month",
      "Travel mode (1 city)",
      "Unlimited blocks & favorites",
    ],
    highlight: true,
    popular: true,
    cta: "Go XTRA",
    features: {
      incognito: false,
      unsend: true,
      viewedMe: true,
      webAccess: false,
      privateAlbums: true,
      expiringPhotos: true,
      screenshotBlock: true,
      chatTranslation: false,
      boost: 5,
      searchOptions: 30,
      hideVisits: true,
      appearOffline: false,
      unlimitedContacts: true,
      unlimitedPhotos: true,
      visitorsDays: 3,
      quickShare: true,
      gridViewOptions: true,
      favoriteStats: false,
      travelAdvanceDays: 7,
      selfieVerification: true,
      voiceCalls: true,
      videoCalls: false,
      multiService: false,
    },
  },
  unlimited: {
    key: "unlimited",
    name: "Unlimited",
    price: "19.99",
    originalPrice: "29.99",
    badge: "Best Value",
    description: "Full toolkit: incognito, web, unlimited",
    perks: [
      "Unlimited profiles & grid",
      "120+ search options (Romeo level)",
      "Incognito mode (ghost, hide visits, appear offline)",
      "Unsend messages & photos",
      "Full Viewed Me + Visitors 7 days",
      "Grindr Web (desktop chat)",
      "Private albums + expiring photos + screenshot block",
      "Chat translation (100+ langs, on-device)",
      "15 boosts/month + QuickShare",
      "Travel 2 weeks prior (Romeo)",
      "Voice & video calls",
      "Selfie verification badge",
    ],
    highlight: true,
    cta: "Go Unlimited",
    features: {
      incognito: true,
      unsend: true,
      viewedMe: true,
      webAccess: true,
      privateAlbums: true,
      expiringPhotos: true,
      screenshotBlock: true,
      chatTranslation: true,
      boost: 15,
      searchOptions: 120,
      hideVisits: true,
      appearOffline: true,
      unlimitedContacts: true,
      unlimitedPhotos: true,
      visitorsDays: 7,
      quickShare: true,
      gridViewOptions: true,
      favoriteStats: true,
      travelAdvanceDays: 14,
      selfieVerification: true,
      voiceCalls: true,
      videoCalls: true,
      multiService: true,
    },
  },
  gold: {
    key: "gold",
    name: "Gold",
    price: "14.99",
    description: "Legacy Gold — balanced power",
    perks: ["Gold perks from previous system", "5 boosts", "Advanced filters", "No ads"],
    cta: "Gold",
    features: {
      incognito: false,
      unsend: true,
      viewedMe: true,
      webAccess: false,
      privateAlbums: true,
      expiringPhotos: true,
      screenshotBlock: true,
      chatTranslation: false,
      boost: 5,
      searchOptions: 50,
      hideVisits: true,
      appearOffline: false,
      unlimitedContacts: true,
      unlimitedPhotos: true,
      visitorsDays: 3,
      quickShare: true,
      gridViewOptions: true,
      favoriteStats: false,
      travelAdvanceDays: 7,
      selfieVerification: true,
      voiceCalls: true,
      videoCalls: false,
      multiService: false,
    },
  },
  platinum: {
    key: "platinum",
    name: "Platinum",
    price: "29.99",
    description: "Legacy Platinum — max power",
    perks: ["Platinum perks", "15 boosts", "All filters", "Web access", "Calls"],
    cta: "Platinum",
    features: {
      incognito: true,
      unsend: true,
      viewedMe: true,
      webAccess: true,
      privateAlbums: true,
      expiringPhotos: true,
      screenshotBlock: true,
      chatTranslation: true,
      boost: 15,
      searchOptions: 120,
      hideVisits: true,
      appearOffline: true,
      unlimitedContacts: true,
      unlimitedPhotos: true,
      visitorsDays: 7,
      quickShare: true,
      gridViewOptions: true,
      favoriteStats: true,
      travelAdvanceDays: 14,
      selfieVerification: true,
      voiceCalls: true,
      videoCalls: true,
      multiService: true,
    },
  },
};

export function PremiumClient() {
  
  const qc = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const [tab, setTab] = useState<Tab>("tiers");
  const [compare, setCompare] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["wallet", userId],
    queryFn: async () => {
      if (!userId) throw new Error("Not authenticated");
      return loadWalletData();
    },
    enabled: !!userId,
  });

  const act = useMutation({
    mutationFn: async (vars: WalletAction) => {
      if (!userId) throw new Error("Not authenticated");
      return performWalletAction(vars);
    },
    onSuccess: (res, vars) => {
      const a = vars.action;
      pushToast(
        a === "subscribe"
          ? `Subscription active ${CROWN} Welcome to premium.`
          : a === "daily"
            ? `Daily reward claimed! +15 ${BONE}`
            : a === "topup"
              ? `+${res.amount ?? 0} ${BONE} added`
              : a === "buy"
                ? `${res.label ?? "Item"} purchased`
                : "Subscription cancelled",
        "success",
      );
      qc.invalidateQueries({ queryKey: ["wallet", userId] });
      qc.invalidateQueries({ queryKey: ["pet", userId] });
      if (a === "subscribe" || a === "cancel") qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => pushToast(e instanceof Error ? e.message : "Failed", "error"),
  });

  if (isLoading || !data) {
    if (isError)
      return (
        <div className="mx-auto max-w-3xl p-4">
          <EmptyState
            icon={<Crown className="h-6 w-6 text-gold" />}
            title="Wallet unavailable"
            description={error instanceof Error ? error.message : "We could not read your balance."}
            action={<Button size="sm" onClick={() => refetch()}>Try again</Button>}
          />
        </div>
      );
    return (
      <div className="mx-auto max-w-3xl p-4">
        <Skeleton className="mb-4 h-40 rounded-[20px]" />
        <Skeleton className="h-64 rounded-[16px]" />
      </div>
    );
  }

  const { wallet, shop, currentTier } = data;
  const tierOrder: TierKey[] = ["free", "xtra", "unlimited", "gold", "platinum"];
  const currentIdx = tierOrder.indexOf(currentTier as TierKey);

  return (
    <div className="mx-auto max-w-5xl p-4 pb-24">
      {/* Header — polished, subtle lighting */}
      <div className="mb-6 rounded-[20px] border border-black/[0.06] bg-white/80 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-black text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-black">Premium</h1>
              <p className="mt-1 text-[14px] leading-[1.5] text-zinc-500">
                Unlock full FYK: XTRA/Unlimited with Incognito, Web, 120+ filters, translation, calls — vs Grindr/Romeo/MachoBB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[13px] font-medium tracking-wide text-zinc-700">
              {wallet.balance} {BONE} · {currentTier}
            </div>
          </div>
        </div>

        {/* Tabs — bento rhythm */}
        <div className="mt-5 grid grid-cols-3 gap-2 rounded-[12px] bg-zinc-100 p-1">
          {(["tiers", "features", "wallet"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-[8px] py-2.5 text-[13px] font-semibold tracking-wide transition",
                tab === t ? "bg-black text-white shadow-[0_1px_2px_rgba(0,0,0,0.1)]" : "text-zinc-500 hover:text-zinc-700",
              )}
            >
              {t === "tiers" ? "Membership" : t === "features" ? "Compare" : `Wallet · ${wallet.balance}`}
            </button>
          ))}
        </div>
      </div>

      {tab === "tiers" && (
        <>
          {/* Current plan — product design */}
          <div className="mb-6 rounded-[20px] border border-[oklch(0.80_0.17_85/0.3)] bg-gradient-to-br from-[oklch(0.80_0.17_85/0.12)] to-transparent p-5 shadow-[0_0_0_1px_oklch(0.80_0.17_85/0.3),0_8px_24px_oklch(0.80_0.17_85/0.15)] backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[oklch(0.80_0.17_85)] text-black shadow-[0_4px_12px_oklch(0.80_0.17_85/0.3)]">
                <Crown className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-display text-[18px] font-bold tracking-tight text-black capitalize">{currentTier} plan</p>
                <p className="text-[13px] text-zinc-600">
                  {wallet.subscription
                    ? `Renews $${wallet.subscription.current_period_end ? new Date(wallet.subscription.current_period_end).toLocaleDateString() : "soon"} · ${TIERS[currentTier as TierKey]?.features.boost} boosts`
                    : "Free forever. Upgrade anytime. Cancel anytime. Stripe billing."}
                </p>
              </div>
              {currentTier !== "free" && (
                <Button variant="ghost" size="sm" onClick={() => act.mutate({ action: "cancel" })} className="rounded-full border border-zinc-200">
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Tiers — bento grid, asymmetry, varied weights */}
          <div className="grid gap-4 md:grid-cols-3">
            {(["free", "xtra", "unlimited"] as TierKey[]).map((key) => {
              const t = TIERS[key];
              const isCurrent = currentTier === key;
              const isDowngrade = tierOrder.indexOf(key) <= currentIdx;
              return (
                <div
                  key={key}
                  className={cn(
                    "group relative flex flex-col rounded-[20px] border bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] transition hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_16px_48px_rgba(0,0,0,0.08)] hover:-translate-y-[1px]",
                    t.popular ? "border-[oklch(0.80_0.17_85/0.4)] bg-gradient-to-br from-white to-[oklch(0.80_0.17_85/0.06)]" : "border-black/[0.06]",
                    isCurrent && "border-[oklch(0.80_0.17_85/0.6)] bg-[oklch(0.80_0.17_85/0.08)]",
                  )}
                >
                  {t.badge && (
                    <span className="absolute -top-3 left-5 rounded-full bg-black px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-md">
                      {t.badge}
                    </span>
                  )}
                  {key === "unlimited" && (
                    <span className="absolute -top-3 right-5 rounded-full bg-[oklch(0.80_0.17_85)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-black shadow-[0_0_0_1px_oklch(0.80_0.17_85/0.3),0_8px_24px_oklch(0.80_0.17_85/0.15)]">
                      Best Value
                    </span>
                  )}

                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="font-display text-[20px] font-bold tracking-tight text-black">{t.name}</p>
                      <p className="text-[12px] leading-relaxed text-zinc-500">{t.description}</p>
                    </div>
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-[12px]", key === "free" ? "bg-zinc-100" : key === "xtra" ? "bg-black text-white" : "bg-[oklch(0.80_0.17_85)] text-black")}>
                      {key === "free" ? <Users className="h-5 w-5" /> : key === "xtra" ? <Zap className="h-5 w-5" /> : <Crown className="h-5 w-5" />}
                    </div>
                  </div>

                  <div className="mb-4 flex items-baseline gap-2">
                    <span className="font-display text-[32px] font-bold tracking-tight text-black">${t.price}</span>
                    <span className="text-[13px] text-zinc-500">/mo</span>
                    {t.originalPrice && <span className="text-[12px] line-through text-zinc-400">${t.originalPrice}</span>}
                  </div>

                  <ul className="mb-5 flex-1 space-y-2">
                    {t.perks.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-[13px] leading-[1.4] text-zinc-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-black" />
                        {p}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={cn(
                      "w-full rounded-full text-[13px] font-semibold tracking-wide",
                      isCurrent ? "bg-zinc-100 text-zinc-500" : key === "unlimited" ? "bg-black text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:bg-zinc-900" : "bg-white border border-black/10 text-black hover:bg-zinc-50",
                    )}
                    size="sm"
                    disabled={isCurrent}
                    onClick={() => act.mutate({ action: "subscribe", tier: key as any })}
                  >
                    {isCurrent ? "Current plan" : isDowngrade ? "Switch" : t.cta}
                  </Button>

                  {/* Feature chips — practical */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {t.features.incognito && <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] tracking-wide text-zinc-700">Incognito</span>}
                    {t.features.webAccess && <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] tracking-wide text-zinc-700">Web</span>}
                    {t.features.chatTranslation && <span className="rounded-full bg-[oklch(0.80_0.17_85/0.12)] border border-[oklch(0.80_0.17_85/0.15)] px-2.5 py-1 text-[11px] tracking-wide text-black">Translation</span>}
                    {t.features.videoCalls && <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] tracking-wide text-zinc-700">Video calls</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trust — safety, privacy, vs competitors */}
          <div className="mt-6 grid gap-3 rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-sm md:grid-cols-3">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50"><Shield className="h-4 w-4" /></div>
              <div><p className="text-[13px] font-semibold tracking-wide text-black">Privacy first</p><p className="text-[12px] leading-[1.4] text-zinc-500">Hide GPS, incognito, no exact location shared — vs Grindr/Romeo/MachoBB</p></div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50"><Lock className="h-4 w-4" /></div>
              <div><p className="text-[13px] font-semibold tracking-wide text-black">Safety hardened</p><p className="text-[12px] leading-[1.4] text-zinc-500">Verification badge, selfie check, screenshot block, expiring photos</p></div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50"><Globe className="h-4 w-4" /></div>
              <div><p className="text-[13px] font-semibold tracking-wide text-black">Travel & Web</p><p className="text-[12px] leading-[1.4] text-zinc-500">2 weeks prior (Romeo), Grindr Web desktop, travel mode</p></div>
            </div>
          </div>
        </>
      )}

      {tab === "features" && (
        <div className="rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-[18px] font-bold tracking-tight text-black">Feature comparison — vs Grindr / Romeo / MachoBB</h2>
            <button onClick={() => setCompare(!compare)} className="rounded-full border border-zinc-200 px-3 py-1 text-[12px] tracking-wide hover:bg-zinc-50">
              {compare ? "Simple" : "Detailed"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 font-medium">Feature</th>
                  <th className="pb-2 font-medium">Free</th>
                  <th className="pb-2 font-medium">XTRA</th>
                  <th className="pb-2 font-medium">Unlimited</th>
                  <th className="pb-2 font-medium">Grindr/Romeo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {[
                  { label: "Profiles visible", free: "100", xtra: "600", unlimited: "Unlimited", comp: "Grindr 100/600/Unlimited" },
                  { label: "Search options", free: "10", xtra: "30", unlimited: "120+", comp: "Romeo 120+ — we match" },
                  { label: "Incognito / Ghost", free: "—", xtra: "Hide visits", unlimited: "Full (ghost + offline)", comp: "Grindr XTRA/Unlimited" },
                  { label: "Unsend", free: "—", xtra: "✓", unlimited: "✓", comp: "Grindr Unlimited" },
                  { label: "Viewed Me / Visitors 7d", free: "—", xtra: "3d", unlimited: "7d + full", comp: "Grindr/Romeo 7d" },
                  { label: "Grindr Web desktop", free: "—", xtra: "—", unlimited: "✓", comp: "Grindr Unlimited" },
                  { label: "Private albums + expiring + screenshot block", free: "—", xtra: "✓", unlimited: "✓", comp: "Grindr XTRA+" },
                  { label: "Chat translation on-device", free: "—", xtra: "—", unlimited: "100+ langs", comp: "Grindr server-only — we on-device" },
                  { label: "Boosts / month", free: "1", xtra: "5", unlimited: "15", comp: "Grindr boost" },
                  { label: "Travel advance", free: "—", xtra: "7d", unlimited: "14d (Romeo)", comp: "Romeo 2 weeks" },
                  { label: "Voice / Video calls", free: "—", xtra: "Voice", unlimited: "Both", comp: "MachoBB voice/video" },
                  { label: "Selfie verification badge", free: "—", xtra: "✓", unlimited: "✓", comp: "MachoBB selfie" },
                  { label: "QuickShare", free: "—", xtra: "✓", unlimited: "✓", comp: "Romeo QuickShare" },
                  { label: "Multi-service tribes", free: "—", xtra: "—", unlimited: "✓ (Omolink)", comp: "MachoBB multi" },
                ].map((row) => (
                  <tr key={row.label} className="hover:bg-zinc-50/50">
                    <td className="py-2.5 font-medium text-black">{row.label}</td>
                    <td className="py-2.5 text-zinc-600">{row.free}</td>
                    <td className="py-2.5 text-zinc-600">{row.xtra}</td>
                    <td className="py-2.5 font-semibold text-black">{row.unlimited}</td>
                    <td className="py-2.5 text-[12px] text-zinc-500">{row.comp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "wallet" && (
        <div className="space-y-4">
          <div className="rounded-[20px] border border-black/[0.06] bg-gradient-to-br from-white to-zinc-50 p-6 text-center shadow-sm">
            <p className="font-display text-[36px] font-bold tracking-tight text-black">{wallet.balance}</p>
            <p className="text-[12px] uppercase tracking-widest text-zinc-500">Bones · Consumable currency</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={() => act.mutate({ action: "daily" })} className="rounded-full bg-black text-white"><Gift className="h-4 w-4" /> Daily reward</Button>
              <Button size="sm" variant="secondary" onClick={() => act.mutate({ action: "topup", packId: "pack_100" })} className="rounded-full border">+100 {BONE}</Button>
              <Button size="sm" variant="secondary" onClick={() => act.mutate({ action: "topup", packId: "pack_500" })} className="rounded-full border">+500 {BONE}</Button>
            </div>
          </div>

          {wallet.consumables.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Inventory</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {wallet.consumables.map((c) => (
                  <div key={c.type} className="rounded-[16px] border border-black/[0.06] bg-white p-4 text-center shadow-sm">
                    <p className="text-[20px]">{shop.find((s) => s.type === c.type)?.emoji ?? "🎁"}</p>
                    <p className="font-display text-[18px] font-bold tracking-tight text-black">{c.quantity}</p>
                    <p className="truncate text-[11px] tracking-wide text-zinc-500">{shop.find((s) => s.type === c.type)?.label ?? c.type}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Spend bones — boosts, gifts, King Pet</p>
            <div className="space-y-2">
              {shop.map((s) => (
                <div key={s.type} className="flex items-center gap-3 rounded-[16px] border border-black/[0.06] bg-white p-3 shadow-sm">
                  <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-zinc-100 text-[20px]">{s.emoji}</span>
                  <div className="min-w-0 flex-1"><p className="text-[14px] font-medium tracking-tight text-black">{s.label}</p><p className="truncate text-[12px] text-zinc-500">{s.desc}</p></div>
                  <Button size="sm" variant="secondary" disabled={wallet.balance < s.cost} onClick={() => act.mutate({ action: "buy", type: s.type })} className="rounded-full">{s.cost} {BONE}</Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
