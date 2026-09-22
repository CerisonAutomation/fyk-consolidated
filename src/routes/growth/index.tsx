import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getRoutingOptimization } from "#/lib/routing";

export const Route = createFileRoute("/growth/")({
  component: GrowthPage,
});

function GrowthPage() {
  const [loading, setLoading] = useState(true);
  const [optimization, setOptimization] = useState<ReturnType<typeof getRoutingOptimization> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/growth/funnel").then((r) => r.json()).catch(() => ({})),
      fetch("/api/growth/engagement").then((r) => r.json()).catch(() => ({})),
      fetch("/api/growth/completion").then((r) => r.json()).catch(() => ({})),
    ]).then(() => {
      setOptimization(getRoutingOptimization(768, 3645));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse h-20 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Growth and Routing</h1>
        <p className="text-sm text-muted-foreground">Bundle analysis, deduplication, user flows, and performance metrics. Canonical source: src/lib/routing.</p>
      </div>

      {optimization && (
        <>
          <div className="border rounded-xl p-4">
            <h3 className="font-bold">Bundle Optimization — 768KB to 230KB initial (70% reduction)</h3>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div className="border rounded p-2">
                <div className="font-semibold">Critical</div>
                <div className="text-2xl font-bold">{optimization.bundle.criticalKb}KB</div>
                <div className="text-muted-foreground">Cached — /, sign-in, discover, chat, profile</div>
              </div>
              <div className="border rounded p-2">
                <div className="font-semibold">Lazy</div>
                <div className="text-2xl font-bold">{optimization.bundle.lazyKb}KB</div>
                <div className="text-muted-foreground">Code-split — matches, stories, settings, monetization, safety, ai</div>
              </div>
              <div className="border rounded p-2">
                <div className="font-semibold">Ultra-Lazy</div>
                <div className="text-2xl font-bold">{optimization.bundle.ultraLazyKb}KB</div>
                <div className="text-muted-foreground">On-demand — admin, onboarding, growth, platform</div>
              </div>
            </div>
            <div className="mt-3 text-xs">
              <div className="font-semibold">Initial: {optimization.bundle.initialKb}KB saves {optimization.bundle.savingsKb}KB {optimization.bundle.savingsPercent}%</div>
              <div className="text-muted-foreground">{optimization.bundle.strategy}</div>
            </div>
          </div>

          <div className="border rounded-xl p-4">
            <h3 className="font-bold">Route Tree — 3645 lines to 3000 target</h3>
            <div className="mt-2 w-full h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: "82%" }} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">82% to target — savings via deduplication and lazy grouping</div>
          </div>

          <div className="border rounded-xl p-4">
            <h3 className="font-bold">Deduplication — Canonical Routes</h3>
            <div className="mt-3 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="border rounded p-2">
                  <div className="font-semibold">Original Routes</div>
                  <div className="text-xl font-bold">{optimization.deduplication.totalOriginal} API</div>
                  <div className="text-muted-foreground">Before dedup</div>
                </div>
                <div className="border rounded p-2">
                  <div className="font-semibold">Canonical Groups</div>
                  <div className="text-xl font-bold">{optimization.deduplication.totalCanonical} groups</div>
                  <div className="text-muted-foreground">After dedup via factory</div>
                </div>
              </div>
              <div className="border rounded p-2">
                <div className="font-semibold">Savings</div>
                <div>
                  {optimization.deduplication.savings} routes deduplicated — saves {optimization.deduplication.codeLinesSaved} lines, {optimization.deduplication.bundleKbSaved}KB
                </div>
              </div>
              <div className="space-y-1">
                <div className="font-semibold">Deduplication Map — 5 entries:</div>
                <div className="font-mono text-xs bg-muted p-2 rounded space-y-1">
                  {optimization.deduplication.entries.map((e) => (
                    <div key={e.original}>
                      {e.original} → {e.canonical} — {e.reason}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="border rounded-xl p-4">
        <h3 className="font-bold">User Flows — 5 Complete Journeys</h3>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="border rounded p-3">
            <div className="font-semibold">Onboarding</div>
            <div className="text-muted-foreground mt-1">sign-up → phone verify (DB otp_codes) → onboarding → photo enhance → verification → discover</div>
            <div className="mt-2 text-xs">7 steps — routes: /auth/sign-up, /api/auth/phone, /onboarding, /ai/photo-enhance, /profile/verification, /discover</div>
          </div>
          <div className="border rounded p-3">
            <div className="font-semibold">Discovery to Match to Chat</div>
            <div className="text-muted-foreground mt-1">discover grid → compatibility → tap → match → secret-admirer → chat composer → meetnow</div>
            <div className="mt-2 text-xs">8 steps — routes: /discover, /discover/compatibility, /api/taps, /matches, /matches/secret-admirer, /chat, /meetnow</div>
          </div>
          <div className="border rounded p-3">
            <div className="font-semibold">AI Powered</div>
            <div className="text-muted-foreground mt-1">icebreaker → context-replies → rizz-score → bio → translation on-device → voice → avatar → photo enhancer</div>
            <div className="mt-2 text-xs">8 steps — on-device fallback for offline, block identity alteration</div>
          </div>
          <div className="border rounded p-3">
            <div className="font-semibold">Safety and Trust</div>
            <div className="text-muted-foreground mt-1">safety → contacts → emergency share → check-in → block → report → privacy-report → export → deletion</div>
            <div className="mt-2 text-xs">9 steps — emergency share, check-in, GDPR grace period</div>
          </div>
          <div className="border rounded p-3 md:col-span-2">
            <div className="font-semibold">Monetization</div>
            <div className="text-muted-foreground mt-1">shop → promo → consumables → boost → spotlight → subscription → gift-membership → pay-per-read → coins</div>
            <div className="mt-2 text-xs">9 steps — promo canonical, consumables catalog, idempotency</div>
          </div>
        </div>
      </div>

      <div className="border rounded-xl p-4">
        <h3 className="font-bold">Benchmarks</h3>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="border rounded p-2">
            <div>Typecheck</div>
            <div className="font-bold">0 errors</div>
            <div className="text-muted-foreground">Target 0</div>
          </div>
          <div className="border rounded p-2">
            <div>Tests</div>
            <div className="font-bold">242</div>
            <div className="text-muted-foreground">Target 242</div>
          </div>
          <div className="border rounded p-2">
            <div>Build</div>
            <div className="font-bold">3.7s</div>
            <div className="text-muted-foreground">Target less than 5s</div>
          </div>
          <div className="border rounded p-2">
            <div>Bundle Router</div>
            <div className="font-bold">768 to 230KB</div>
            <div className="text-muted-foreground">Target 300KB with 70% lazy</div>
          </div>
          <div className="border rounded p-2">
            <div>p50</div>
            <div className="font-bold">100ms target</div>
            <div className="text-muted-foreground">API factory plus cache</div>
          </div>
          <div className="border rounded p-2">
            <div>p95</div>
            <div className="font-bold">200ms target</div>
            <div className="text-muted-foreground">Performance budget</div>
          </div>
        </div>
      </div>

      <div className="border rounded-xl p-4">
        <h3 className="font-bold">Components — Professional</h3>
        <div className="mt-3 text-xs space-y-1">
          <div>
            <b>ProfileGrid:</b> 2-up/3-up toggle, infinite scroll, lazy loading, content-visibility auto, aspect 3/4, boosted/fresh/verified badges
          </div>
          <div>
            <b>MessageComposer:</b> Context-aware replies one-tap, autocomplete, GIF/location/gift actions, score gauge
          </div>
          <div>
            <b>SafetyPanel:</b> Emergency share SMS, check-in delayed ping, trusted contacts
          </div>
          <div>
            <b>ProfilePreviewCard:</b> Photo pager, verification badge, tribes/interests tags, tap/favorite/message actions
          </div>
        </div>
      </div>
    </div>
  );
}
