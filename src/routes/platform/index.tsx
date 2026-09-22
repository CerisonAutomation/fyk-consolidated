import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getRoutingOptimization } from "@/lib/routing";
import { useMultiAccount, useAppConfig, useAppReady } from "@/hooks/app-hooks";
import { AppWiringPanel } from "@/components/app/AppWiringPanel";

export const Route = createFileRoute("/platform/")({
  component: PlatformPage,
});

function PlatformPage() {
  const [bundle, setBundle] = useState<ReturnType<typeof getRoutingOptimization>["bundle"] | null>(null);
  const [metrics, setMetrics] = useState<Array<{ name: string; value: number; unit: string; target: number; max: number; status: string }>>([]);
  const multiAccount = useMultiAccount();
  const appConfig = useAppConfig();
  const appReady = useAppReady();

  useEffect(() => {
    const opt = getRoutingOptimization(768, 3645);
    setBundle(opt.bundle);
    setMetrics(opt.benchmarks.metrics as never);
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Platform — Routing and Performance</h1>
        <p className="text-sm text-muted-foreground">Canonical routing, bundle optimization, benchmarks. Wires: useMultiAccount, useAppConfig, useAppReady. Source: src/lib/routing.</p>
      </div>

      <AppWiringPanel />

      <div className="border rounded-xl p-4 text-xs space-y-2">
        <h3 className="font-bold text-sm">Hook Wiring</h3>
        <div>MultiAccount: {multiAccount.accounts.length} accounts switching {String(multiAccount.switching)} current {multiAccount.currentAccountId?.slice(0, 8) ?? "none"}</div>
        <div>AppConfig: icon {appConfig.discreetIcon} enabled {String(appConfig.discreetEnabled)} lock {String(appConfig.appLockEnabled)} paused {String(appConfig.isPaused())}</div>
        <div>AppReady: {String(appReady.isReady)} offline pending {appReady.offline.pending.length}</div>
      </div>

      {bundle && (
        <div className="border rounded-xl p-4">
          <h3 className="font-bold">Bundle Optimization — {bundle.currentKb}KB to {bundle.initialKb}KB initial (saves {bundle.savingsKb}KB {bundle.savingsPercent}%)</h3>
          <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
            <div className="border rounded p-3"><div className="font-semibold">Critical</div><div className="text-2xl font-bold">{bundle.criticalKb}KB</div><div className="text-muted-foreground">Cached</div></div>
            <div className="border rounded p-3"><div className="font-semibold">Lazy</div><div className="text-2xl font-bold">{bundle.lazyKb}KB</div><div className="text-muted-foreground">Code-split 50%</div></div>
            <div className="border rounded p-3"><div className="font-semibold">Ultra-Lazy</div><div className="text-2xl font-bold">{bundle.ultraLazyKb}KB</div><div className="text-muted-foreground">On-demand 20%</div></div>
          </div>
          <div className="mt-3 text-xs font-mono border rounded p-2 bg-muted">{bundle.strategy}</div>
        </div>
      )}

      <div className="border rounded-xl p-4">
        <h3 className="font-bold">Deduplication — Canonical Routes</h3>
        <div className="mt-3 space-y-2 text-xs">
          {[
            { original: "/api/profile/analytics", canonical: "/api/profile/stats", reason: "analytics subset of stats", savingsKb: 2, savingsLines: 80 },
            { original: "/api/search/saved", canonical: "/api/discover/saved-searches", reason: "belongs to discover", savingsKb: 2, savingsLines: 80 },
            { original: "/api/safety/deletion", canonical: "/api/profile/deletion", reason: "profile lifecycle", savingsKb: 2, savingsLines: 80 },
            { original: "/api/monetization/voucher", canonical: "/api/monetization/promo", reason: "voucher is promo variant", savingsKb: 2, savingsLines: 80 },
            { original: "/api/profile/app-config", canonical: "/api/settings", reason: "app-config is settings sub", savingsKb: 2, savingsLines: 50 },
          ].map((d, i) => (
            <div key={i} className="border rounded p-2 flex justify-between items-center">
              <div><span className="font-mono bg-muted px-1 rounded">{d.original}</span><span className="mx-2">to</span><span className="font-mono bg-muted px-1 rounded">{d.canonical}</span><span className="ml-2 text-muted-foreground">{d.reason}</span></div>
              <div className="text-muted-foreground">saves {d.savingsKb}KB {d.savingsLines} lines</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-xl p-4">
        <h3 className="font-bold">Benchmarks</h3>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {metrics.map((m) => (
            <div key={m.name} className={`border rounded p-2 ${m.status === "pass" ? "bg-green-50 border-green-200" : m.status === "warn" ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"}`}>
              <div className="font-semibold">{m.name}</div>
              <div className="text-lg font-bold">{m.value}{m.unit}</div>
              <div className="text-xs">target {m.target}{m.unit} max {m.max}{m.unit} — {m.status.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-xl p-4">
        <h3 className="font-bold">Canonical Routes — 90+ Paths</h3>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <div className="border rounded p-2"><b>Auth (7):</b> sign-in, sign-up, callback, 2fa, sessions, phone, social, me</div>
          <div className="border rounded p-2"><b>Profile (14):</b> index, byId, stats, privacy, deletion, export, verification, wishlist, hot-pics, multi-account, app-config</div>
          <div className="border rounded p-2"><b>Discover (8):</b> index, compatibility, fresh, online, places, travel, saved-searches, grid-presets</div>
          <div className="border rounded p-2"><b>Social (8):</b> taps, favorites, blocks, hides, notes, footprints — explicit edges</div>
          <div className="border rounded p-2"><b>Chat (14):</b> conversations, messages, typing, read, broadcast, ephemeral, scheduled, pinned, themes, polls, location, screenshot, quiet-hours, rewarded</div>
          <div className="border rounded p-2"><b>Matches (5):</b> index, compatibility, daily-picks, likes-you, secret-admirer</div>
          <div className="border rounded p-2"><b>Content (8):</b> stories, gifts, catalog, live, albums</div>
          <div className="border rounded p-2"><b>Realtime (4):</b> calls, video-roulette, speed-dating, live</div>
          <div className="border rounded p-2"><b>Monetization (9):</b> subscription, coins, promo, consumables, boost, spotlight, pay-per-read, gift-membership, referral, paywall</div>
          <div className="border rounded p-2"><b>Safety (9):</b> report, block, contacts, check-in, emergency-share, appeals, 2fa, rate-limit</div>
          <div className="border rounded p-2"><b>AI (19):</b> icebreaker, bio, context-replies, rizz-score, compatibility, safety, translation, avatar, voice, match-reasons, autocomplete, debrief, insights, photo-enhancer</div>
          <div className="border rounded p-2"><b>Growth (4):</b> completion, engagement, funnel, streak</div>
          <div className="border rounded p-2"><b>Platform (6):</b> health, settings, offline, backup, queue, admin</div>
        </div>
      </div>
    </div>
  );
}
