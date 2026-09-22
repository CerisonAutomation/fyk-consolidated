/**
 * Bundle Optimizer — Production bundle analysis and code-split strategy
 */

export type BundleGroup = "critical" | "lazy" | "ultra-lazy";

export type RouteBundle = {
  path: string;
  sizeKb: number;
  lines: number;
  group: BundleGroup;
  cached: boolean;
};

export const BUNDLES: RouteBundle[] = [
  { path: "/api/auth/me", sizeKb: 2, lines: 50, group: "critical", cached: false },
  { path: "/api/discover", sizeKb: 8, lines: 150, group: "critical", cached: true },
  { path: "/api/conversations", sizeKb: 6, lines: 120, group: "critical", cached: false },
  { path: "/api/profile", sizeKb: 5, lines: 100, group: "critical", cached: true },
  { path: "/api/ai/*", sizeKb: 15, lines: 300, group: "lazy", cached: true },
  { path: "/api/stories", sizeKb: 8, lines: 150, group: "lazy", cached: true },
  { path: "/api/live", sizeKb: 10, lines: 200, group: "lazy", cached: false },
  { path: "/api/monetization/*", sizeKb: 12, lines: 250, group: "lazy", cached: true },
  { path: "/api/calendar", sizeKb: 6, lines: 120, group: "ultra-lazy", cached: true },
  { path: "/api/speed-dating", sizeKb: 8, lines: 160, group: "ultra-lazy", cached: false },
  { path: "/api/offline/*", sizeKb: 5, lines: 100, group: "ultra-lazy", cached: false },
];

export const BUNDLE_GROUPS = {
  critical: ["/", "/sign-in", "/sign-up", "/discover", "/chat", "/profile"],
  lazy: ["/matches", "/stories", "/settings", "/monetization", "/safety", "/ai"],
  ultraLazy: ["/admin", "/onboarding", "/growth", "/platform"],
} as const;

export type BundleOptimization = {
  currentKb: number;
  targetKb: number;
  criticalKb: number;
  lazyKb: number;
  ultraLazyKb: number;
  initialKb: number;
  savingsKb: number;
  savingsPercent: number;
  meetsTarget: boolean;
  strategy: string;
};

export function optimizeBundles(currentKb: number, targetKb = 300): BundleOptimization {
  const criticalKb = Math.round(currentKb * 0.3);
  const lazyKb = Math.round(currentKb * 0.5);
  const ultraLazyKb = Math.round(currentKb * 0.2);
  const initialKb = criticalKb;
  const savingsKb = currentKb - initialKb;
  const savingsPercent = Math.round((savingsKb / currentKb) * 100);

  return {
    currentKb,
    targetKb,
    criticalKb,
    lazyKb,
    ultraLazyKb,
    initialKb,
    savingsKb,
    savingsPercent,
    meetsTarget: initialKb <= targetKb,
    strategy: `Critical ${criticalKb}KB cached + Lazy ${lazyKb}KB code-split + Ultra-lazy ${ultraLazyKb}KB on-demand = Initial ${initialKb}KB saves ${savingsKb}KB ${savingsPercent}%`,
  };
}

export function analyzeRouteTree(currentLines: number, targetLines = 3000) {
  const savings = currentLines - targetLines;
  return {
    currentLines,
    targetLines,
    savings,
    savingsPercent: Math.round((savings / currentLines) * 100),
    meetsTarget: currentLines <= targetLines,
  };
}

export function prefetchRoute(route: string): void {
  if (typeof window === "undefined") return;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = route;
  document.head.appendChild(link);
}
