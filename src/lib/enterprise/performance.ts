/**
 * Enterprise Performance — Budgets, LCP, INP, CLS, caching, optimization
 * Gold: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at 75th percentile
 */

export type PerformanceBudget = {
  name: string;
  maxLcpMs: number;
  maxInpMs: number;
  maxCls: number;
  maxBundleKb: number;
  maxApiP50Ms: number;
  maxApiP95Ms: number;
  maxApiP99Ms: number;
};

export const DEFAULT_BUDGET: PerformanceBudget = {
  name: "default",
  maxLcpMs: 2500,
  maxInpMs: 200,
  maxCls: 0.1,
  maxBundleKb: 300,
  maxApiP50Ms: 100,
  maxApiP95Ms: 200,
  maxApiP99Ms: 400,
};

export const BUDGETS: Record<string, PerformanceBudget> = {
  default: DEFAULT_BUDGET,
  discover: { ...DEFAULT_BUDGET, maxLcpMs: 2000, maxBundleKb: 250 },
  chat: { ...DEFAULT_BUDGET, maxLcpMs: 1500, maxApiP50Ms: 50 },
  profile: { ...DEFAULT_BUDGET, maxLcpMs: 2000 },
  admin: { ...DEFAULT_BUDGET, maxLcpMs: 3000, maxBundleKb: 500 },
};

export function checkBudget(metrics: { lcp?: number; inp?: number; cls?: number; bundleKb?: number; p50?: number; p95?: number; p99?: number }, budget: PerformanceBudget = DEFAULT_BUDGET): { pass: boolean; failures: string[]; warnings: string[] } {
  const failures: string[] = [];
  const warnings: string[] = [];

  if (metrics.lcp !== undefined) {
    if (metrics.lcp > budget.maxLcpMs) failures.push(`LCP ${metrics.lcp}ms > ${budget.maxLcpMs}ms`);
    else if (metrics.lcp > budget.maxLcpMs * 0.8) warnings.push(`LCP ${metrics.lcp}ms near budget ${budget.maxLcpMs}ms`);
  }
  if (metrics.inp !== undefined) {
    if (metrics.inp > budget.maxInpMs) failures.push(`INP ${metrics.inp}ms > ${budget.maxInpMs}ms`);
    else if (metrics.inp > budget.maxInpMs * 0.8) warnings.push(`INP ${metrics.inp}ms near budget`);
  }
  if (metrics.cls !== undefined) {
    if (metrics.cls > budget.maxCls) failures.push(`CLS ${metrics.cls} > ${budget.maxCls}`);
    else if (metrics.cls > budget.maxCls * 0.8) warnings.push(`CLS ${metrics.cls} near budget`);
  }
  if (metrics.bundleKb !== undefined && metrics.bundleKb > budget.maxBundleKb) failures.push(`Bundle ${metrics.bundleKb}KB > ${budget.maxBundleKb}KB`);
  if (metrics.p50 !== undefined && metrics.p50 > budget.maxApiP50Ms) failures.push(`p50 ${metrics.p50}ms > ${budget.maxApiP50Ms}ms`);
  if (metrics.p95 !== undefined && metrics.p95 > budget.maxApiP95Ms) failures.push(`p95 ${metrics.p95}ms > ${budget.maxApiP95Ms}ms`);
  if (metrics.p99 !== undefined && metrics.p99 > budget.maxApiP99Ms) failures.push(`p99 ${metrics.p99}ms > ${budget.maxApiP99Ms}ms`);

  return { pass: failures.length === 0, failures, warnings };
}

// Multi-layer caching — memory, CDN, DB
export type CacheLayer = "memory" | "cdn" | "db" | "none";
export type CacheEntry<T> = { value: T; expiresAt: number; layer: CacheLayer; hits: number };

export class MultiLayerCache {
  private memory = new Map<string, CacheEntry<unknown>>();
  private maxMemory = 1000;

  async get<T>(key: string): Promise<{ value: T; layer: CacheLayer; hits: number } | null> {
    const entry = this.memory.get(key) as CacheEntry<T> | undefined;
    if (entry && entry.expiresAt > Date.now()) {
      entry.hits++;
      return { value: entry.value, layer: entry.layer, hits: entry.hits };
    }
    if (entry) this.memory.delete(key);
    return null;
  }

  async set<T>(key: string, value: T, ttlSec: number, layer: CacheLayer = "memory"): Promise<void> {
    if (this.memory.size >= this.maxMemory) {
      const oldest = Array.from(this.memory.entries()).sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
      if (oldest) this.memory.delete(oldest[0]);
    }
    this.memory.set(key, { value, expiresAt: Date.now() + ttlSec * 1000, layer, hits: 0 });
  }

  async delete(key: string): Promise<void> {
    this.memory.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern);
    let count = 0;
    for (const key of this.memory.keys()) if (regex.test(key)) { this.memory.delete(key); count++; }
    return count;
  }

  stats() {
    return { size: this.memory.size, max: this.maxMemory, layers: { memory: this.memory.size } };
  }
}

export const cache = new MultiLayerCache();

// Stale-while-revalidate
export async function staleWhileRevalidate<T>(key: string, fetcher: () => Promise<T>, ttlSec: number, staleTtlSec: number): Promise<T> {
  const cached = await cache.get<T>(key);
  if (cached) {
    const entry = (cache as any).memory.get(key) as CacheEntry<T>;
    const isStale = entry.expiresAt < Date.now();
    const isExpired = entry.expiresAt + staleTtlSec * 1000 < Date.now();

    if (!isExpired) {
      if (isStale) {
        // Background revalidate
        fetcher().then((value) => cache.set(key, value, ttlSec)).catch(() => {});
      }
      return cached.value;
    }
  }

  const value = await fetcher();
  await cache.set(key, value, ttlSec);
  return value;
}

// Bundle analysis
export type BundleAnalysis = {
  totalKb: number;
  byRoute: Array<{ route: string; kb: number; percent: number }>;
  duplicates: Array<{ module: string; count: number; totalKb: number }>;
  recommendations: string[];
};

export function analyzeBundles(bundles: Array<{ route: string; kb: number }>): BundleAnalysis {
  const totalKb = bundles.reduce((sum, b) => sum + b.kb, 0);
  const byRoute = bundles.map((b) => ({ ...b, percent: Math.round((b.kb / totalKb) * 100) })).sort((a, b) => b.kb - a.kb);

  // Find large routes
  const recommendations: string[] = [];
  for (const b of byRoute) {
    if (b.kb > 50) recommendations.push(`${b.route} is ${b.kb}KB — consider lazyRouteComponent`);
    if (b.kb > 100) recommendations.push(`${b.route} is ${b.kb}KB — critical, split into chunks`);
  }

  if (totalKb > 300) recommendations.push(`Total ${totalKb}KB > 300KB target — enable more code splitting`);

  return { totalKb, byRoute, duplicates: [], recommendations };
}

// Image optimization — responsive, lazy, content-visibility
export function getResponsiveImageSrc(src: string, width: number): string {
  // In production, use CDN with width param
  if (src.includes("supabase")) return `${src}?width=${width}&quality=80&format=webp`;
  return src;
}

export function getImageSrcSet(src: string, widths: number[] = [320, 640, 1024, 1920]): string {
  return widths.map((w) => `${getResponsiveImageSrc(src, w)} ${w}w`).join(", ");
}
