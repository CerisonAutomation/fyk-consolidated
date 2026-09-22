import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Crown, Zap, Shield, MapPin, Check, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { pricing, formatPrice, calculateDiscountedPrice } from "@/core/billing/pricing";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/paywall/")({
  component: PaywallScreen,
});

function PaywallScreen() {
  const [_selectedTier] = useState<"gold" | "platinum">("gold");
  const [promoCode, setPromoCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const { tier: currentTier } = useSubscription();

  const { data: promoValid } = useQuery({
    queryKey: ["promo", promoCode],
    queryFn: async () => {
      if (!promoCode) return null;
      const res = await fetch(`/api/billing/promo?code=${promoCode}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!promoCode && promoCode.length >= 4,
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ tier, promo }: { tier: string; promo?: string }) => {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, promoCode: promo, currency: "EUR" }),
      });
      if (!res.ok) throw new Error("Checkout failed");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const handleApplyPromo = () => {
    if (promoValid?.valid) {
      setAppliedDiscount(promoValid.discount);
    }
  };

  const goldPrice = promoCode ? calculateDiscountedPrice(pricing.gold.price.monthly, promoCode) : pricing.gold.price.monthly;
  const platinumPrice = promoCode ? calculateDiscountedPrice(pricing.platinum.price.monthly, promoCode) : pricing.platinum.price.monthly;

  const features = [
    { name: "Discover nearby", free: true, gold: true, platinum: true, grindrFree: true, grindrXtra: true, grindrUnlimited: true },
    { name: "Chat & messages", free: true, gold: true, platinum: true, grindrFree: true, grindrXtra: true, grindrUnlimited: true },
    { name: "View who viewed me", free: false, gold: true, platinum: true, grindrFree: false, grindrXtra: false, grindrUnlimited: true },
    { name: "Incognito browsing", free: false, gold: true, platinum: true, grindrFree: false, grindrXtra: false, grindrUnlimited: true },
    { name: "Travel mode / Explore", free: false, gold: true, platinum: true, grindrFree: false, grindrXtra: true, grindrUnlimited: true },
    { name: "Unlimited profiles", free: false, gold: true, platinum: true, grindrFree: false, grindrXtra: false, grindrUnlimited: true },
    { name: "Ad-free experience", free: false, gold: true, platinum: true, grindrFree: false, grindrXtra: true, grindrUnlimited: true },
    { name: "5 boosts / day", free: false, gold: true, platinum: false, grindrFree: false, grindrXtra: false, grindrUnlimited: false },
    { name: "Unlimited boosts", free: false, gold: false, platinum: true, grindrFree: false, grindrXtra: false, grindrUnlimited: true },
    { name: "Video dates WebRTC", free: false, gold: false, platinum: true, grindrFree: false, grindrXtra: false, grindrUnlimited: false },
    { name: "AI wingman & rizz", free: false, gold: true, platinum: true, grindrFree: false, grindrXtra: false, grindrUnlimited: false },
    { name: "AI photo ranker", free: false, gold: true, platinum: true, grindrFree: false, grindrXtra: false, grindrUnlimited: false },
    { name: "Private albums unlock", free: false, gold: true, platinum: true, grindrFree: false, grindrXtra: true, grindrUnlimited: true },
    { name: "Screenshot blocking", free: true, gold: true, platinum: true, grindrFree: true, grindrXtra: true, grindrUnlimited: true },
    { name: "Unsend messages", free: false, gold: true, platinum: true, grindrFree: false, grindrXtra: false, grindrUnlimited: true },
  ];

  return (
    <div className="mx-auto max-w-5xl p-4 pb-24">
      <div className="mb-8 rounded-[24px] border border-black/[0.06] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-[28px] font-bold tracking-tight text-black">Upgrade your experience</h1>
            <p className="mt-1 text-[14px] text-zinc-500">Compare FYK vs Grindr — more features, fair € pricing, no dark patterns</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-[16px] border border-black/[0.06] bg-zinc-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Current</p>
            <p className="mt-1 font-medium capitalize text-black">{currentTier}</p>
            <p className="mt-1 text-[12px] text-zinc-500">You are on {currentTier} tier</p>
          </div>
          <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Promo</p>
            <div className="mt-2 flex gap-2">
              <input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="WELCOME15"
                className="w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[13px] outline-none focus:border-black"
              />
              <Button onClick={handleApplyPromo} className="shrink-0 rounded-[10px] bg-black px-4 text-white">
                Apply
              </Button>
            </div>
            {promoValid?.valid && <p className="mt-2 text-[12px] text-emerald-600">✓ {promoValid.discount}% off applied</p>}
            {appliedDiscount > 0 && <p className="mt-1 text-[11px] text-zinc-500">Discount: {appliedDiscount}%</p>}
          </div>
          <div className="rounded-[16px] border border-black/[0.06] bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Billing</p>
            <p className="mt-1 text-[13px] text-black">€ pricing • Stripe • RevenueCat • No hidden fees</p>
            <p className="mt-1 text-[11px] text-zinc-500">Cancel anytime, GDPR data export</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[18px] font-bold text-black">Free</h3>
            <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Free</span>
          </div>
          <p className="mt-2 text-[28px] font-bold tracking-tight text-black">€0</p>
          <p className="text-[12px] text-zinc-500">Forever free, no ads? No, with ads</p>
          <div className="mt-4 space-y-2">
            <p className="flex items-center gap-2 text-[13px] text-zinc-700"><Check className="h-4 w-4 text-emerald-600" /> Discover & chat</p>
            <p className="flex items-center gap-2 text-[13px] text-zinc-400"><X className="h-4 w-4" /> Viewed me, incognito, travel</p>
          </div>
          <Button disabled className="mt-6 w-full rounded-[12px] bg-zinc-100 text-zinc-500">Current plan</Button>
        </div>

        <div className="rounded-[20px] border-2 border-amber-300 bg-white p-5 shadow-[0_0_0_1px_rgba(251,191,36,0.3),0_8px_24px_rgba(251,191,36,0.15)]">
          <div className="flex items-center justify-between">
            <h3 className="font-display flex items-center gap-2 text-[18px] font-bold text-black"><Crown className="h-4 w-4 text-amber-500" /> Gold</h3>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700">Popular</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-[28px] font-bold tracking-tight text-black">{formatPrice(goldPrice)}</p>
            <p className="text-[13px] text-zinc-500">/ month</p>
            {appliedDiscount > 0 && <p className="text-[12px] line-through text-zinc-400">{formatPrice(pricing.gold.price.monthly)}</p>}
          </div>
          <p className="text-[12px] text-zinc-500">Yearly {formatPrice(pricing.gold.price.yearly)} • Save 50%</p>
          <div className="mt-4 space-y-2">
            <p className="flex items-center gap-2 text-[13px] text-zinc-700"><Check className="h-4 w-4 text-emerald-600" /> Viewed me, incognito, travel</p>
            <p className="flex items-center gap-2 text-[13px] text-zinc-700"><Check className="h-4 w-4 text-emerald-600" /> 5 boosts/day, ad-free</p>
            <p className="flex items-center gap-2 text-[13px] text-zinc-700"><Check className="h-4 w-4 text-emerald-600" /> AI wingman, photo ranker</p>
            <p className="flex items-center gap-2 text-[13px] text-zinc-700"><Check className="h-4 w-4 text-emerald-600" /> Unsend, private albums</p>
          </div>
          <Button
            onClick={() => checkoutMutation.mutate({ tier: "gold", promo: promoCode })}
            className="mt-6 w-full rounded-[12px] bg-black text-white hover:bg-zinc-900"
          >
            {checkoutMutation.isPending ? "Processing..." : "Upgrade to Gold"}
          </Button>
          <p className="mt-2 text-center text-[11px] text-zinc-500">Stripe • Cancel anytime</p>
        </div>

        <div className="rounded-[20px] border border-black/[0.06] bg-zinc-950 p-5 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-display flex items-center gap-2 text-[18px] font-bold"><Sparkles className="h-4 w-4 text-amber-300" /> Platinum</h3>
            <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest">Max</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-[28px] font-bold tracking-tight">{formatPrice(platinumPrice)}</p>
            <p className="text-[13px] text-zinc-400">/ month</p>
            {appliedDiscount > 0 && <p className="text-[12px] line-through text-zinc-500">{formatPrice(pricing.platinum.price.monthly)}</p>}
          </div>
          <p className="text-[12px] text-zinc-400">Yearly {formatPrice(pricing.platinum.price.yearly)} • Best value</p>
          <div className="mt-4 space-y-2">
            <p className="flex items-center gap-2 text-[13px] text-zinc-200"><Check className="h-4 w-4 text-amber-300" /> Unlimited boosts</p>
            <p className="flex items-center gap-2 text-[13px] text-zinc-200"><Check className="h-4 w-4 text-amber-300" /> Video dates WebRTC</p>
            <p className="flex items-center gap-2 text-[13px] text-zinc-200"><Check className="h-4 w-4 text-amber-300" /> Priority support</p>
            <p className="flex items-center gap-2 text-[13px] text-zinc-200"><Check className="h-4 w-4 text-amber-300" /> Everything in Gold</p>
          </div>
          <Button
            onClick={() => checkoutMutation.mutate({ tier: "platinum", promo: promoCode })}
            className="mt-6 w-full rounded-[12px] bg-white text-black hover:bg-zinc-100"
          >
            {checkoutMutation.isPending ? "Processing..." : "Upgrade to Platinum"}
          </Button>
        </div>
      </div>

      <div className="mt-8 rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-sm">
        <h3 className="font-display text-[18px] font-bold text-black">FYK vs Grindr — honest comparison</h3>
        <p className="mt-1 text-[12px] text-zinc-500">Grindr XTRA removes ads, expands views; Unlimited adds Viewed Me, Incognito, unsend, unlimited profiles, Web. FYK includes AI, video dates, boosts at fair € pricing.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-[11px] uppercase tracking-widest text-zinc-500">
                <th className="py-2 pr-2">Feature</th>
                <th className="py-2 px-2">Free</th>
                <th className="py-2 px-2">Gold {formatPrice(pricing.gold.price.monthly)}</th>
                <th className="py-2 px-2">Platinum {formatPrice(pricing.platinum.price.monthly)}</th>
                <th className="py-2 px-2">Grindr Free</th>
                <th className="py-2 px-2">Grindr XTRA</th>
                <th className="py-2 pl-2">Grindr Unlimited</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f.name} className="border-b border-black/[0.04] last:border-0">
                  <td className="py-2 pr-2 font-medium text-black">{f.name}</td>
                  <td className="py-2 px-2 text-center">{f.free ? "✓" : "—"}</td>
                  <td className="py-2 px-2 text-center">{f.gold ? "✓" : "—"}</td>
                  <td className="py-2 px-2 text-center">{f.platinum ? "✓" : "—"}</td>
                  <td className="py-2 px-2 text-center text-zinc-500">{f.grindrFree ? "✓" : "—"}</td>
                  <td className="py-2 px-2 text-center text-zinc-500">{f.grindrXtra ? "✓" : "—"}</td>
                  <td className="py-2 pl-2 text-center text-zinc-500">{f.grindrUnlimited ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[11px] text-zinc-500">Sources: Grindr App Store, APKPure, PrinceJock 2025 review, QWE AI features guide. FYK adds AI wingman, photo ranker, video dates, unlimited boosts — not in Grindr free. Fair € pricing, no dark patterns, GDPR export/delete, screenshot blocking private albums.</p>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-[16px] border border-black/[0.06] bg-white p-4">
          <p className="flex items-center gap-2 text-[13px] font-medium text-black"><Zap className="h-4 w-4" /> Boost consumable</p>
          <p className="mt-1 text-[12px] text-zinc-500">30min visibility, 10x super boost {formatPrice(pricing.consumables.superBoost.price)} • {formatPrice(pricing.consumables.boost.price)} regular</p>
        </div>
        <div className="rounded-[16px] border border-black/[0.06] bg-white p-4">
          <p className="flex items-center gap-2 text-[13px] font-medium text-black"><Shield className="h-4 w-4" /> Safety first</p>
          <p className="mt-1 text-[12px] text-zinc-500">Toxicity 0.7 threshold, auto-block 3 flags, screenshot blocking, 2FA TOTP, private albums blank capture</p>
        </div>
        <div className="rounded-[16px] border border-black/[0.06] bg-white p-4">
          <p className="flex items-center gap-2 text-[13px] font-medium text-black"><MapPin className="h-4 w-4" /> Travel & discreet</p>
          <p className="mt-1 text-[12px] text-zinc-500">Hide real GPS, travel 2 weeks prior, discreet icon, DND 22:00-07:00, PIN lock</p>
        </div>
      </div>
    </div>
  );
}
