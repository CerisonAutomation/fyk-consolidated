import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/monetization/promo/")({
  component: PromoPage,
});

function PromoPage() {
  const [code, setCode] = useState("");
  const [promos, setPromos] = useState<Array<{ id: string; code: string; discountPercent?: number; freeDays?: number; freeCoins?: number; usedCount: number; maxUses: number; expiresAt: string }>>([]);
  const [result, setResult] = useState<{ ok: boolean; message?: string; error?: string; discount?: string; freeDays?: number; freeCoins?: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/monetization/promo")
      .then((r) => r.json())
      .then((d) => {
        setPromos(d.promos ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const redeem = async () => {
    if (!code.trim()) return;
    const res = await fetch("/api/monetization/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.toUpperCase() }),
    });
    const data = await res.json();
    setResult(data);
  };

  if (loading)
    return (
      <div className="p-4">
        <div className="animate-pulse h-20 bg-muted rounded-xl" />
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Promo Codes</h1>
        <p className="text-sm text-muted-foreground">Canonical endpoint /api/monetization/promo — DB with usage tracking and expiry. Voucher consolidated into promo.</p>
      </div>

      <div className="border rounded-xl p-4 space-y-3">
        <h3 className="font-semibold">Redeem Code</h3>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="WELCOME15"
            className="flex-1 px-3 py-2 border rounded-full text-sm uppercase"
          />
          <button onClick={redeem} className="px-4 py-2 bg-primary text-white rounded-full text-xs font-semibold">
            Redeem
          </button>
        </div>
        {result && (
          <div className={`border rounded-xl p-3 text-xs ${result.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
            {result.ok ? `${result.message} — ${result.discount ?? ""} ${result.freeDays ? `${result.freeDays} free days` : ""} ${result.freeCoins ? `${result.freeCoins} coins` : ""}` : result.error}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Available Promos</h4>
        {promos.slice(0, 5).map((p) => (
          <div key={p.id} className="border rounded-xl p-3 flex justify-between items-center">
            <div>
              <div className="font-mono font-bold text-sm">{p.code}</div>
              <div className="text-xs text-muted-foreground">
                {p.discountPercent ? `${p.discountPercent}% off` : ""} {p.freeDays ? `${p.freeDays} free days` : ""} {p.freeCoins ? `${p.freeCoins} coins` : ""} • {p.usedCount}/{p.maxUses} used • Expires {new Date(p.expiresAt).toLocaleDateString()}
              </div>
            </div>
            <button onClick={() => setCode(p.code)} className="px-3 py-1 border rounded-full text-xs">
              Use
            </button>
          </div>
        ))}
        {promos.length === 0 && (
          <div className="border rounded-xl p-8 text-center">
            <div className="font-semibold text-sm">No active promos</div>
            <div className="text-xs text-muted-foreground">Check socials for current codes — WELCOME15, PREMIUM20, ELITE30</div>
          </div>
        )}
      </div>

      <div className="border rounded-xl p-3">
        <h4 className="font-semibold text-sm mb-2">Implementation Notes</h4>
        <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
          <li>Deduplicated: /api/monetization/voucher consolidated into /api/monetization/promo</li>
          <li>Single source for promo logic</li>
          <li>DB tables: promo_codes and promo_redemptions, unique per user</li>
          <li>Validates expiry, max uses, minimum tier</li>
          <li>Seed codes: WELCOME15 (15% off plus), PREMIUM20 (20% gold), ELITE30 (30% platinum) — legacy codes premium15 etc remain as aliases for compatibility</li>
        </ul>
      </div>
    </div>
  );
}
