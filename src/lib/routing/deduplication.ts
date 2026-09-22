import { DEDUPLICATION_MAP, getAllPaths } from "./canonical-routes";

export type DeduplicationEntry = {
  original: string;
  canonical: string;
  reason: string;
  savingsKb: number;
  savingsLines: number;
};

export const DEDUPLICATION_ENTRIES: DeduplicationEntry[] = [
  {
    original: "/api/profile/analytics",
    canonical: "/api/profile/stats",
    reason: "Analytics is subset of stats dashboard",
    savingsKb: 2,
    savingsLines: 80,
  },
  {
    original: "/api/search/saved",
    canonical: "/api/discover/saved-searches",
    reason: "Saved search belongs to discover domain",
    savingsKb: 2,
    savingsLines: 80,
  },
  {
    original: "/api/safety/deletion",
    canonical: "/api/profile/deletion",
    reason: "Deletion is profile lifecycle",
    savingsKb: 2,
    savingsLines: 80,
  },
  {
    original: "/api/monetization/voucher",
    canonical: "/api/monetization/promo",
    reason: "Voucher is promo code variant",
    savingsKb: 2,
    savingsLines: 80,
  },
  {
    original: "/api/profile/app-config",
    canonical: "/api/settings",
    reason: "App config is settings sub-route",
    savingsKb: 2,
    savingsLines: 50,
  },
];

export function getDeduplicationStats() {
  const totalOriginal = getAllPaths().length + DEDUPLICATION_ENTRIES.length;
  const totalCanonical = getAllPaths().length;
  const savings = DEDUPLICATION_ENTRIES.length;
  const codeLinesSaved = DEDUPLICATION_ENTRIES.reduce((a, b) => a + b.savingsLines, 0);
  const bundleKbSaved = DEDUPLICATION_ENTRIES.reduce((a, b) => a + b.savingsKb, 0);

  return {
    totalOriginal,
    totalCanonical,
    savings,
    duplicationScore: Math.round((1 - totalCanonical / totalOriginal) * 100),
    codeLinesSaved,
    bundleKbSaved,
    entries: DEDUPLICATION_ENTRIES,
  };
}

export function resolveCanonical(path: string): string {
  return DEDUPLICATION_MAP[path] ?? path;
}

export function isDuplicated(path: string): boolean {
  return path in DEDUPLICATION_MAP;
}
